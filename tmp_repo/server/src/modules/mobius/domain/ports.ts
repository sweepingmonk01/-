import type {
  CognitiveState,
  LearningSignalInput,
  MediaJobRecord,
  SeedancePromptBundle,
  StoryBeatPlan,
  StudentContext,
} from './types.js';

export interface CognitiveStateEngine {
  resolve(input: LearningSignalInput | undefined, previous: Partial<CognitiveState> | undefined): CognitiveState;
}

export interface StoryPlanner {
  plan(context: StudentContext, cognitiveState: CognitiveState): Promise<StoryBeatPlan>;
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
