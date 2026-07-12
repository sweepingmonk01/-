import type { KnowledgeActionType, MistakeCategory } from '../../learning/domain/protocol.js';
import type { InteractionOutcome, LearningSignalInput } from '../../mobius/domain/types.js';
import type { CognitiveState, CompatibleCognitiveState } from '../../../../../shared/cognitive-state.js';

export type { CognitiveState, CompatibleCognitiveState } from '../../../../../shared/cognitive-state.js';

export type StudentStateSnapshotSource = 'session-created' | 'interaction-resolved' | 'foundation-exploration' | 'practice-interaction';

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

export interface InteractionKernelDiff {
  occurredAt: string;
  outcome: InteractionOutcome;
  before: { time: number; signalNoiseRatio: number; emotion: number };
  after: { time: number; signalNoiseRatio: number; emotion: number };
  delta: { time: number; signalNoiseRatio: number; emotion: number };
}

// 知识节点掌握度的可见快照，作为成长层（game-topology 第 4 节）反馈。
// 服务端把 vector.mastery 中最值得展示的 N 个节点筛出来并附上人类可读 label。
export interface TopMasteryNode {
  key: string;
  label: string;
  score: number;
  confidence: number;
  lastEvidenceAt?: string;
}

// 运营层（game-topology 第 4 节最后一层）的可见快照。
// 由 shared/weekly-rhythm.ts 计算后直接序列化输出，不在这里重复定义结构。
import type { WeeklyRhythm } from '../../../../../shared/weekly-rhythm.js';
export type { WeeklyRhythm } from '../../../../../shared/weekly-rhythm.js';

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
  // 最近一次 interaction-resolved 的 kernel 三轴前后对比。用于把
  // "状态驱动学习"从抽象概念落到学生能直接看到的可视化反馈。
  lastInteractionDiff?: InteractionKernelDiff;
  // 成长层可见快照：按证据强度排序后的 top N 节点。
  topMasteryNodes?: TopMasteryNode[];
  // 运营层可见快照：本周 7 天节奏。
  weeklyRhythm?: WeeklyRhythm;
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
