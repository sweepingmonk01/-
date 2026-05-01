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
  ExploreTransferAttemptInput,
  ExploreTransferAttemptListInput,
  ExploreTransferAttemptRecord,
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
    transferAttempts: number;
  };
}

const records: ExploreSyncMemoryRecord[] = [];
const transferAttempts: ExploreTransferAttemptRecord[] = [];
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
  const snapshotTransferAttempts = asArray(request.snapshot.transferAttempts);
  const record: ExploreSyncMemoryRecord = {
    remoteBatchId: `batch_${Date.now()}`,
    syncedAt: new Date().toISOString(),
    request,
    acceptedCounts: {
      completedNodes: completedNodes.length,
      taskResults: taskResults.length,
      mediaTasks: mediaTasks.length,
      transferAttempts: snapshotTransferAttempts.length,
    },
  };

  records.unshift(record);
  transferAttempts.unshift(...snapshotTransferAttempts.map((item, index) => ({
    ...(item as ExploreTransferAttemptRecord),
    id: typeof (item as { id?: unknown }).id === 'string'
      ? (item as { id: string }).id
      : `transfer_${Date.now()}_${index}`,
  })));

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
  transferAttempts.splice(0, transferAttempts.length);
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
    const matchedTransferAttempts = transferAttempts.filter((item) => matchesScope(item.userScope, input));

    return {
      snapshot: {
        userScope: input,
        completedNodes: completedNodes as Record<string, unknown>[],
        taskResults: taskResults as Record<string, unknown>[],
        mediaTasks: mediaTasks as Record<string, unknown>[],
        transferAttempts: matchedTransferAttempts as unknown as Record<string, unknown>[],
        exportedAt: new Date().toISOString(),
        schemaVersion: 'explore-remote-v0.1',
      },
      counts: {
        completedNodes: completedNodes.length,
        taskResults: taskResults.length,
        mediaTasks: mediaTasks.length,
        transferAttempts: matchedTransferAttempts.length,
      },
    };
  }

  getProgress(input: ExploreScopeFilter): ExploreProgressReadResult {
    const snapshot = this.getSnapshot(input).snapshot;
    const latestScopedRecord = records.find((record) => matchesScope(record.request.snapshot.userScope, input));
    const qualityScores = snapshot.taskResults
      .map((item) => item.qualityScore)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const matchedTransferAttempts = transferAttempts.filter((item) => matchesScope(item.userScope, input));
    const transferScores = matchedTransferAttempts
      .map((item) => item.rubricScore)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const latestTransfer = matchedTransferAttempts[0];
    const transferEngineScores = buildTransferEngineScores(matchedTransferAttempts);

    return {
      completedNodes: snapshot.completedNodes.length,
      taskResults: snapshot.taskResults.length,
      mediaTasks: snapshot.mediaTasks.length,
      transferAttempts: matchedTransferAttempts.length,
      successfulTransferAttempts: matchedTransferAttempts.filter((item) => item.outcome === 'success').length,
      failedTransferAttempts: matchedTransferAttempts.filter((item) => item.outcome === 'failure').length,
      engines: countEngines(snapshot.completedNodes),
      averageTaskQuality: qualityScores.length > 0
        ? qualityScores.reduce((sum, value) => sum + value, 0) / qualityScores.length
        : 0,
      averageTransferRubricScore: transferScores.length > 0
        ? transferScores.reduce((sum, value) => sum + value, 0) / transferScores.length
        : 0,
      transferEngineScores,
      latestTransferOutcome: latestTransfer?.outcome,
      latestTransferRepairNodeKey: latestTransfer?.recommendedRepairNodeKey,
      latestSyncedAt: latestScopedRecord?.syncedAt,
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
          acceptedTransferAttempts: record.acceptedCounts.transferAttempts,
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

  saveTransferAttempt(input: ExploreTransferAttemptInput): ExploreTransferAttemptRecord {
    const record: ExploreTransferAttemptRecord = {
      ...input,
      id: `transfer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };

    transferAttempts.unshift(record);
    return record;
  }

  listTransferAttempts(input: ExploreTransferAttemptListInput): ExploreTransferAttemptRecord[] {
    const limit = Math.max(1, Math.min(100, Math.round(input.limit ?? 20)));

    return transferAttempts
      .filter((item) => matchesScope(item.userScope, input))
      .slice(0, limit);
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

function buildTransferEngineScores(items: ExploreTransferAttemptRecord[]): ExploreProgressReadResult['transferEngineScores'] {
  const buckets = {
    worldEngine: [] as number[],
    mindEngine: [] as number[],
    meaningEngine: [] as number[],
    gameTopologyEngine: [] as number[],
    unknown: [] as number[],
  };

  for (const item of items) {
    const bucket = engineBucket(item.extractedStructure.engineKey);
    buckets[bucket].push(item.outcome === 'success' ? item.rubricScore : 0);
  }

  return {
    worldEngine: average(buckets.worldEngine),
    mindEngine: average(buckets.mindEngine),
    meaningEngine: average(buckets.meaningEngine),
    gameTopologyEngine: average(buckets.gameTopologyEngine),
    unknown: average(buckets.unknown),
  };
}

function engineBucket(engineKey: unknown): keyof ExploreProgressReadResult['engines'] {
  if (engineKey === 'world-engine') return 'worldEngine';
  if (engineKey === 'mind-engine') return 'mindEngine';
  if (engineKey === 'meaning-engine') return 'meaningEngine';
  if (engineKey === 'game-topology-engine') return 'gameTopologyEngine';
  return 'unknown';
}

function average(values: number[]) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
