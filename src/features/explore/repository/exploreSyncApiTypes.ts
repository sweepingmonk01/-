import type { ExploreRemoteSnapshot } from './exploreRemoteTypes';

export interface ExploreSyncApiRequest {
  snapshot: ExploreRemoteSnapshot;
  clientMeta: {
    appVersion: string;
    schemaVersion: 'explore-remote-v0.1';
    source: 'web';
  };
}

export interface ExploreSyncAcceptedCounts {
  completedNodes: number;
  taskResults: number;
  mediaTasks: number;
}

export interface ExploreSyncApiErrorItem {
  code: string;
  message: string;
  path?: string;
}

export interface ExploreSyncApiResponse {
  ok: boolean;
  remoteBatchId?: string;
  syncedAt: string;
  acceptedCounts?: ExploreSyncAcceptedCounts;
  errors?: ExploreSyncApiErrorItem[];
  message?: string;
}
