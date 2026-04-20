import type { DiagnosedMistakePattern, ErrorRecord, KnowledgeAction } from '../../learning/domain/protocol.js';

export type EmotionLabel = 'calm' | 'focused' | 'encouraging' | 'protective' | 'urgent';

export interface CognitiveState {
  focus: number;
  frustration: number;
  joy: number;
  confidence: number;
  fatigue: number;
}

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
  previousState?: Partial<CognitiveState>;
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
  outcome: InteractionOutcome;
  title: string;
  narration: string;
  coachMessage: string;
  nextActions: string[];
  adjudication?: {
    outcome: InteractionOutcome;
    rationale: string[];
  };
  video?: MediaAsset;
}

export interface SeedancePromptBundle {
  title: string;
  visualStyle: string;
  prompt: string;
  durationSeconds: number;
  aspectRatio: '9:16' | '16:9' | '1:1';
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
  sessionId: string;
  studentId: string;
  createdAt: string;
  cognitiveState: CognitiveState;
  errorProfile: ErrorRecord;
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
