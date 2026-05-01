import { Router, type Request, type Response } from 'express';
import { buildExploreLearningProfile } from '../profile/buildExploreLearningProfile.js';
import { MemoryExploreSyncStore } from '../storage/exploreSyncMemoryStore.js';
import type { ExploreScopeFilter, ExploreSyncStore } from '../storage/exploreSyncStoreTypes.js';

const EXPLORE_REMOTE_SCHEMA_VERSION = 'explore-remote-v0.1';

interface ExploreSyncValidationError {
  code: string;
  message: string;
  path?: string;
}

function createFailureResponse(message: string, errors: ExploreSyncValidationError[]) {
  return {
    ok: false,
    syncedAt: new Date().toISOString(),
    message,
    errors,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateExploreSyncRequest(body: unknown) {
  const errors: ExploreSyncValidationError[] = [];

  if (!isRecord(body)) {
    errors.push({
      code: 'INVALID_REQUEST',
      message: 'Request body must be an object.',
      path: 'body',
    });
    return errors;
  }

  const snapshot = body.snapshot;
  const clientMeta = body.clientMeta;

  if (!isRecord(snapshot)) {
    errors.push({
      code: 'MISSING_SNAPSHOT',
      message: 'snapshot is required.',
      path: 'snapshot',
    });
  }

  if (!isRecord(clientMeta)) {
    errors.push({
      code: 'MISSING_CLIENT_META',
      message: 'clientMeta is required.',
      path: 'clientMeta',
    });
  }

  if (!isRecord(snapshot) || !isRecord(clientMeta)) {
    return errors;
  }

  if (snapshot.schemaVersion !== EXPLORE_REMOTE_SCHEMA_VERSION) {
    errors.push({
      code: 'INVALID_SCHEMA_VERSION',
      message: `Expected schemaVersion ${EXPLORE_REMOTE_SCHEMA_VERSION}.`,
      path: 'snapshot.schemaVersion',
    });
  }

  if (clientMeta.schemaVersion !== EXPLORE_REMOTE_SCHEMA_VERSION) {
    errors.push({
      code: 'INVALID_CLIENT_SCHEMA_VERSION',
      message: `Expected clientMeta.schemaVersion ${EXPLORE_REMOTE_SCHEMA_VERSION}.`,
      path: 'clientMeta.schemaVersion',
    });
  }

  if (!isRecord(snapshot.userScope)) {
    errors.push({
      code: 'MISSING_USER_SCOPE',
      message: 'userScope is required.',
      path: 'snapshot.userScope',
    });
  }

  if (!Array.isArray(snapshot.completedNodes)) {
    errors.push({
      code: 'INVALID_COMPLETED_NODES',
      message: 'completedNodes must be an array.',
      path: 'snapshot.completedNodes',
    });
  }

  if (!Array.isArray(snapshot.taskResults)) {
    errors.push({
      code: 'INVALID_TASK_RESULTS',
      message: 'taskResults must be an array.',
      path: 'snapshot.taskResults',
    });
  }

  if (!Array.isArray(snapshot.mediaTasks)) {
    errors.push({
      code: 'INVALID_MEDIA_TASKS',
      message: 'mediaTasks must be an array.',
      path: 'snapshot.mediaTasks',
    });
  }

  if (errors.length > 0) {
    return errors;
  }

  const total =
    (snapshot.completedNodes as unknown[]).length +
    (snapshot.taskResults as unknown[]).length +
    (snapshot.mediaTasks as unknown[]).length;

  if (total === 0) {
    errors.push({
      code: 'EMPTY_SNAPSHOT',
      message: 'Snapshot contains no records.',
      path: 'snapshot',
    });
  }

  return errors;
}

function readQueryString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readScopeFilter(query: Record<string, unknown>): ExploreScopeFilter {
  return {
    userId: readQueryString(query.userId),
    studentId: readQueryString(query.studentId),
    deviceId: readQueryString(query.deviceId),
    sessionId: readQueryString(query.sessionId),
  };
}

function resolveTrustedScope(
  req: Request,
  res: Response,
  requestedScope: ExploreScopeFilter,
): ExploreScopeFilter | null {
  const currentUserId = req.authContext?.currentUserId;
  if (!currentUserId) return requestedScope;

  const conflictingField = (['userId', 'studentId'] as const).find((key) =>
    Boolean(requestedScope[key]) && requestedScope[key] !== currentUserId,
  );

  if (conflictingField) {
    res.status(403).json({
      ok: false,
      message: `${conflictingField} does not match the authenticated user.`,
    });
    return null;
  }

  return {
    ...requestedScope,
    userId: currentUserId,
    studentId: currentUserId,
  };
}

function readScopeFromSnapshot(snapshot: Record<string, unknown>): ExploreScopeFilter {
  return readScopeFilter(isRecord(snapshot.userScope) ? snapshot.userScope : {});
}

function scopeRecord(value: unknown, trustedScope: ExploreScopeFilter) {
  return {
    ...(isRecord(value) ? value : {}),
    ...trustedScope,
  };
}

function applyTrustedScopeToSnapshot(
  snapshot: Record<string, unknown>,
  trustedScope: ExploreScopeFilter,
) {
  return {
    ...snapshot,
    userScope: scopeRecord(snapshot.userScope, trustedScope),
    completedNodes: Array.isArray(snapshot.completedNodes)
      ? snapshot.completedNodes.map((item) => ({
          ...(isRecord(item) ? item : {}),
          userScope: scopeRecord(isRecord(item) ? item.userScope : undefined, trustedScope),
        }))
      : snapshot.completedNodes,
    taskResults: Array.isArray(snapshot.taskResults)
      ? snapshot.taskResults.map((item) => ({
          ...(isRecord(item) ? item : {}),
          userScope: scopeRecord(isRecord(item) ? item.userScope : undefined, trustedScope),
        }))
      : snapshot.taskResults,
    mediaTasks: Array.isArray(snapshot.mediaTasks)
      ? snapshot.mediaTasks.map((item) => ({
          ...(isRecord(item) ? item : {}),
          userScope: scopeRecord(isRecord(item) ? item.userScope : undefined, trustedScope),
        }))
      : snapshot.mediaTasks,
  };
}

function readLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 20;
  return Math.max(1, Math.min(100, Math.round(parsed)));
}

export function createExploreSyncRouter(store: ExploreSyncStore = new MemoryExploreSyncStore()) {
  const router = Router();

  router.post('/sync', (req, res) => {
    const errors = validateExploreSyncRequest(req.body);

    if (errors.length > 0) {
      res.status(400).json(createFailureResponse(errors[0]?.message ?? 'Invalid sync request.', errors));
      return;
    }

    const trustedScope = resolveTrustedScope(req, res, readScopeFromSnapshot(req.body.snapshot));
    if (!trustedScope) return;
    const snapshot = applyTrustedScopeToSnapshot(req.body.snapshot, trustedScope);
    const result = store.save({
      snapshot,
      clientMeta: req.body.clientMeta,
    });

    const total =
      result.acceptedCounts.completedNodes +
      result.acceptedCounts.taskResults +
      result.acceptedCounts.mediaTasks;

    res.json({
      ok: true,
      remoteBatchId: result.remoteBatchId,
      syncedAt: result.syncedAt,
      acceptedCounts: result.acceptedCounts,
      message: `Synced ${total} explore records.`,
    });
  });

  router.get('/snapshot', (req, res) => {
    const trustedScope = resolveTrustedScope(req, res, readScopeFilter(req.query));
    if (!trustedScope) return;
    const result = store.getSnapshot(trustedScope);

    res.json({
      ok: true,
      snapshot: result.snapshot,
      counts: result.counts,
    });
  });

  router.get('/progress', (req, res) => {
    const trustedScope = resolveTrustedScope(req, res, readScopeFilter(req.query));
    if (!trustedScope) return;

    res.json({
      ok: true,
      progress: store.getProgress(trustedScope),
    });
  });

  router.get('/profile', (req, res) => {
    const trustedScope = resolveTrustedScope(req, res, readScopeFilter(req.query));
    if (!trustedScope) return;
    const progress = store.getProgress(trustedScope);

    res.json({
      ok: true,
      profile: buildExploreLearningProfile(progress),
      progress,
      generatedAt: new Date().toISOString(),
    });
  });

  router.post('/profile/snapshot', (req, res) => {
    const userScope = resolveTrustedScope(req, res, readScopeFilter(req.query));
    if (!userScope) return;
    const progress = store.getProgress(userScope);
    const profile = buildExploreLearningProfile(progress);
    const generatedAt = new Date().toISOString();

    try {
      store.saveProfileSnapshot({
        userScope,
        progress,
        profile,
        generatedAt,
        source: 'manual',
        createdBy: 'learner',
      });

      res.json({
        ok: true,
        profile,
        progress,
        generatedAt,
        snapshotSaved: true,
        message: '御风快照已保存。',
      });
    } catch {
      res.status(500).json({
        ok: false,
        profile,
        progress,
        generatedAt,
        snapshotSaved: false,
        message: '画像已生成，但快照保存失败。',
      });
    }
  });

  router.get('/profile/history', (req, res) => {
    const trustedScope = resolveTrustedScope(req, res, readScopeFilter(req.query));
    if (!trustedScope) return;

    res.json({
      ok: true,
      snapshots: store.getProfileHistory({
        ...trustedScope,
        limit: readLimit(req.query.limit),
      }),
    });
  });

  router.get('/sync/batches', (req, res) => {
    const trustedScope = resolveTrustedScope(req, res, readScopeFilter(req.query));
    if (!trustedScope) return;

    res.json({
      ok: true,
      batches: store.listBatches({
        ...trustedScope,
        limit: readLimit(req.query.limit),
      }),
    });
  });

  return router;
}

export const exploreSyncRouter = createExploreSyncRouter();
