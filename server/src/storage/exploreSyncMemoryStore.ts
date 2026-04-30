import type {
  ExploreLearningProfileHistoryInput,
  ExploreLearningProfileHistoryItem,
  ExploreLearningProfileSnapshotInput,
  ExploreProgressReadResult,
  ExploreScopeFilter,
  ExploreSyncBatchListInput,
  ExploreSnapshotReadResult,
  ExploreSyncSaveResult,
  ExploreSyncBatchSummary,
  ExploreSyncStore,
  SaveExploreSyncSnapshotInput,
} from './exploreSyncStoreTypes.js';

export interface ExploreSyncMemoryRecord {
  remoteBatchId: string;
  syncedAt: string;
  request: SaveExploreSyncSnapshotInput;
  acceptedCounts: {
    completedNodes: number;
    taskResults: number;
    mediaTasks: number;
  };
}

const records: ExploreSyncMemoryRecord[] = [];
const profileSnapshots: Array<ExploreLearningProfileHistoryItem & {
  userScope: ExploreScopeFilter;
}> = [];

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export function saveExploreSyncSnapshot(request: SaveExploreSyncSnapshotInput): ExploreSyncSaveResult {
  const completedNodes = asArray(request.snapshot.completedNodes);
  const taskResults = asArray(request.snapshot.taskResults);
  const mediaTasks = asArray(request.snapshot.mediaTasks);
  const record: ExploreSyncMemoryRecord = {
    remoteBatchId: `batch_${Date.now()}`,
    syncedAt: new Date().toISOString(),
    request,
    acceptedCounts: {
      completedNodes: completedNodes.length,
      taskResults: taskResults.length,
      mediaTasks: mediaTasks.length,
    },
  };

  records.unshift(record);

  return {
    remoteBatchId: record.remoteBatchId,
    syncedAt: record.syncedAt,
    acceptedCounts: record.acceptedCounts,
  };
}

export function getExploreSyncRecords() {
  return records;
}

export function clearExploreSyncRecords() {
  records.splice(0, records.length);
  profileSnapshots.splice(0, profileSnapshots.length);
}

export class MemoryExploreSyncStore implements ExploreSyncStore {
  save(input: SaveExploreSyncSnapshotInput): ExploreSyncSaveResult {
    return saveExploreSyncSnapshot(input);
  }

  getSnapshot(input: ExploreScopeFilter): ExploreSnapshotReadResult {
    const matched: Array<Record<string, unknown>> = records
      .filter((record) => matchesScope(record.request.snapshot.userScope, input))
      .map((record) => record.request.snapshot);
    const completedNodes = matched.flatMap((snapshot) => asArray(snapshot.completedNodes));
    const taskResults = matched.flatMap((snapshot) => asArray(snapshot.taskResults));
    const mediaTasks = matched.flatMap((snapshot) => asArray(snapshot.mediaTasks));

    return {
      snapshot: {
        userScope: input,
        completedNodes: completedNodes as Record<string, unknown>[],
        taskResults: taskResults as Record<string, unknown>[],
        mediaTasks: mediaTasks as Record<string, unknown>[],
        exportedAt: new Date().toISOString(),
        schemaVersion: 'explore-remote-v0.1',
      },
      counts: {
        completedNodes: completedNodes.length,
        taskResults: taskResults.length,
        mediaTasks: mediaTasks.length,
      },
    };
  }

  getProgress(input: ExploreScopeFilter): ExploreProgressReadResult {
    const snapshot = this.getSnapshot(input).snapshot;
    const qualityScores = snapshot.taskResults
      .map((item) => item.qualityScore)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

    return {
      completedNodes: snapshot.completedNodes.length,
      taskResults: snapshot.taskResults.length,
      mediaTasks: snapshot.mediaTasks.length,
      engines: countEngines(snapshot.completedNodes),
      averageTaskQuality: qualityScores.length > 0
        ? qualityScores.reduce((sum, value) => sum + value, 0) / qualityScores.length
        : 0,
      latestSyncedAt: records[0]?.syncedAt,
    };
  }

  listBatches(input: ExploreSyncBatchListInput = {}): ExploreSyncBatchSummary[] {
    const limit = Math.max(1, Math.min(100, Math.round(input?.limit ?? 20)));

    return records
      .filter((record) => matchesScope(record.request.snapshot.userScope, input))
      .slice(0, limit)
      .map((record) => {
        const userScope = record.request.snapshot.userScope as Record<string, unknown> | undefined;

        return {
          id: record.remoteBatchId,
          userId: typeof userScope?.userId === 'string' ? userScope.userId : undefined,
          studentId: typeof userScope?.studentId === 'string' ? userScope.studentId : undefined,
          acceptedCompletedNodes: record.acceptedCounts.completedNodes,
          acceptedTaskResults: record.acceptedCounts.taskResults,
          acceptedMediaTasks: record.acceptedCounts.mediaTasks,
          createdAt: record.syncedAt,
        };
      });
  }

  saveProfileSnapshot(input: ExploreLearningProfileSnapshotInput): ExploreLearningProfileHistoryItem {
    const item: ExploreLearningProfileHistoryItem & { userScope: ExploreScopeFilter } = {
      id: `profile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      worldModelIndex: input.profile.worldModelIndex,
      mindModelIndex: input.profile.mindModelIndex,
      meaningModelIndex: input.profile.meaningModelIndex,
      actionMechanismIndex: input.profile.actionMechanismIndex,
      activeStructuralIntelligence: input.profile.activeStructuralIntelligence,
      dominantStrength: input.profile.dominantStrength,
      dominantWeakness: input.profile.dominantWeakness,
      stage: input.profile.stage,
      recommendedNodeKey: input.profile.recommendedNodeKey,
      generatedAt: input.generatedAt,
      source: input.source ?? 'manual',
      createdBy: input.createdBy ?? 'learner',
      userScope: input.userScope,
    };

    profileSnapshots.unshift(item);

    return item;
  }

  getProfileHistory(input: ExploreLearningProfileHistoryInput): ExploreLearningProfileHistoryItem[] {
    const limit = Math.max(1, Math.min(100, Math.round(input.limit ?? 20)));

    return profileSnapshots
      .filter((item) => matchesScope(item.userScope, input))
      .slice(0, limit)
      .map(({ userScope: _userScope, ...item }) => item);
  }
}

function matchesScope(value: unknown, filter: ExploreScopeFilter) {
  const scope = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return (['userId', 'studentId', 'deviceId', 'sessionId'] as const)
    .map((key): [keyof ExploreScopeFilter, string | undefined] => [key, filter[key]])
    .every(([key, expected]) => !expected || scope[key] === expected);
}

function countEngines(items: Record<string, unknown>[]): ExploreProgressReadResult['engines'] {
  const engines: ExploreProgressReadResult['engines'] = {
    worldEngine: 0,
    mindEngine: 0,
    meaningEngine: 0,
    gameTopologyEngine: 0,
    unknown: 0,
  };

  for (const item of items) {
    if (item.engineKey === 'world-engine') engines.worldEngine += 1;
    else if (item.engineKey === 'mind-engine') engines.mindEngine += 1;
    else if (item.engineKey === 'meaning-engine') engines.meaningEngine += 1;
    else if (item.engineKey === 'game-topology-engine') engines.gameTopologyEngine += 1;
    else engines.unknown += 1;
  }

  return engines;
}
