import type { ExploreRemoteSnapshot } from './exploreRemoteTypes';

export interface ExploreSyncQueueItem {
  id: string;
  snapshot: ExploreRemoteSnapshot;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  errorMessage?: string;
  remoteBatchId?: string;
  syncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExploreSyncQueueStats {
  total: number;
  pending: number;
  syncing: number;
  synced: number;
  failed: number;
}

const STORAGE_KEY = 'explore.syncQueue';

function hasLocalStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function safeParseArray<T>(raw: string | null): T[] {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function nowIso() {
  return new Date().toISOString();
}

export function getExploreSyncQueue(): ExploreSyncQueueItem[] {
  if (!hasLocalStorage()) return [];

  return safeParseArray<ExploreSyncQueueItem>(
    window.localStorage.getItem(STORAGE_KEY),
  );
}

export function enqueueExploreSyncSnapshot(
  snapshot: ExploreRemoteSnapshot,
): ExploreSyncQueueItem {
  const timestamp = nowIso();

  const item: ExploreSyncQueueItem = {
    id: `sync-${Date.now()}`,
    snapshot,
    status: 'pending',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  if (!hasLocalStorage()) return item;

  const existing = getExploreSyncQueue();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([item, ...existing]));

  return item;
}

export function updateExploreSyncQueueItem(
  itemId: string,
  patch: Partial<
    Pick<
      ExploreSyncQueueItem,
      'status' | 'errorMessage' | 'remoteBatchId' | 'syncedAt'
    >
  >,
) {
  if (!hasLocalStorage()) return;

  const existing = getExploreSyncQueue();

  const next = existing.map((item) =>
    item.id === itemId
      ? {
          ...item,
          ...patch,
          updatedAt: nowIso(),
        }
      : item,
  );

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearExploreSyncQueue() {
  if (!hasLocalStorage()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function getPendingExploreSyncQueueItems() {
  return getExploreSyncQueue().filter((item) => item.status === 'pending');
}

export function getExploreSyncQueueStats(): ExploreSyncQueueStats {
  const items = getExploreSyncQueue();

  return {
    total: items.length,
    pending: items.filter((item) => item.status === 'pending').length,
    syncing: items.filter((item) => item.status === 'syncing').length,
    synced: items.filter((item) => item.status === 'synced').length,
    failed: items.filter((item) => item.status === 'failed').length,
  };
}
