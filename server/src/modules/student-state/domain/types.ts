import type { KnowledgeActionType, MistakeCategory } from '../../learning/domain/protocol.js';
import type { InteractionOutcome, LearningSignalInput } from '../../mobius/domain/types.js';
import type { CognitiveState, CompatibleCognitiveState } from '../../../../../shared/cognitive-state.js';

export type { CognitiveState, CompatibleCognitiveState } from '../../../../../shared/cognitive-state.js';

export type StudentStateSnapshotSource = 'session-created' | 'interaction-resolved' | 'foundation-exploration';

export interface StudentStateSnapshot {
  id: string;
  studentId: string;
  createdAt: string;
  source: StudentStateSnapshotSource;
  sessionId?: string;
  mediaJobId?: string;
  interactionOutcome?: InteractionOutcome;
  cognitiveState: CognitiveState;
  profile: {
    grade?: string;
    targetScore?: number;
    painPoint: string;
    rule: string;
    knowledgeActionId?: string;
    knowledgeActionType?: KnowledgeActionType;
    diagnosedMistakeCategories: MistakeCategory[];
  };
  learningSignals?: LearningSignalInput;
}

export interface StudentStateSnapshotInput extends Omit<StudentStateSnapshot, 'id' | 'createdAt' | 'cognitiveState'> {
  cognitiveState: CompatibleCognitiveState;
}

export interface StudentStateSummary {
  studentId: string;
  stateVectorVersion?: string;
  latestSnapshotAt?: string;
  totalSnapshots: number;
  totalSessions: number;
  interactionStats: {
    successCount: number;
    failureCount: number;
    lastOutcome?: InteractionOutcome;
  };
  currentCognitiveState?: CognitiveState;
  recentPainPoints: string[];
  activeRules: string[];
  mistakeCategoryCounts: Partial<Record<MistakeCategory, number>>;
  recommendedSessionDefaults?: {
    grade?: string;
    targetScore?: number;
    painPoint: string;
    rule: string;
    previousState: CognitiveState;
    knowledgeActionId?: string;
    knowledgeActionType?: KnowledgeActionType;
  };
}

export interface StudentStateVector {
  version: string;
  studentId: string;
  computedAt: string;
  snapshotCount: number;
  currentSnapshotId?: string;
  currentSnapshotSource?: StudentStateSnapshotSource;
  cognitive: CognitiveState;
  mastery: Record<string, {
    score: number;
    confidence: number;
    lastEvidenceAt?: string;
  }>;
  errorBeliefs: Record<string, {
    score: number;
    evidenceCount: number;
    lastEvidenceAt?: string;
  }>;
  sessionContext: {
    currentPainPoint?: string;
    currentRule?: string;
    grade?: string;
    targetScore?: number;
    knowledgeActionId?: string;
    knowledgeActionType?: KnowledgeActionType;
    latestInteractionOutcome?: InteractionOutcome;
    recentFailureCount: number;
    recentSuccessCount: number;
  };
  recentPainPoints: string[];
  activeRules: string[];
  mistakeCategoryCounts: Partial<Record<MistakeCategory, number>>;
}
