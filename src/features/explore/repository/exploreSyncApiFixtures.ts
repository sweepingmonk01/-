import type {
  ExploreSyncApiRequest,
  ExploreSyncApiResponse,
} from './exploreSyncApiTypes';
import type { ExploreRemoteSnapshot } from './exploreRemoteTypes';

export function buildExploreSyncApiRequestFixture(
  snapshot: ExploreRemoteSnapshot,
): ExploreSyncApiRequest {
  return {
    snapshot,
    clientMeta: {
      appVersion: 'local-dev',
      schemaVersion: 'explore-remote-v0.1',
      source: 'web',
    },
  };
}

export function buildExploreSyncSuccessResponseFixture(input?: {
  remoteBatchId?: string;
  completedNodes?: number;
  taskResults?: number;
  mediaTasks?: number;
}): ExploreSyncApiResponse {
  return {
    ok: true,
    remoteBatchId: input?.remoteBatchId ?? `fixture-batch-${Date.now()}`,
    syncedAt: new Date().toISOString(),
    acceptedCounts: {
      completedNodes: input?.completedNodes ?? 0,
      taskResults: input?.taskResults ?? 0,
      mediaTasks: input?.mediaTasks ?? 0,
    },
    message: 'Fixture sync success.',
  };
}

export function buildExploreSyncFailureResponseFixture(): ExploreSyncApiResponse {
  return {
    ok: false,
    syncedAt: new Date().toISOString(),
    message: 'Fixture sync failure.',
    errors: [
      {
        code: 'INVALID_SNAPSHOT',
        message: 'Snapshot schema is invalid.',
        path: 'snapshot',
      },
    ],
  };
}
