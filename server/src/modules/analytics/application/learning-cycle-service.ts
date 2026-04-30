import type { CognitiveState } from '../../mobius/domain/types.js';
import type {
  LearningCycleEvent,
  LearningCycleRecord,
  RecordFoundationExplorationInput,
  RecordInteractionResolutionInput,
  StartLearningCycleInput,
  UpdateHypothesisSummaryInput,
} from '../domain/types.js';
import { SQLiteLearningCycleRepository } from '../infrastructure/sqlite-learning-cycle-repository.js';

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
  };
};

const buildFlow = (cycle: LearningCycleRecord, events: LearningCycleEvent[]) => ({
  stateBefore: cycle.stateBefore,
  hypothesis: cycle.hypothesisSummary,
  selectedAction: cycle.selectedAction,
  result: {
    outcome: cycle.outcome,
    effectScore: cycle.effectScore,
    status: cycle.status,
  },
  stateAfter: cycle.stateAfter,
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

    return cycle;
  }

  async recordFoundationExploration(input: RecordFoundationExplorationInput): Promise<LearningCycleRecord> {
    const cycle = await this.repository.create({
      studentId: input.studentId,
      source: 'foundation-science-exploration',
      status: 'validated',
      painPoint: `基础科学探索：${input.nodeLabel}`,
      rule: input.coreQuestion,
      knowledgeActionId: `foundation:${input.nodeKey}:${input.taskId}`,
      stateBefore: input.stateBefore,
      stateAfter: input.stateAfter,
      outcome: input.outcome,
      effectScore: input.outcome === 'success' ? 1 : 0,
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
      },
    });

    return cycle;
  }

  async recordInteractionResolution(input: RecordInteractionResolutionInput & { stateBefore?: CognitiveState }) {
    const cycle = await this.repository.getByMediaJobId(input.mediaJobId);
    if (!cycle) return null;

    const effectScore = input.outcome === 'success' ? 1 : 0;
    const updated = await this.repository.update(cycle.id, {
      status: 'validated',
      outcome: input.outcome,
      effectScore,
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
        effectScore,
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

    return updated;
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

    return updated;
  }

  async getCycleByMediaJobId(mediaJobId: string) {
    return this.repository.getByMediaJobId(mediaJobId);
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

    return {
      studentId,
      cycle: summarizeCycle(cycle),
      flow: buildFlow(cycle, events),
    };
  }
}
