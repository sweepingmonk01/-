import type { ExploreSyncApiRequest } from './exploreSyncApiTypes';
import type { ExploreRemoteSnapshot } from './exploreRemoteTypes';

export interface ExploreSyncValidationResult {
  ok: boolean;
  errors: {
    code: string;
    message: string;
    path?: string;
  }[];
}

export function validateExploreRemoteSnapshot(
  snapshot: ExploreRemoteSnapshot,
): ExploreSyncValidationResult {
  const errors: ExploreSyncValidationResult['errors'] = [];

  if (!snapshot) {
    errors.push({
      code: 'MISSING_SNAPSHOT',
      message: 'Snapshot is required.',
      path: 'snapshot',
    });

    return {
      ok: false,
      errors,
    };
  }

  if (snapshot.schemaVersion !== 'explore-remote-v0.1') {
    errors.push({
      code: 'INVALID_SCHEMA_VERSION',
      message: 'Expected schemaVersion explore-remote-v0.1.',
      path: 'snapshot.schemaVersion',
    });
  }

  if (!snapshot.userScope) {
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

  const total =
    (snapshot.completedNodes?.length ?? 0) +
    (snapshot.taskResults?.length ?? 0) +
    (snapshot.mediaTasks?.length ?? 0);

  if (total === 0) {
    errors.push({
      code: 'EMPTY_SNAPSHOT',
      message: 'Snapshot contains no records.',
      path: 'snapshot',
    });
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function validateExploreSyncApiRequest(
  request: ExploreSyncApiRequest,
): ExploreSyncValidationResult {
  const errors: ExploreSyncValidationResult['errors'] = [];

  if (!request.clientMeta) {
    errors.push({
      code: 'MISSING_CLIENT_META',
      message: 'clientMeta is required.',
      path: 'clientMeta',
    });
  }

  if (request.clientMeta?.schemaVersion !== 'explore-remote-v0.1') {
    errors.push({
      code: 'INVALID_CLIENT_SCHEMA_VERSION',
      message: 'clientMeta.schemaVersion must be explore-remote-v0.1.',
      path: 'clientMeta.schemaVersion',
    });
  }

  const snapshotValidation = validateExploreRemoteSnapshot(request.snapshot);

  return {
    ok: errors.length === 0 && snapshotValidation.ok,
    errors: [...errors, ...snapshotValidation.errors],
  };
}
