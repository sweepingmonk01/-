import type { DiagnosedMistakePattern, ErrorRecord, KnowledgeAction } from '../../learning/domain/protocol.js';
import type { SocraticThread } from '../../ai/domain/types.js';
import type { StudentStateVector } from '../../student-state/domain/types.js';
import type {
  CognitiveState,
  CompatibleCognitiveState,
} from '../../../../../shared/cognitive-state.js';

export type EmotionLabel = 'calm' | 'focused' | 'encouraging' | 'protective' | 'urgent';
export type { CognitiveState, CompatibleCognitiveState, LegacyCognitiveState } from '../../../../../shared/cognitive-state.js';

export interface LearningSignalInput {
  responseTimeMs?: number;
  attempts?: number;
  scrollBurstCount?: number;
  correctStreak?: number;
  wrongStreak?: number;
  timeSavedMinutes?: number;
}

export interface StudentContext {
  studentId: string;
  targetScore?: number;
  grade?: string;
  painPoint: string;
  rule: string;
  questionText?: string;
  diagnosedMistakes?: DiagnosedMistakePattern[];
  knowledgeAction?: KnowledgeAction;
  timeSavedMinutes?: number;
  previousState?: CompatibleCognitiveState;
  learningSignals?: LearningSignalInput;
}

export interface StoryBeatPlan {
  sceneIntro: string;
  emotion: EmotionLabel;
  interactionPrompt: string;
  successScene: string;
  failureScene: string;
  visualStyle: string;
  knowledgeAction?: KnowledgeAction;
  strategyDecision: StrategyDecision;
}

export type StrategyKind = 'probe' | 'teach' | 'review';

export type StrategyFeatureKey =
  | 'painPointRecurrence'
  | 'timePressure'
  | 'noisePressure'
  | 'emotionRisk'
  | 'masteryGap'
  | 'recentFailurePressure'
  | 'recentSuccessRecovery';

export interface StrategyScoreFeature {
  label: string;
  value: number;
  weight: number;
  contribution: number;
}

export type StrategyScoreBreakdown = Record<StrategyFeatureKey, StrategyScoreFeature>;

export interface StrategyCandidate {
  strategy: StrategyKind;
  baseScore: number;
  score: number;
  scoreBreakdown: StrategyScoreBreakdown;
  rationale: string;
}

export interface StrategyDecision {
  candidates: StrategyCandidate[];
  selectedStrategy: StrategyKind;
}

export interface StrategySchedulerInput {
  context: StudentContext;
  cognitiveState: CognitiveState;
  stateVector?: StudentStateVector | null;
}

export type InteractionOutcome = 'success' | 'failure';
export type InteractionConfidence = 'low' | 'medium' | 'high';

export interface InteractionSubmission {
  actionId?: string;
  actionType?: KnowledgeAction['actionType'];
  completed?: boolean;
  confidence?: InteractionConfidence;
  selfCheck?: 'aligned' | 'partial' | 'guess';
  note?: string;
}

export interface InteractionRecord {
  outcome: InteractionOutcome;
  actionType?: string;
  submission?: InteractionSubmission;
  createdAt: string;
}

export interface InteractionResolution {
  cycleId?: string;
  outcome: InteractionOutcome;
  title: string;
  narration: string;
  coachMessage: string;
  nextActions: string[];
  strategyDecision: StrategyDecision;
  adjudication?: {
    outcome: InteractionOutcome;
    rationale: string[];
  };
  video?: MediaAsset;
  diagnosticThread?: SocraticThread;
}

export interface SeedancePromptBundle {
  title: string;
  visualStyle: string;
  prompt: string;
  durationSeconds: number;
  aspectRatio: '9:16' | '16:9' | '1:1';
  referenceImages?: string[];
  audioMode?: 'none' | 'ambient' | 'speech';
  resolution?: '480p' | '720p' | '1080p';
  webhookUrl?: string;
  fallbackStoryboard: string[];
}

export interface MediaAsset {
  kind: 'video';
  status: 'queued' | 'processing' | 'ready' | 'failed';
  jobId?: string;
  playbackUrl?: string;
  providerJobId?: string;
  provider: 'seedance' | 'stub' | 'seedance-http';
  branchOutcome?: InteractionOutcome;
}

export interface MobiusSessionPlan {
  cycleId: string;
  sessionId: string;
  studentId: string;
  createdAt: string;
  cognitiveState: CognitiveState;
  errorProfile: ErrorRecord;
  strategyDecision: StrategyDecision;
  story: StoryBeatPlan;
  video: MediaAsset;
  nextActions: string[];
}

export interface MediaJobRecord {
  id: string;
  studentId: string;
  createdAt: string;
  updatedAt: string;
  parentJobId?: string;
  branchOutcome?: InteractionOutcome;
  provider: 'seedance' | 'stub' | 'seedance-http';
  providerJobId?: string;
  status: 'queued' | 'processing' | 'ready' | 'failed';
  promptBundle: SeedancePromptBundle;
  story?: StoryBeatPlan;
  playbackUrl?: string;
  errorMessage?: string;
  interactions?: InteractionRecord[];
}
