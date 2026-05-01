import type { ExploreRemoteSnapshot } from './exploreRemoteTypes';
import type { ExploreLearningProfile } from '../profile/exploreLearningProfileTypes';
import type {
  RemoteExploreTransferAttempt,
  ExploreTransferTargetTask,
} from './exploreRemoteTypes';

export interface ExploreSnapshotApiResponse {
  ok: boolean;
  snapshot: ExploreRemoteSnapshot;
  counts: {
    completedNodes: number;
    taskResults: number;
    mediaTasks: number;
    transferAttempts: number;
  };
  message?: string;
}

export interface ExploreProgressApiResponse {
  ok: boolean;
  progress: {
    completedNodes: number;
    taskResults: number;
    mediaTasks: number;
    transferAttempts: number;
    successfulTransferAttempts: number;
    failedTransferAttempts: number;
    engines: {
      worldEngine: number;
      mindEngine: number;
      meaningEngine: number;
      gameTopologyEngine: number;
      unknown: number;
    };
    averageTaskQuality: number;
    averageTransferRubricScore: number;
    transferEngineScores: {
      worldEngine: number;
      mindEngine: number;
      meaningEngine: number;
      gameTopologyEngine: number;
      unknown: number;
    };
    latestTransferOutcome?: 'success' | 'failure';
    latestTransferRepairNodeKey?: string;
    latestSyncedAt?: string;
  };
  message?: string;
}

export interface ExploreSyncBatchSummary {
  id: string;
  userId?: string | null;
  studentId?: string | null;
  acceptedCompletedNodes: number;
  acceptedTaskResults: number;
  acceptedMediaTasks: number;
  acceptedTransferAttempts: number;
  createdAt: string;
}

export interface ExploreSyncBatchesApiResponse {
  ok: boolean;
  batches: ExploreSyncBatchSummary[];
  message?: string;
}

export interface CreateExploreTransferAttemptRequest {
  userScope?: {
    userId?: string;
    studentId?: string;
    deviceId?: string;
    sessionId?: string;
  };
  sourceNodeKey: string;
  sourceEvidenceId?: string;
  targetDomain?: string;
  targetTask?: Partial<ExploreTransferTargetTask>;
  userApplication: string;
}

export interface CreateExploreTransferAttemptApiResponse {
  ok: boolean;
  transferAttempt: RemoteExploreTransferAttempt;
  profileBefore: ExploreLearningProfile;
  profileAfter: ExploreLearningProfile;
  progressAfter: ExploreProgressApiResponse['progress'];
  message?: string;
}

export interface ExploreTransferAttemptsApiResponse {
  ok: boolean;
  transferAttempts: RemoteExploreTransferAttempt[];
  message?: string;
}
