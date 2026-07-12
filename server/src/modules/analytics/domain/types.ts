import type { CognitiveState, InteractionOutcome, InteractionSubmission, LearningSignalInput } from '../../mobius/domain/types.js';
import type { KnowledgeAction } from '../../learning/domain/protocol.js';
import type { StudentStateVector } from '../../student-state/domain/types.js';
import type { HypothesisSummary, KnowledgeGraphDecisionContext } from '../../ai/domain/types.js';
import type {
  StrategyAlternative,
  StrategyCandidate,
  StrategyDecision,
  StrategyKind,
} from '../../mobius/domain/types.js';
import type { ExecutionEvidence } from '../application/effect-score-engine.js';

export type LearningCycleSource = 'mobius-session' | 'foundation-science-exploration' | 'practice-interaction';
export type LearningCycleStatus = 'started' | 'validated' | 'diagnosed' | 'closed';
export type LearningEvidenceModality = 'text' | 'image' | 'interaction' | 'graph' | 'diagnosis' | 'transfer';
export type LearningEvidencePrivacyLevel = 'local' | 'server' | 'redacted';

export interface LearningEvidenceEvent {
  id: string;
  studentId: string;
  cycleId?: string;
  modality: LearningEvidenceModality;
  source: string;
  targetNodeKey?: string;
  painPoint?: string;
  rule?: string;
  confidence: number;
  observedAt: string;
  outcome?: InteractionOutcome | 'partial';
  modelVersion?: string;
  privacyLevel: LearningEvidencePrivacyLevel;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface LearningCycleRecord {
  id: string;
  studentId: string;
  source: LearningCycleSource;
  status: LearningCycleStatus;
  sessionId?: string;
  mediaJobId?: string;
  painPoint: string;
  rule: string;
  knowledgeActionId?: string;
  stateBefore?: CognitiveState;
  stateAfter?: CognitiveState;
  hypothesisSummary?: Record<string, unknown>;
  selectedAction?: {
    knowledgeAction?: KnowledgeAction;
    interactionPrompt?: string;
    emotion?: string;
    selectedStrategy?: StrategyKind;
    strategyCandidates?: StrategyCandidate[];
    graphDecisionContext?: KnowledgeGraphDecisionContext;
    strategyPolicyId?: string;
    strategyAlternatives?: StrategyAlternative[];
  };
  outcome?: InteractionOutcome;
  effectScore?: number;
  // effect_score 的价值分量(只由 value-evidence 组成)。回流只读这个字段，
  // 缺省时回落到 effectScore(旧行)。见 effect-score-engine / strategy-value-reflow。
  effectScoreValueComponent?: number;
  // effect_score 的执行分量(被 EXECUTION_EVIDENCE_CAP 夹住的代理确认)。
  // 单独持久化,便于 followup 留存回评时重建 total = clamp(value + execution)。
  effectScoreExecutionComponent?: number;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface LearningModelEvaluation {
  completedPredictions: number;
  averageBrierScore: number;
  calibrationBuckets: Array<{
    bucket: string;
    count: number;
    averagePredicted: number;
    actualSuccessRate: number;
  }>;
}

export type LearningCycleEventType =
  | 'cycle.started'
  | 'state.snapshot.before'
  | 'action.selected'
  | 'foundation.exploration.completed'
  | 'practice.interaction.completed'
  | 'interaction.resolved'
  | 'state.snapshot.after'
  | 'effect.evaluated'
  | 'effect.reevaluated'
  | 'diagnostic.thread.created'
  | 'hypothesis.summary.updated'
  | 'cycle.closed';

export interface LearningCycleEvent {
  id: string;
  cycleId: string;
  eventType: LearningCycleEventType;
  eventPayload?: Record<string, unknown>;
  createdAt: string;
}

export interface StartLearningCycleInput {
  studentId: string;
  sessionId: string;
  mediaJobId: string;
  painPoint: string;
  rule: string;
  knowledgeActionId?: string;
  stateBefore: CognitiveState;
  stateVectorBefore?: StudentStateVector;
  learningSignals?: LearningSignalInput;
  selectedAction?: LearningCycleRecord['selectedAction'];
}

export interface RecordInteractionResolutionInput {
  mediaJobId: string;
  outcome: InteractionOutcome;
  stateAfter: CognitiveState;
  stateVectorBefore?: StudentStateVector;
  stateVectorAfter?: StudentStateVector;
  actionType?: string;
  submission?: InteractionSubmission;
  followupStrategyDecision?: StrategyDecision;
  adjudication?: {
    outcome: InteractionOutcome;
    rationale: string[];
  };
  branchJobId?: string;
  // 真实执行证据:交互 resolved / 媒体是否生成。受 EXECUTION_EVIDENCE_CAP 约束,
  // 只贡献带硬上限的微弱确认,永远不能单独把负价值顶成正分(防 Goodhart)。
  executionEvidence?: ExecutionEvidence;
}

export interface UpdateHypothesisSummaryInput {
  cycleId?: string;
  mediaJobId?: string;
  hypothesisSummary: HypothesisSummary;
}

export interface RecordFoundationExplorationInput {
  studentId: string;
  nodeKey: string;
  nodeLabel: string;
  domain: 'physics' | 'neuroscience';
  coreQuestion: string;
  taskId: string;
  taskLabel: string;
  actionType: KnowledgeAction['actionType'];
  outcome: InteractionOutcome;
  stateBefore: CognitiveState;
  stateAfter: CognitiveState;
  stateVectorBefore?: StudentStateVector | null;
  stateVectorAfter?: StudentStateVector | null;
  note?: string;
}

export interface RecordPracticeInteractionInput {
  studentId: string;
  painPoint: string;
  rule: string;
  questionText?: string;
  actionType: KnowledgeAction['actionType'];
  outcome: InteractionOutcome;
  selfCheck?: 'aligned' | 'partial' | 'guess';
  confidence?: 'low' | 'medium' | 'high';
  responseTimeMs?: number;
  stateBefore: CognitiveState;
  stateAfter: CognitiveState;
  stateVectorBefore?: StudentStateVector | null;
  stateVectorAfter?: StudentStateVector | null;
  note?: string;
}
