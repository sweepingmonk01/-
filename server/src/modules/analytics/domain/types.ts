import type { CognitiveState, InteractionOutcome, InteractionSubmission } from '../../mobius/domain/types.js';
import type { KnowledgeAction } from '../../learning/domain/protocol.js';
import type { StudentStateVector } from '../../student-state/domain/types.js';
import type { HypothesisSummary } from '../../ai/domain/types.js';
import type { StrategyCandidate, StrategyDecision, StrategyKind } from '../../mobius/domain/types.js';

export type LearningCycleSource = 'mobius-session' | 'foundation-science-exploration';
export type LearningCycleStatus = 'started' | 'validated' | 'diagnosed' | 'closed';

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
  };
  outcome?: InteractionOutcome;
  effectScore?: number;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export type LearningCycleEventType =
  | 'cycle.started'
  | 'state.snapshot.before'
  | 'action.selected'
  | 'foundation.exploration.completed'
  | 'interaction.resolved'
  | 'state.snapshot.after'
  | 'effect.evaluated'
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
