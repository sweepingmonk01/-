import type { ExploreSyncClient } from './exploreSyncClientTypes';
import {
  getExploreSyncEndpoint,
  httpExploreSyncClient,
} from './httpExploreSyncClient';
import { mockExploreSyncClient } from './mockExploreSyncClient';

export type ExploreSyncClientMode = 'mock' | 'http';

export function createExploreSyncClient(
  mode: ExploreSyncClientMode = 'mock',
): ExploreSyncClient {
  if (mode === 'http') {
    return httpExploreSyncClient;
  }

  return mockExploreSyncClient;
}

export function getExploreSyncClientMode(): ExploreSyncClientMode {
  return import.meta.env.VITE_EXPLORE_SYNC_CLIENT === 'http' ? 'http' : 'mock';
}

export function getDefaultExploreSyncClient(): ExploreSyncClient {
  return createExploreSyncClient(getExploreSyncClientMode());
}

export function getExploreSyncClientLabel() {
  const mode = getExploreSyncClientMode();
  return mode === 'http'
    ? `HTTP ${getExploreSyncEndpoint()}`
    : 'Mock Transport';
}
