import type {
  ExploreSyncClient,
  ExploreSyncClientResult,
} from './exploreSyncClientTypes';
import type { ExploreRemoteSnapshot } from './exploreRemoteTypes';

function wait(ms: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

export const mockExploreSyncClient: ExploreSyncClient = {
  async syncSnapshot(
    snapshot: ExploreRemoteSnapshot,
  ): Promise<ExploreSyncClientResult> {
    await wait(400);

    const total =
      snapshot.completedNodes.length +
      snapshot.taskResults.length +
      snapshot.mediaTasks.length;

    if (total === 0) {
      return {
        ok: false,
        message: 'Empty snapshot cannot be synced.',
        syncedAt: new Date().toISOString(),
      };
    }

    return {
      ok: true,
      remoteBatchId: `mock-remote-${Date.now()}`,
      message: `Mock synced ${total} records.`,
      syncedAt: new Date().toISOString(),
    };
  },
};

export const failingMockExploreSyncClient: ExploreSyncClient = {
  async syncSnapshot(): Promise<ExploreSyncClientResult> {
    await wait(300);

    return {
      ok: false,
      message: 'Mock sync failed intentionally.',
      syncedAt: new Date().toISOString(),
    };
  },
};
