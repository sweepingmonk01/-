import type { KnowledgeActionType, MistakeCategory } from '../../learning/domain/protocol.js';
import type { CognitiveState, InteractionOutcome, LearningSignalInput } from '../../mobius/domain/types.js';

export type StudentStateSnapshotSource = 'session-created' | 'interaction-resolved';

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

export interface StudentStateSummary {
  studentId: string;
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
