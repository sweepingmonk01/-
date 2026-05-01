import type {
  ExploreProgressApiResponse,
  ExploreSnapshotApiResponse,
  ExploreSyncBatchesApiResponse,
} from './exploreRemoteReadTypes';
import type {
  ExploreProfileApiResponse,
  ExploreProfileHistoryApiResponse,
  SaveExploreProfileSnapshotApiResponse,
} from './exploreProfileApiTypes';
import { buildMobiusHeaders, getMobiusRequestStudentId } from '../../../lib/mobius-auth';

const DEFAULT_BASE = '/api/explore';

export interface ExploreRemoteReadScope {
  userId?: string;
  studentId?: string;
  deviceId?: string;
  sessionId?: string;
}

export interface ExploreRemoteReadClient {
  getSnapshot(scope?: ExploreRemoteReadScope): Promise<ExploreSnapshotApiResponse>;
  getProgress(scope?: ExploreRemoteReadScope): Promise<ExploreProgressApiResponse>;
  getProfile(scope?: ExploreRemoteReadScope): Promise<ExploreProfileApiResponse>;
  saveProfileSnapshot(scope?: ExploreRemoteReadScope): Promise<SaveExploreProfileSnapshotApiResponse>;
  getProfileHistory(
    scope?: ExploreRemoteReadScope,
    input?: { limit?: number },
  ): Promise<ExploreProfileHistoryApiResponse>;
  getSyncBatches(input?: { limit?: number }): Promise<ExploreSyncBatchesApiResponse>;
}

function getExploreApiBase() {
  return import.meta.env.VITE_EXPLORE_API_BASE || DEFAULT_BASE;
}

function buildQuery(params: object) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value) search.set(key, value);
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}

function scopeToAuthenticatedStudent(scope: ExploreRemoteReadScope = {}) {
  const studentId = getMobiusRequestStudentId();
  return {
    ...scope,
    userId: studentId,
    studentId,
  };
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T;

  if (!response.ok) {
    const message = data && typeof data === 'object' && 'message' in data
      ? String(data.message)
      : `Explore read request failed with status ${response.status}.`;
    throw new Error(message);
  }

  return data;
}

export const httpExploreReadClient: ExploreRemoteReadClient = {
  async getSnapshot(
    scope: ExploreRemoteReadScope = {},
  ): Promise<ExploreSnapshotApiResponse> {
    const response = await fetch(
      `${getExploreApiBase()}/snapshot${buildQuery(scopeToAuthenticatedStudent(scope))}`,
      {
        headers: await buildMobiusHeaders(),
      },
    );

    return readJsonResponse<ExploreSnapshotApiResponse>(response);
  },

  async getProgress(
    scope: ExploreRemoteReadScope = {},
  ): Promise<ExploreProgressApiResponse> {
    const response = await fetch(
      `${getExploreApiBase()}/progress${buildQuery(scopeToAuthenticatedStudent(scope))}`,
      {
        headers: await buildMobiusHeaders(),
      },
    );

    return readJsonResponse<ExploreProgressApiResponse>(response);
  },

  async getProfile(
    scope: ExploreRemoteReadScope = {},
  ): Promise<ExploreProfileApiResponse> {
    const response = await fetch(
      `${getExploreApiBase()}/profile${buildQuery(scopeToAuthenticatedStudent(scope))}`,
      {
        headers: await buildMobiusHeaders(),
      },
    );

    return readJsonResponse<ExploreProfileApiResponse>(response);
  },

  async saveProfileSnapshot(
    scope: ExploreRemoteReadScope = {},
  ): Promise<SaveExploreProfileSnapshotApiResponse> {
    const response = await fetch(
      `${getExploreApiBase()}/profile/snapshot${buildQuery(scopeToAuthenticatedStudent(scope))}`,
      {
        method: 'POST',
        headers: await buildMobiusHeaders(),
      },
    );

    return readJsonResponse<SaveExploreProfileSnapshotApiResponse>(response);
  },

  async getProfileHistory(
    scope: ExploreRemoteReadScope = {},
    input?: { limit?: number },
  ): Promise<ExploreProfileHistoryApiResponse> {
    const response = await fetch(
      `${getExploreApiBase()}/profile/history${buildQuery({
        ...scopeToAuthenticatedStudent(scope),
        limit: input?.limit ? String(input.limit) : undefined,
      })}`,
      {
        headers: await buildMobiusHeaders(),
      },
    );

    return readJsonResponse<ExploreProfileHistoryApiResponse>(response);
  },

  async getSyncBatches(input?: {
    limit?: number;
  }): Promise<ExploreSyncBatchesApiResponse> {
    const query = buildQuery({
      limit: input?.limit ? String(input.limit) : undefined,
    });

    const response = await fetch(`${getExploreApiBase()}/sync/batches${query}`, {
      headers: await buildMobiusHeaders(),
    });

    return readJsonResponse<ExploreSyncBatchesApiResponse>(response);
  },
};
