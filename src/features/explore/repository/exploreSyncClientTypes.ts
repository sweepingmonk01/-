import type { ExploreRemoteSnapshot } from './exploreRemoteTypes';

export interface ExploreSyncClientResult {
  ok: boolean;
  remoteBatchId?: string;
  message?: string;
  syncedAt: string;
}

export interface ExploreSyncClient {
  syncSnapshot(snapshot: ExploreRemoteSnapshot): Promise<ExploreSyncClientResult>;
}
