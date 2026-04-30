import type { ExploreSyncClient } from './exploreSyncClientTypes';
import { getDefaultExploreSyncClient } from './exploreSyncClientFactory';
import {
  getExploreSyncQueue,
  updateExploreSyncQueueItem,
  type ExploreSyncQueueItem,
} from './exploreSyncQueue';

export interface ExploreSyncRunResult {
  totalPending: number;
  synced: number;
  failed: number;
  results: {
    itemId: string;
    status: 'synced' | 'failed';
    message?: string;
    remoteBatchId?: string;
  }[];
}

export async function runExploreSyncQueue(input?: {
  client?: ExploreSyncClient;
  onlyPending?: boolean;
}): Promise<ExploreSyncRunResult> {
  const client = input?.client ?? getDefaultExploreSyncClient();
  const allItems = getExploreSyncQueue();
  const targetItems =
    input?.onlyPending === false
      ? allItems
      : allItems.filter((item) => item.status === 'pending');

  const results: ExploreSyncRunResult['results'] = [];

  for (const item of targetItems) {
    updateExploreSyncQueueItem(item.id, {
      status: 'syncing',
      errorMessage: undefined,
    });

    try {
      const result = await client.syncSnapshot(item.snapshot);

      if (result.ok) {
        updateExploreSyncQueueItem(item.id, {
          status: 'synced',
          remoteBatchId: result.remoteBatchId,
          syncedAt: result.syncedAt,
          errorMessage: undefined,
        });

        results.push({
          itemId: item.id,
          status: 'synced',
          message: result.message,
          remoteBatchId: result.remoteBatchId,
        });
      } else {
        updateExploreSyncQueueItem(item.id, {
          status: 'failed',
          errorMessage: result.message ?? 'Unknown sync failure.',
        });

        results.push({
          itemId: item.id,
          status: 'failed',
          message: result.message,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown sync exception.';

      updateExploreSyncQueueItem(item.id, {
        status: 'failed',
        errorMessage: message,
      });

      results.push({
        itemId: item.id,
        status: 'failed',
        message,
      });
    }
  }

  return {
    totalPending: targetItems.length,
    synced: results.filter((item) => item.status === 'synced').length,
    failed: results.filter((item) => item.status === 'failed').length,
    results,
  };
}

export function getLatestExploreSyncItem(): ExploreSyncQueueItem | null {
  return getExploreSyncQueue()[0] ?? null;
}
