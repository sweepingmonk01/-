import type { CognitiveState, LearningSignalInput } from '../../mobius/domain/types.js';
import type {
  LearningCycleEvent,
  LearningEvidenceEvent,
  LearningModelEvaluation,
  LearningCycleRecord,
  RecordFoundationExplorationInput,
  RecordInteractionResolutionInput,
  StartLearningCycleInput,
  UpdateHypothesisSummaryInput,
} from '../domain/types.js';
import { SQLiteLearningCycleRepository } from '../infrastructure/sqlite-learning-cycle-repository.js';
import {
  computeEffectScore,
  type EffectScoreBreakdown,
  type ExecutionEvidence,
  type FollowupEvidence,
} from './effect-score-engine.js';
import {
  computeStrategyValueReflow,
  type StrategyValueReflow,
} from './strategy-value-reflow.js';
import {
  compareShadowConfigs,
  type ShadowConfigComparisonReport,
} from './shadow-config-promotion-gate.js';
import {
  DEFAULT_SCORED_SCHEDULER_CONFIG,
  BALANCED_SCORED_SCHEDULER_CONFIG,
} from '../../mobius/infrastructure/scored-strategy-scheduler.js';

const BASELINE_HISTORY_LIMIT = 100;
const REFLOW_HISTORY_LIMIT = 100;
// followup 留存回评的回看窗口:一条新完成的 cycle 会触发同知识点历史 cycle 的价值再评估。
const FOLLOWUP_HISTORY_LIMIT = 100;

const matchesPainPoint = (cycle: LearningCycleRecord, painPoint: string) => (
  cycle.painPoint.trim() === painPoint.trim()
);

const isCompleted = (cycle: LearningCycleRecord): cycle is LearningCycleRecord & { outcome: 'success' | 'failure' } => (
  cycle.outcome === 'success' || cycle.outcome === 'failure'
);

const clampScore = (value: number) => (
  Math.round(Math.max(-1, Math.min(1, value)) * 1000) / 1000
);

// 从"该 cycle 之后、同知识点已判定的后续作答"聚合真实 followup 留存证据。
// 无后续作答时返回 undefined(retention 维度回落到 baseline 代理)。
const computeFollowupEvidence = (
  target: LearningCycleRecord,
  sameKnowledgeCompleted: Array<LearningCycleRecord & { outcome: 'success' | 'failure' }>,
): FollowupEvidence | undefined => {
  const subsequent = sameKnowledgeCompleted.filter(
    (cycle) => cycle.id !== target.id && cycle.createdAt > target.createdAt,
  );
  if (subsequent.length === 0) return undefined;
  const successes = subsequent.filter((cycle) => cycle.outcome === 'success').length;
  return {
    sampleCount: subsequent.length,
    subsequentSuccessRate: successes / subsequent.length,
  };
};

interface RecordDiagnosticThreadInput {
  cycleId?: string;
  mediaJobId?: string;
  threadId: string;
  title: string;
}

const toJsonObject = (value: unknown) => value as Record<string, unknown>;

const clampLimit = (value: number | undefined, fallback: number = 20) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(100, Math.round(value ?? fallback)));
};

const average = (values: number[]) => (
  values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0
);

const summarizeCycle = (cycle: LearningCycleRecord) => ({
  id: cycle.id,
  source: cycle.source,
  status: cycle.status,
  sessionId: cycle.sessionId,
  mediaJobId: cycle.mediaJobId,
  painPoint: cycle.painPoint,
  rule: cycle.rule,
  outcome: cycle.outcome,
  effectScore: cycle.effectScore,
  selectedStrategy: cycle.selectedAction?.selectedStrategy,
  createdAt: cycle.createdAt,
  updatedAt: cycle.updatedAt,
});

const extractSelectedPrediction = (cycle: LearningCycleRecord) => {
  const selectedStrategy = cycle.selectedAction?.selectedStrategy;
  const selectedCandidate = cycle.selectedAction?.strategyCandidates?.find((candidate) =>
    candidate.strategy === selectedStrategy);
  const probability = selectedCandidate?.expectedUtility?.successProbability;

  if (typeof probability !== 'number' || !Number.isFinite(probability)) return null;
  if (cycle.outcome !== 'success' && cycle.outcome !== 'failure') return null;

  return {
    predicted: Math.max(0, Math.min(1, probability / 100)),
    actual: cycle.outcome === 'success' ? 1 : 0,
  };
};

