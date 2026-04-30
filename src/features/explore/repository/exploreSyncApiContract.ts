import type {
  ExploreSyncApiRequest,
  ExploreSyncApiResponse,
} from './exploreSyncApiTypes';

export const EXPLORE_SYNC_API_VERSION = 'explore-remote-v0.1';

export const EXPLORE_SYNC_ENDPOINTS = {
  sync: '/api/explore/sync',
  snapshot: '/api/explore/snapshot',
  progress: '/api/explore/progress',
} as const;

export type ExploreSyncEndpointKey = keyof typeof EXPLORE_SYNC_ENDPOINTS;

export interface ExploreSyncApiContract {
  version: typeof EXPLORE_SYNC_API_VERSION;
  endpoints: typeof EXPLORE_SYNC_ENDPOINTS;
  methods: {
    sync: 'POST';
    snapshot: 'GET';
    progress: 'GET';
  };
  requestExample: ExploreSyncApiRequest;
  successResponseExample: ExploreSyncApiResponse;
  failureResponseExample: ExploreSyncApiResponse;
}
