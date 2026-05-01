import type { ExploreRemoteSnapshot } from './exploreRemoteTypes';

export interface ExploreSnapshotApiResponse {
  ok: boolean;
  snapshot: ExploreRemoteSnapshot;
  counts: {
    completedNodes: number;
    taskResults: number;
    mediaTasks: number;
  };
  message?: string;
}

export interface ExploreProgressApiResponse {
  ok: boolean;
  progress: {
    completedNodes: number;
    taskResults: number;
    mediaTasks: number;
    engines: {
      worldEngine: number;
      mindEngine: number;
      meaningEngine: number;
      gameTopologyEngine: number;
      unknown: number;
    };
    averageTaskQuality: number;
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
  createdAt: string;
}

export interface ExploreSyncBatchesApiResponse {
  ok: boolean;
  batches: ExploreSyncBatchSummary[];
  message?: string;
}
