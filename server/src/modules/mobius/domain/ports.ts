import type {
  CognitiveState,
  CompatibleCognitiveState,
  LearningSignalInput,
  MediaJobRecord,
  SeedancePromptBundle,
  StoryBeatPlan,
  StrategyDecision,
  StrategySchedulerInput,
  StudentContext,
} from './types.js';

export interface CognitiveStateEngine {
  resolve(input: LearningSignalInput | undefined, previous: CompatibleCognitiveState | undefined): CognitiveState;
}

export interface StoryPlanner {
  plan(context: StudentContext, cognitiveState: CognitiveState, strategyDecision: StrategyDecision): Promise<StoryBeatPlan>;
}

export interface StrategyScheduler {
  decide(input: StrategySchedulerInput): StrategyDecision;
}

export interface VideoGenerationClient {
  createVideo(prompt: SeedancePromptBundle, context: StudentContext): Promise<Pick<MediaJobRecord, 'provider' | 'status' | 'providerJobId' | 'playbackUrl'>>;
  getVideoStatus?(job: MediaJobRecord): Promise<Pick<MediaJobRecord, 'status' | 'playbackUrl' | 'errorMessage'>>;
}

export interface MediaJobRepository {
  create(record: Omit<MediaJobRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<MediaJobRecord>;
  getById(id: string): Promise<MediaJobRecord | null>;
  listByStudent(studentId: string): Promise<MediaJobRecord[]>;
  update(id: string, changes: Partial<Omit<MediaJobRecord, 'id' | 'studentId' | 'createdAt'>>): Promise<MediaJobRecord | null>;
}