const buildModelEvaluation = (cycles: LearningCycleRecord[]): LearningModelEvaluation => {
  const predictions = cycles
    .map(extractSelectedPrediction)
    .filter((item): item is { predicted: number; actual: number } => Boolean(item));
  const brierScores = predictions.map((item) => (item.predicted - item.actual) ** 2);
  const buckets = new Map<string, Array<{ predicted: number; actual: number }>>();

  for (const prediction of predictions) {
    const floor = Math.floor(prediction.predicted * 5) / 5;
    const lower = Math.min(0.8, floor);
    const upper = lower + 0.2;
    const key = `${Math.round(lower * 100)}-${Math.round(upper * 100)}`;
    buckets.set(key, [...(buckets.get(key) ?? []), prediction]);
  }

  return {
    completedPredictions: predictions.length,
    averageBrierScore: average(brierScores),
    calibrationBuckets: Array.from(buckets.entries())
      .map(([bucket, items]) => ({
        bucket,
        count: items.length,
        averagePredicted: average(items.map((item) => item.predicted)),
        actualSuccessRate: average(items.map((item) => item.actual)),
      }))
      .sort((left, right) => left.bucket.localeCompare(right.bucket)),
  };
};

const buildEvaluation = (cycles: LearningCycleRecord[]) => {
  const completed = cycles.filter((cycle) => cycle.outcome === 'success' || cycle.outcome === 'failure');
  const successes = completed.filter((cycle) => cycle.outcome === 'success');
  const effectScores = completed
    .map((cycle) => cycle.effectScore)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const painPointGroups = new Map<string, LearningCycleRecord[]>();

  for (const cycle of cycles) {
    const key = cycle.painPoint.trim() || 'unknown';
    painPointGroups.set(key, [...(painPointGroups.get(key) ?? []), cycle]);
  }

  const painPointTrends = Array.from(painPointGroups.entries())
    .map(([painPoint, items]) => {
      const completedItems = items.filter((cycle) => cycle.outcome === 'success' || cycle.outcome === 'failure');
      const itemEffectScores = completedItems
        .map((cycle) => cycle.effectScore)
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
      const ordered = [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      return {
        painPoint,
        attempts: items.length,
        successCount: completedItems.filter((cycle) => cycle.outcome === 'success').length,
        failureCount: completedItems.filter((cycle) => cycle.outcome === 'failure').length,
        averageEffectScore: average(itemEffectScores),
        firstOutcome: ordered[0]?.outcome,
        latestOutcome: ordered[ordered.length - 1]?.outcome,
        firstSeenAt: ordered[0]?.createdAt,
        latestSeenAt: ordered[ordered.length - 1]?.createdAt,
      };
    })
    .sort((a, b) => b.attempts - a.attempts || b.latestSeenAt.localeCompare(a.latestSeenAt));

  return {
    totalCycles: cycles.length,
    completedCycles: completed.length,
    successCount: successes.length,
    failureCount: completed.length - successes.length,
    successRate: completed.length > 0 ? successes.length / completed.length : 0,
    averageEffectScore: average(effectScores),
    repeatedPainPoints: painPointTrends.filter((item) => item.attempts > 1),
    painPointTrends,
    modelEvaluation: buildModelEvaluation(cycles),
  };
};

const summarizeEvidence = (evidence: LearningEvidenceEvent) => ({
  id: evidence.id,
  modality: evidence.modality,
  source: evidence.source,
  targetNodeKey: evidence.targetNodeKey,
  painPoint: evidence.painPoint,
  rule: evidence.rule,
  confidence: evidence.confidence,
  observedAt: evidence.observedAt,
  outcome: evidence.outcome,
  modelVersion: evidence.modelVersion,
  privacyLevel: evidence.privacyLevel,
  payload: evidence.payload,
});

type NormalizedBehaviorSignal = {
  key: string;
  label: string;
  value: number;
  unit: 'ms' | 'count' | 'ratio' | 'minutes' | 'bytes' | 'pixels';
  direction: 'higher-is-risk' | 'lower-is-risk' | 'contextual';
  severity: 'info' | 'watch' | 'risk';
};

const finiteNumber = (value: unknown): number | null => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

const severityFor = (value: number, watchAt: number, riskAt: number): NormalizedBehaviorSignal['severity'] => {
  if (value >= riskAt) return 'risk';
  if (value >= watchAt) return 'watch';
  return 'info';
};

const buildNormalizedBehaviorSignals = (input: LearningSignalInput | undefined): NormalizedBehaviorSignal[] => {
  if (!input) return [];

  const signals: NormalizedBehaviorSignal[] = [];
  const add = (
    key: string,
    label: string,
    value: number | null,
    unit: NormalizedBehaviorSignal['unit'],
    direction: NormalizedBehaviorSignal['direction'],
    severity: NormalizedBehaviorSignal['severity'],
  ) => {
    if (value === null) return;
    signals.push({ key, label, value, unit, direction, severity });
  };

  add('response-time', '作答耗时', finiteNumber(input.responseTimeMs), 'ms', 'higher-is-risk', severityFor(input.responseTimeMs ?? 0, 45_000, 90_000));
  add('pause-duration', '停顿时长', finiteNumber(input.pauseDurationMs), 'ms', 'higher-is-risk', severityFor(input.pauseDurationMs ?? 0, 20_000, 45_000));
  add('input-rhythm', '输入节奏', finiteNumber(input.inputRhythmMs), 'ms', 'contextual', severityFor(input.inputRhythmMs ?? 0, 8_000, 18_000));
  add('attempts', '尝试次数', finiteNumber(input.attempts), 'count', 'higher-is-risk', severityFor(input.attempts ?? 0, 2, 4));
  add('retry-frequency', '重试频率', finiteNumber(input.retryFrequency), 'ratio', 'higher-is-risk', severityFor(input.retryFrequency ?? 0, 0.35, 0.65));
  add('scroll-burst', '滚动突增', finiteNumber(input.scrollBurstCount), 'count', 'higher-is-risk', severityFor(input.scrollBurstCount ?? 0, 3, 6));
  add('draft-upload', '草稿上传', finiteNumber(input.draftUploadCount), 'count', 'contextual', severityFor(input.draftUploadCount ?? 0, 1, 3));
  add('wrong-streak', '连续错误', finiteNumber(input.wrongStreak), 'count', 'higher-is-risk', severityFor(input.wrongStreak ?? 0, 1, 3));
  add('correct-streak', '连续正确', finiteNumber(input.correctStreak), 'count', 'lower-is-risk', 'info');
  add('time-saved', '节省时间', finiteNumber(input.timeSavedMinutes), 'minutes', 'lower-is-risk', 'info');
  add('image-width', '题图宽度', finiteNumber(input.imageMetadata?.width), 'pixels', 'contextual', 'info');
  add('image-height', '题图高度', finiteNumber(input.imageMetadata?.height), 'pixels', 'contextual', 'info');
  add('image-bytes', '题图大小', finiteNumber(input.imageMetadata?.byteSize), 'bytes', 'contextual', severityFor(input.imageMetadata?.byteSize ?? 0, 3_000_000, 7_000_000));

  return signals;
};

const buildFlow = (
  cycle: LearningCycleRecord,
  events: LearningCycleEvent[],
  evidenceEvents: LearningEvidenceEvent[],
) => ({
  stateBefore: cycle.stateBefore,
  hypothesis: cycle.hypothesisSummary,
  selectedAction: cycle.selectedAction,
  result: {
    outcome: cycle.outcome,
    effectScore: cycle.effectScore,
    status: cycle.status,
  },
  stateAfter: cycle.stateAfter,
  evidence: evidenceEvents.map(summarizeEvidence),
  events: events.map((event) => ({
    id: event.id,
    eventType: event.eventType,
    eventPayload: event.eventPayload,
    createdAt: event.createdAt,
  })),
});

export class LearningCycleService {
  constructor(private readonly repository: SQLiteLearningCycleRepository) {}

  async startCycle(input: StartLearningCycleInput): Promise<LearningCycleRecord> {
    const cycle = await this.repository.create({
      studentId: input.studentId,
      source: 'mobius-session',
      status: 'started',
      sessionId: input.sessionId,
      mediaJobId: input.mediaJobId,
      painPoint: input.painPoint,
      rule: input.rule,
      knowledgeActionId: input.knowledgeActionId,
      stateBefore: input.stateBefore,
      selectedAction: input.selectedAction,
    });

    await this.repository.appendEvent({
      cycleId: cycle.id,
      eventType: 'cycle.started',
      eventPayload: {
        sessionId: cycle.sessionId,
        mediaJobId: cycle.mediaJobId,
        painPoint: cycle.painPoint,
        rule: cycle.rule,
      },
    });
    await this.repository.appendEvent({
        cycleId: cycle.id,
        eventType: 'state.snapshot.before',
        eventPayload: {
          state: cycle.stateBefore ? toJsonObject(cycle.stateBefore) : undefined,
          stateVectorVersion: input.stateVectorBefore?.version,
          stateVector: input.stateVectorBefore ? toJsonObject(input.stateVectorBefore) : undefined,
        },
      });

    if (cycle.selectedAction) {
      await this.repository.appendEvent({
        cycleId: cycle.id,
        eventType: 'action.selected',
        eventPayload: {
          phase: 'session-created',
          selectedAction: toJsonObject(cycle.selectedAction),
        },
      });
    }
    await this.repository.appendEvidence({
      studentId: cycle.studentId,
      cycleId: cycle.id,
      modality: 'interaction',
      source: 'mobius.state.prior',
      painPoint: cycle.painPoint,
      rule: cycle.rule,
      confidence: 0.7,
      observedAt: cycle.createdAt,
      modelVersion: 'probabilistic-v1',
      privacyLevel: 'server',
      payload: {
        stateBefore: cycle.stateBefore ? toJsonObject(cycle.stateBefore) : undefined,
        stateVectorVersion: input.stateVectorBefore?.version,
        stateVector: input.stateVectorBefore ? toJsonObject(input.stateVectorBefore) : undefined,
      },
    });
    const behaviorSignals = buildNormalizedBehaviorSignals(input.learningSignals);
    if (behaviorSignals.length) {
      await this.repository.appendEvidence({
        studentId: cycle.studentId,
        cycleId: cycle.id,
        modality: 'interaction',
        source: 'behavior.signals.normalized',
        painPoint: cycle.painPoint,
        rule: cycle.rule,
        confidence: 0.65,
        observedAt: cycle.createdAt,
        modelVersion: 'behavior-signals-v1',
        privacyLevel: 'server',
        payload: {
          signals: behaviorSignals,
          raw: input.learningSignals,
        },
      });
    }
    if (cycle.selectedAction) {
      await this.repository.appendEvidence({
        studentId: cycle.studentId,
        cycleId: cycle.id,
        modality: 'interaction',
        source: 'mobius.action.selected',
        painPoint: cycle.painPoint,
        rule: cycle.rule,
        confidence: 0.75,
        observedAt: cycle.createdAt,
        modelVersion: 'probabilistic-v1',
        privacyLevel: 'server',
        payload: {
          selectedAction: toJsonObject(cycle.selectedAction),
          selectedStrategy: cycle.selectedAction.selectedStrategy,
        },
      });
    }
    if (cycle.selectedAction?.graphDecisionContext?.priorSignals.length) {
      const strongestPrior = cycle.selectedAction.graphDecisionContext.priorSignals[0];
      await this.repository.appendEvidence({
        studentId: cycle.studentId,
        cycleId: cycle.id,
        modality: 'graph',
        source: 'graph.prior.applied',
        targetNodeKey: strongestPrior.key,
        painPoint: cycle.painPoint,
        rule: cycle.rule,
        confidence: strongestPrior.probability,
        observedAt: cycle.createdAt,
        modelVersion: 'graph-prior-v1',
        privacyLevel: 'server',
        payload: {
          priorSignals: cycle.selectedAction.graphDecisionContext.priorSignals,
          matchedHotspots: cycle.selectedAction.graphDecisionContext.matchedHotspots,
          neighborRecommendations: cycle.selectedAction.graphDecisionContext.neighborRecommendations,
          summary: cycle.selectedAction.graphDecisionContext.summary,
        },
      });
    }

    return cycle;
  }

  async recordFoundationExploration(input: RecordFoundationExplorationInput): Promise<LearningCycleRecord> {
    const painPoint = `基础科学探索：${input.nodeLabel}`;
    const breakdown = await this.computeEffectScoreForCycle({
      studentId: input.studentId,
      painPoint,
      outcome: input.outcome,
      stateBefore: input.stateBefore,
      stateAfter: input.stateAfter,
    });
    const cycle = await this.repository.create({
      studentId: input.studentId,
      source: 'foundation-science-exploration',
      status: 'validated',
      painPoint,
      rule: input.coreQuestion,
      knowledgeActionId: `foundation:${input.nodeKey}:${input.taskId}`,
      stateBefore: input.stateBefore,
      stateAfter: input.stateAfter,
      outcome: input.outcome,
      effectScore: breakdown.total,
      effectScoreValueComponent: breakdown.valueComponent,
      effectScoreExecutionComponent: breakdown.executionComponent,
      selectedAction: {
        knowledgeAction: {
          id: `foundation:${input.nodeKey}:${input.taskId}`,
          label: input.taskLabel,
          actionType: input.actionType,
          instruction: `围绕「${input.nodeLabel}」完成基础科学探索动作。`,
          successCriteria: ['能把机制、课内知识或错因连接起来。'],
          failureSignals: ['只看了节点，没有完成连接或自检。'],
        },
        interactionPrompt: input.coreQuestion,
        emotion: 'focused',
        selectedStrategy: 'probe',
        strategyCandidates: [],
      },
    });

    await this.repository.appendEvent({
      cycleId: cycle.id,
      eventType: 'cycle.started',
      eventPayload: {
        source: 'foundation-science-exploration',
        nodeKey: input.nodeKey,
        nodeLabel: input.nodeLabel,
        domain: input.domain,
        taskId: input.taskId,
      },
    });
    await this.repository.appendEvent({
      cycleId: cycle.id,
      eventType: 'state.snapshot.before',
      eventPayload: {
        state: toJsonObject(input.stateBefore),
        stateVectorVersion: input.stateVectorBefore?.version,
        stateVector: input.stateVectorBefore ? toJsonObject(input.stateVectorBefore) : undefined,
      },
    });
    await this.repository.appendEvent({
      cycleId: cycle.id,
      eventType: 'foundation.exploration.completed',
      eventPayload: {
        nodeKey: input.nodeKey,
        nodeLabel: input.nodeLabel,
        domain: input.domain,
        taskId: input.taskId,
        taskLabel: input.taskLabel,
        actionType: input.actionType,
        outcome: input.outcome,
        note: input.note,
      },
    });
    await this.repository.appendEvent({
      cycleId: cycle.id,
      eventType: 'state.snapshot.after',
      eventPayload: {
        state: toJsonObject(input.stateAfter),
        stateVectorVersion: input.stateVectorAfter?.version,
        stateVector: input.stateVectorAfter ? toJsonObject(input.stateVectorAfter) : undefined,
      },
    });
    await this.repository.appendEvent({
      cycleId: cycle.id,
      eventType: 'effect.evaluated',
      eventPayload: {
        outcome: input.outcome,
        effectScore: cycle.effectScore,
        effectScoreBreakdown: breakdown,
      },
    });
    await this.repository.appendEvidence({
      studentId: cycle.studentId,
      cycleId: cycle.id,
      modality: 'transfer',
      source: 'foundation.exploration.outcome',
      targetNodeKey: input.nodeKey,
      painPoint: cycle.painPoint,
      rule: cycle.rule,
      confidence: 0.8,
      observedAt: cycle.updatedAt,
      outcome: input.outcome,
      modelVersion: 'probabilistic-v1',
      privacyLevel: 'server',
      payload: {
        domain: input.domain,
        taskId: input.taskId,
        taskLabel: input.taskLabel,
        actionType: input.actionType,
        stateBefore: toJsonObject(input.stateBefore),
        stateAfter: toJsonObject(input.stateAfter),
        stateVectorBeforeVersion: input.stateVectorBefore?.version,
        stateVectorAfterVersion: input.stateVectorAfter?.version,
        note: input.note,
      },
    });

    // 这条新完成的 cycle 是同知识点历史 cycle 的真实"后续作答表现"——回评它们的留存价值。
    await this.reevaluateFollowupForPriorCycles(cycle.studentId, cycle.painPoint, cycle.id);

    return cycle;
  }

  private async computeEffectScoreForCycle(input: {
    cycleId?: string;
    studentId: string;
    painPoint: string;
    outcome: 'success' | 'failure';
    stateBefore?: CognitiveState | null;
    stateAfter?: CognitiveState | null;
    executionEvidence?: ExecutionEvidence;
  }): Promise<EffectScoreBreakdown> {
    const recent = await this.repository.listByStudent(input.studentId, BASELINE_HISTORY_LIMIT);
    const historicalCycles = recent.filter((cycle) => (
      cycle.id !== input.cycleId && matchesPainPoint(cycle, input.painPoint)
    ));

    return computeEffectScore({
      outcome: input.outcome,
      stateBefore: input.stateBefore,
      stateAfter: input.stateAfter,
      historicalCycles,
      executionEvidence: input.executionEvidence,
    });
  }

  async recordInteractionResolution(input: RecordInteractionResolutionInput & { stateBefore?: CognitiveState }) {
    const cycle = await this.repository.getByMediaJobId(input.mediaJobId);
    if (!cycle) return null;

    const breakdown = await this.computeEffectScoreForCycle({
      cycleId: cycle.id,
      studentId: cycle.studentId,
      painPoint: cycle.painPoint,
      outcome: input.outcome,
      stateBefore: input.stateBefore ?? cycle.stateBefore,
      stateAfter: input.stateAfter,
      // 真实执行证据在线接入:交互已 resolved,媒体分支是否生成。受硬上限约束。
      executionEvidence: input.executionEvidence,
    });
    const updated = await this.repository.update(cycle.id, {
      status: 'validated',
      outcome: input.outcome,
      effectScore: breakdown.total,
      effectScoreValueComponent: breakdown.valueComponent,
      effectScoreExecutionComponent: breakdown.executionComponent,
      stateAfter: input.stateAfter,
    });
    if (!updated) return null;

    await this.repository.appendEvent({
      cycleId: cycle.id,
      eventType: 'interaction.resolved',
      eventPayload: {
        outcome: input.outcome,
        actionType: input.actionType,
        submission: input.submission ? toJsonObject(input.submission) : undefined,
        adjudication: input.adjudication ? toJsonObject(input.adjudication) : undefined,
        branchJobId: input.branchJobId,
      },
    });
    await this.repository.appendEvent({
      cycleId: cycle.id,
      eventType: 'state.snapshot.after',
      eventPayload: {
        previousState: input.stateBefore ? toJsonObject(input.stateBefore) : undefined,
        state: toJsonObject(input.stateAfter),
        previousStateVectorVersion: input.stateVectorBefore?.version,
        stateVectorVersion: input.stateVectorAfter?.version,
        previousStateVector: input.stateVectorBefore ? toJsonObject(input.stateVectorBefore) : undefined,
        stateVector: input.stateVectorAfter ? toJsonObject(input.stateVectorAfter) : undefined,
      },
    });
    await this.repository.appendEvent({
      cycleId: cycle.id,
      eventType: 'effect.evaluated',
      eventPayload: {
        outcome: input.outcome,
        effectScore: breakdown.total,
        effectScoreBreakdown: breakdown,
      },
    });
    if (input.followupStrategyDecision) {
      await this.repository.appendEvent({
        cycleId: cycle.id,
        eventType: 'action.selected',
        eventPayload: {
          phase: 'interaction-resolved',
          outcome: input.outcome,
          strategyDecision: toJsonObject(input.followupStrategyDecision),
        },
      });
    }
    await this.repository.appendEvidence({
      studentId: updated.studentId,
      cycleId: updated.id,
      modality: 'interaction',
      source: 'mobius.interaction.outcome',
      painPoint: updated.painPoint,
      rule: updated.rule,
      confidence: 0.85,
      observedAt: updated.updatedAt,
      outcome: input.outcome,
      modelVersion: 'probabilistic-v1',
      privacyLevel: 'server',
      payload: {
        stateBefore: input.stateBefore ? toJsonObject(input.stateBefore) : undefined,
        stateAfter: toJsonObject(input.stateAfter),
        stateVectorBeforeVersion: input.stateVectorBefore?.version,
        stateVectorAfterVersion: input.stateVectorAfter?.version,
        selectedAction: cycle.selectedAction ? toJsonObject(cycle.selectedAction) : undefined,
        followupStrategyDecision: input.followupStrategyDecision ? toJsonObject(input.followupStrategyDecision) : undefined,
        actionType: input.actionType,
        submission: input.submission ? toJsonObject(input.submission) : undefined,
        adjudication: input.adjudication ? toJsonObject(input.adjudication) : undefined,
      },
    });

    // 这条新完成的 cycle 是同知识点历史 cycle 的真实"后续作答表现"——回评它们的留存价值。
    await this.reevaluateFollowupForPriorCycles(updated.studentId, updated.painPoint, updated.id);

    return updated;
  }

  // T2 阶段一:真实 followup 留存回评。一条新完成的 cycle 到达后,把它作为同知识点历史
  // cycle 的"后续真实作答表现",重算那些历史 cycle 的 effect_score_value——让 retention
  // 维度从 baseline 代理切换到真实数据。total 用重算后的 value + 已持久化的 execution 分量
  // 重建,execution 仍受硬上限约束(纯执行救不回负留存)。回写全程挂 cycleId。
  private async reevaluateFollowupForPriorCycles(
    studentId: string,
    painPoint: string,
    triggerCycleId: string,
  ): Promise<void> {
    const recent = await this.repository.listByStudent(studentId, FOLLOWUP_HISTORY_LIMIT);
    const sameKnowledgeCompleted = recent
      .filter((cycle) => matchesPainPoint(cycle, painPoint))
      .filter(isCompleted);

    for (const target of sameKnowledgeCompleted) {
      // 触发 cycle 自身此刻还没有"后续"作答,不回评。
      if (target.id === triggerCycleId) continue;

      const followupEvidence = computeFollowupEvidence(target, sameKnowledgeCompleted);
      if (!followupEvidence) continue;

      const historicalCycles = sameKnowledgeCompleted.filter(
        (cycle) => cycle.id !== target.id && cycle.createdAt < target.createdAt,
      );
      const breakdown = computeEffectScore({
        outcome: target.outcome,
        stateBefore: target.stateBefore,
        stateAfter: target.stateAfter,
        historicalCycles,
        followupEvidence,
      });

      const storedExecution = target.effectScoreExecutionComponent ?? 0;
      const newValue = breakdown.valueComponent;
      const newTotal = clampScore(newValue + storedExecution);
      const prevValue = target.effectScoreValueComponent;

      // 价值分量无变化则不写(幂等,避免刷 updated_at 与事件)。
      if (typeof prevValue === 'number' && Math.abs(prevValue - newValue) < 1e-6) continue;

      await this.repository.update(target.id, {
        effectScore: newTotal,
        effectScoreValueComponent: newValue,
      });
      await this.repository.appendEvent({
        cycleId: target.id,
        eventType: 'effect.reevaluated',
        eventPayload: {
          reason: 'followup-retention',
          triggerCycleId,
          followupSampleCount: followupEvidence.sampleCount,
          subsequentSuccessRate: followupEvidence.subsequentSuccessRate,
          previousEffectScoreValue: prevValue ?? null,
          effectScore: newTotal,
          effectScoreValue: newValue,
          effectScoreBreakdown: breakdown,
        },
      });
    }
  }

  async recordDiagnosticThreadCreated(input: RecordDiagnosticThreadInput) {
    const cycle = input.cycleId
      ? await this.repository.getById(input.cycleId)
      : input.mediaJobId
        ? await this.repository.getByMediaJobId(input.mediaJobId)
        : null;
    if (!cycle) return null;

    const updated = await this.repository.update(cycle.id, {
      status: 'diagnosed',
    });
    if (!updated) return null;

    await this.repository.appendEvent({
      cycleId: cycle.id,
      eventType: 'diagnostic.thread.created',
      eventPayload: {
        threadId: input.threadId,
        title: input.title,
      },
    });

    return updated;
  }

  async updateHypothesisSummary(input: UpdateHypothesisSummaryInput) {
    const cycle = input.cycleId
      ? await this.repository.getById(input.cycleId)
      : input.mediaJobId
        ? await this.repository.getByMediaJobId(input.mediaJobId)
        : null;
    if (!cycle) return null;

    const updated = await this.repository.update(cycle.id, {
      hypothesisSummary: input.hypothesisSummary as unknown as Record<string, unknown>,
    });
    if (!updated) return null;

    await this.repository.appendEvent({
      cycleId: cycle.id,
      eventType: 'hypothesis.summary.updated',
      eventPayload: {
        hypothesisSummary: toJsonObject(input.hypothesisSummary),
      },
    });
    await this.repository.appendEvidence({
      studentId: updated.studentId,
      cycleId: updated.id,
      modality: 'diagnosis',
      source: 'hypothesis.posterior',
      painPoint: updated.painPoint,
      rule: updated.rule,
      confidence: input.hypothesisSummary.selectedHypothesis?.confidence ?? 0.5,
      observedAt: updated.updatedAt,
      modelVersion: input.hypothesisSummary.source,
      privacyLevel: 'server',
      payload: {
        hypothesisSummary: toJsonObject(input.hypothesisSummary),
      },
    });

    return updated;
  }

  async getCycleByMediaJobId(mediaJobId: string) {
    return this.repository.getByMediaJobId(mediaJobId);
  }

  // T2 价值信号回流:把该学生累计的价值证据 effect_score 按策略聚合成回流偏置，
  // 供 ScoredStrategyScheduler 抬高/压低历史真实增益不同的策略。只吃 value 分量。
  async getStrategyValueReflow(studentId: string): Promise<StrategyValueReflow> {
    const cycles = await this.repository.listByStudent(studentId, REFLOW_HISTORY_LIMIT);
    return computeStrategyValueReflow(cycles);
  }

  // T3 影子 A/B 配置晋升门:基于阶段一的真实 value-evidence,对 DEFAULT(primary)vs
  // BALANCED(shadow)出一份对比报告 + 显式"建议晋升/维持"决策记录。晋升判据只用真实价值
  // 信号,不用执行代理;门只建议,配置真实切换保留人工确认(autoFlipAllowed 恒 false)。
  // 决策记录作为学生级 evidence 事件持久化(结构化,可审计),不只是自然语言。
  async getShadowConfigPromotionReport(
    studentId: string,
    options?: { primaryPolicyId?: string; challengerPolicyId?: string; record?: boolean },
  ): Promise<ShadowConfigComparisonReport> {
    const cycles = await this.repository.listByStudent(studentId, REFLOW_HISTORY_LIMIT);
    const report = compareShadowConfigs({
      cycles,
      primaryPolicyId: options?.primaryPolicyId ?? DEFAULT_SCORED_SCHEDULER_CONFIG.policyId,
      challengerPolicyId: options?.challengerPolicyId ?? BALANCED_SCORED_SCHEDULER_CONFIG.policyId,
    });

    // 默认把这次显式裁决登记为一条学生级 evidence(结构化决策记录,挂 studentId)。
    if (options?.record !== false) {
      await this.repository.appendEvidence({
        studentId,
        modality: 'interaction',
        source: 'shadow.config.promotion.decision',
        confidence: report.challengerWinRate ?? 0.5,
        observedAt: report.generatedAt,
        modelVersion: 'shadow-config-promotion-gate-v1',
        privacyLevel: 'server',
        payload: {
          shadowConfigPromotion: toJsonObject(report),
        },
      });
    }

    return report;
  }

  async listStudentCycleReports(studentId: string, limit?: number) {
    const cycles = await this.repository.listByStudent(studentId, clampLimit(limit));

    return {
      studentId,
      evaluation: buildEvaluation(cycles),
      cycles: cycles.map(summarizeCycle),
    };
  }

  async getCycleReport(studentId: string, cycleId: string) {
    const cycle = await this.repository.getById(cycleId);
    if (!cycle || cycle.studentId !== studentId) return null;

    const events = await this.repository.listEvents(cycleId);
    const evidenceEvents = await this.repository.listEvidenceByCycle(cycleId);

    return {
      studentId,
      cycle: summarizeCycle(cycle),
      flow: buildFlow(cycle, events, evidenceEvents),
    };
  }
}
