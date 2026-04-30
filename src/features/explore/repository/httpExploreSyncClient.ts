import type {
  ExploreSyncClient,
  ExploreSyncClientResult,
} from './exploreSyncClientTypes';
import type {
  ExploreSyncApiRequest,
  ExploreSyncApiResponse,
} from './exploreSyncApiTypes';
import { validateExploreSyncApiRequest } from './exploreSyncApiValidators';
import type { ExploreRemoteSnapshot } from './exploreRemoteTypes';
import { buildMobiusHeaders, getMobiusRequestStudentId } from '../../../lib/mobius-auth';

const DEFAULT_ENDPOINT = '/api/explore/sync';

export function getExploreSyncEndpoint() {
  return import.meta.env.VITE_EXPLORE_SYNC_ENDPOINT || DEFAULT_ENDPOINT;
}

function getAppVersion() {
  return import.meta.env.VITE_APP_VERSION || 'local-dev';
}

function scopeSnapshotToAuthenticatedStudent(
  snapshot: ExploreRemoteSnapshot,
): ExploreRemoteSnapshot {
  const studentId = getMobiusRequestStudentId();
  const userScope = {
    ...snapshot.userScope,
    userId: studentId,
    studentId,
  };
  const scopeItem = <T extends { userScope: ExploreRemoteSnapshot['userScope'] }>(item: T): T => ({
    ...item,
    userScope: {
      ...item.userScope,
      userId: studentId,
      studentId,
    },
  });

  return {
    ...snapshot,
    userScope,
    completedNodes: snapshot.completedNodes.map(scopeItem),
    taskResults: snapshot.taskResults.map(scopeItem),
    mediaTasks: snapshot.mediaTasks.map(scopeItem),
  };
}

export const httpExploreSyncClient: ExploreSyncClient = {
  async syncSnapshot(
    snapshot: ExploreRemoteSnapshot,
  ): Promise<ExploreSyncClientResult> {
    const scopedSnapshot = scopeSnapshotToAuthenticatedStudent(snapshot);
    const requestBody: ExploreSyncApiRequest = {
      snapshot: scopedSnapshot,
      clientMeta: {
        appVersion: getAppVersion(),
        schemaVersion: 'explore-remote-v0.1',
        source: 'web',
      },
    };

    const validation = validateExploreSyncApiRequest(requestBody);

    if (!validation.ok) {
      return {
        ok: false,
        message: validation.errors
          .map((error) => `${error.code}: ${error.message}`)
          .join('; '),
        syncedAt: new Date().toISOString(),
      };
    }

    const response = await fetch(getExploreSyncEndpoint(), {
      method: 'POST',
      headers: await buildMobiusHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(requestBody),
    });

    let data: ExploreSyncApiResponse | null = null;

    try {
      data = (await response.json()) as ExploreSyncApiResponse;
    } catch {
      data = null;
    }

    if (!response.ok) {
      return {
        ok: false,
        message:
          data?.message ||
          `HTTP sync failed with status ${response.status}`,
        syncedAt: new Date().toISOString(),
      };
    }

    if (!data?.ok) {
      return {
        ok: false,
        message:
          data?.message ||
          data?.errors?.map((error) => error.message).join('; ') ||
          'Sync API returned ok=false.',
        syncedAt: data?.syncedAt || new Date().toISOString(),
      };
    }

    return {
      ok: true,
      remoteBatchId: data.remoteBatchId,
      message:
        data.message ||
        `Synced completedNodes=${data.acceptedCounts?.completedNodes ?? 0}, taskResults=${data.acceptedCounts?.taskResults ?? 0}, mediaTasks=${data.acceptedCounts?.mediaTasks ?? 0}`,
      syncedAt: data.syncedAt,
    };
  },
};
