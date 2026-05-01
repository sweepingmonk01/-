import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { runExploreMigrations } from '../db/exploreMigrations.js';
import {
  getExploreLearningProfileSnapshotsFromDb,
  saveExploreLearningProfileSnapshot,
} from './exploreProfileDbStore.js';
import type {
  ExploreLearningProfileHistoryInput,
  ExploreLearningProfileHistoryItem,
  ExploreLearningProfileSnapshotInput,
  ExploreProgressReadResult,
  ExploreScopeFilter,
  ExploreSyncBatchListInput,
  ExploreSnapshotReadResult,
  ExploreSyncBatchSummary,
  ExploreSyncSaveResult,
  ExploreSyncStore,
  ExploreTransferAttemptInput,
  ExploreTransferAttemptListInput,
  ExploreTransferAttemptRecord,
  ExploreTransferOutcome,
  SaveExploreSyncSnapshotInput,
} from './exploreSyncStoreTypes.js';

interface SQLiteExploreSyncStoreOptions {
  dbFile: string;
}

type JsonRecord = Record<string, unknown>;

interface ExploreCompletedNodeRow {
  id: string;
  batch_id: string;
  node_key: string;
  engine_key: string | null;
  user_id: string | null;
  student_id: string | null;
  device_id: string | null;
  session_id: string | null;
  source: string | null;
  evidence_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ExploreJsonRow {
  id: string;
  batch_id: string;
  local_id: string | null;
  remote_id: string | null;
  node_key: string;
  engine_key: string | null;
  user_id: string | null;
  student_id: string | null;
  device_id: string | null;
  session_id: string | null;
  created_at: string;
  updated_at: string;
  raw_json: string;
}

interface ExploreTaskResultRow extends ExploreJsonRow {
  task_title: string | null;
  task_type: string | null;
  user_answer: string | null;
  reflection_text: string | null;
  quality_score: number | null;
  quality_level: string | null;
}

interface ExploreMediaTaskRow extends ExploreJsonRow {
  type: string | null;
  prompt: string | null;
  status: string | null;
}

interface ExploreBatchRow {
  id: string;
  user_id: string | null;
  student_id: string | null;
  accepted_completed_nodes: number;
  accepted_task_results: number;
  accepted_media_tasks: number;
  accepted_transfer_attempts: number;
  created_at: string;
}

interface ExploreTransferAttemptRow {
  id: string;
  source_node_key: string;
  source_evidence_id: string | null;
  structure_key: string;
  structure_label: string;
  structure_engine_key: string | null;
  target_domain: string;
  target_task_json: string;
  user_application: string;
  outcome: ExploreTransferOutcome;
  rubric_score: number;
  rubric_json: string;
  recommended_repair_node_key: string | null;
  state_before_json: string;
  state_after_json: string;
  user_id: string | null;
  student_id: string | null;
  device_id: string | null;
  session_id: string | null;
  raw_json: string;
  created_at: string;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function asArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map((item) => asRecord(item)) : [];
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function stringOrFallback(value: unknown, fallback: string): string {
  return stringOrNull(value) ?? fallback;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function scopeValue(itemScope: JsonRecord, snapshotScope: JsonRecord, key: string) {
  return stringOrNull(itemScope[key]) ?? stringOrNull(snapshotScope[key]);
}

function parseJsonRecord(value: string): JsonRecord {
  try {
    return asRecord(JSON.parse(value));
  } catch {
    return {};
  }
}

function parseJsonValue(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return {};
  }
}

function engineBucket(engineKey: unknown): keyof ExploreProgressReadResult['engines'] {
  if (engineKey === 'world-engine') return 'worldEngine';
  if (engineKey === 'mind-engine') return 'mindEngine';
  if (engineKey === 'meaning-engine') return 'meaningEngine';
  if (engineKey === 'game-topology-engine') return 'gameTopologyEngine';
  return 'unknown';
}

export class SQLiteExploreSyncStore implements ExploreSyncStore {
  private readonly db: DatabaseSync;

  constructor(options: SQLiteExploreSyncStoreOptions) {
    mkdirSync(path.dirname(options.dbFile), { recursive: true });
    this.db = new DatabaseSync(options.dbFile);
    runExploreMigrations(this.db);
  }

  save(input: SaveExploreSyncSnapshotInput): ExploreSyncSaveResult {
    const snapshot = input.snapshot;
    const clientMeta = input.clientMeta;
    const userScope = asRecord(snapshot.userScope);
    const syncedAt = new Date().toISOString();
    const remoteBatchId = `batch_${Date.now()}`;
    const completedNodes = asArray(snapshot.completedNodes);
    const taskResults = asArray(snapshot.taskResults);
    const mediaTasks = asArray(snapshot.mediaTasks);
    const transferAttempts = asArray(snapshot.transferAttempts);

    this.db.exec('BEGIN');

    try {
      this.insertBatch({
        remoteBatchId,
        syncedAt,
        snapshot,
        clientMeta,
        userScope,
        completedNodes,
        taskResults,
        mediaTasks,
        transferAttempts,
      });
      this.insertCompletedNodes(remoteBatchId, syncedAt, userScope, completedNodes);
      this.insertTaskResults(remoteBatchId, syncedAt, userScope, taskResults);
      this.insertMediaTasks(remoteBatchId, syncedAt, userScope, mediaTasks);
      this.insertTransferAttemptsFromSnapshot(syncedAt, userScope, transferAttempts);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }

    return {
      remoteBatchId,
      syncedAt,
      acceptedCounts: {
        completedNodes: completedNodes.length,
        taskResults: taskResults.length,
        mediaTasks: mediaTasks.length,
        transferAttempts: transferAttempts.length,
      },
    };
  }

  countRows(tableName: 'explore_sync_batches' | 'explore_completed_nodes' | 'explore_task_results' | 'explore_media_tasks' | 'explore_learning_profile_snapshots' | 'explore_transfer_attempts') {
    const row = this.db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count?: number } | undefined;
    return Number(row?.count ?? 0);
  }

  getSnapshot(input: ExploreScopeFilter): ExploreSnapshotReadResult {
    const completedNodes = this.getCompletedNodeRows(input).map((row) => ({
      id: row.id,
      nodeKey: row.node_key,
      engineKey: row.engine_key ?? 'unknown',
      userScope: {
        userId: row.user_id ?? undefined,
        studentId: row.student_id ?? undefined,
        deviceId: row.device_id ?? undefined,
        sessionId: row.session_id ?? undefined,
      },
      source: row.source ?? 'manual',
      evidenceId: row.evidence_id ?? undefined,
      syncStatus: 'synced',
      completedAt: row.completed_at ?? row.created_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const taskResults = this.getTaskResultRows(input).map((row) => ({
      ...parseJsonRecord(row.raw_json),
      id: row.id,
      localId: row.local_id ?? undefined,
      remoteId: row.remote_id ?? undefined,
      nodeKey: row.node_key,
      engineKey: row.engine_key ?? 'unknown',
      taskTitle: row.task_title ?? undefined,
      taskType: row.task_type ?? undefined,
      userAnswer: row.user_answer ?? undefined,
      reflectionText: row.reflection_text ?? undefined,
      qualityScore: row.quality_score ?? undefined,
      qualityLevel: row.quality_level ?? undefined,
      userScope: {
        userId: row.user_id ?? undefined,
        studentId: row.student_id ?? undefined,
        deviceId: row.device_id ?? undefined,
        sessionId: row.session_id ?? undefined,
      },
      syncStatus: 'synced',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const mediaTasks = this.getMediaTaskRows(input).map((row) => ({
      ...parseJsonRecord(row.raw_json),
      id: row.id,
      localId: row.local_id ?? undefined,
      remoteId: row.remote_id ?? undefined,
      nodeKey: row.node_key,
      engineKey: row.engine_key ?? 'unknown',
      type: row.type ?? undefined,
      prompt: row.prompt ?? undefined,
      status: row.status ?? undefined,
      userScope: {
        userId: row.user_id ?? undefined,
        studentId: row.student_id ?? undefined,
        deviceId: row.device_id ?? undefined,
        sessionId: row.session_id ?? undefined,
      },
      syncStatus: 'synced',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    const transferAttempts = this.listTransferAttempts(input).map((attempt) => ({
      ...attempt,
      syncStatus: 'synced',
    }));

    return {
      snapshot: {
        userScope: input,
        completedNodes,
        taskResults,
        mediaTasks,
        transferAttempts,
        exportedAt: new Date().toISOString(),
        schemaVersion: 'explore-remote-v0.1',
      },
      counts: {
        completedNodes: completedNodes.length,
        taskResults: taskResults.length,
        mediaTasks: mediaTasks.length,
        transferAttempts: transferAttempts.length,
      },
    };
  }

  getProgress(input: ExploreScopeFilter): ExploreProgressReadResult {
    const completedNodes = this.getCompletedNodeRows(input);
    const taskResults = this.getTaskResultRows(input);
    const mediaTasks = this.getMediaTaskRows(input);
    const transferAttempts = this.getTransferAttemptRows(input);
    const engines: ExploreProgressReadResult['engines'] = {
      worldEngine: 0,
      mindEngine: 0,
      meaningEngine: 0,
      gameTopologyEngine: 0,
      unknown: 0,
    };

    for (const row of completedNodes) {
      engines[engineBucket(row.engine_key)] += 1;
    }

    const qualityScores = taskResults
      .map((row) => row.quality_score)
      .filter((score): score is number => typeof score === 'number' && Number.isFinite(score));
    const transferScores = transferAttempts
      .map((row) => row.rubric_score)
      .filter((score): score is number => typeof score === 'number' && Number.isFinite(score));
    const latestTransfer = transferAttempts.at(-1);
    const transferEngineScores = buildTransferEngineScores(transferAttempts);
    const latestSyncedAt = this.getLatestSyncedAt(input);

    return {
      completedNodes: completedNodes.length,
      taskResults: taskResults.length,
      mediaTasks: mediaTasks.length,
      transferAttempts: transferAttempts.length,
      successfulTransferAttempts: transferAttempts.filter((row) => row.outcome === 'success').length,
      failedTransferAttempts: transferAttempts.filter((row) => row.outcome === 'failure').length,
      engines,
      averageTaskQuality: qualityScores.length > 0
        ? qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length
        : 0,
      averageTransferRubricScore: transferScores.length > 0
        ? transferScores.reduce((sum, score) => sum + score, 0) / transferScores.length
        : 0,
      transferEngineScores,
      latestTransferOutcome: latestTransfer?.outcome,
      latestTransferRepairNodeKey: latestTransfer?.recommended_repair_node_key ?? undefined,
      latestSyncedAt: latestSyncedAt ?? undefined,
    };
  }

  listBatches(input: ExploreSyncBatchListInput = {}): ExploreSyncBatchSummary[] {
    const limit = Math.max(1, Math.min(100, Math.round(input?.limit ?? 20)));
    const query = this.buildScopeQuery('explore_sync_batches', input);
    const rows = this.db.prepare(`
      SELECT id, user_id, student_id, accepted_completed_nodes, accepted_task_results,
             accepted_media_tasks, accepted_transfer_attempts, created_at
      FROM explore_sync_batches
      ${query.where}
      ORDER BY created_at DESC, rowid DESC
      LIMIT ?
    `).all(...query.params, limit) as unknown as ExploreBatchRow[];

    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id ?? undefined,
      studentId: row.student_id ?? undefined,
      acceptedCompletedNodes: Number(row.accepted_completed_nodes || 0),
      acceptedTaskResults: Number(row.accepted_task_results || 0),
      acceptedMediaTasks: Number(row.accepted_media_tasks || 0),
      acceptedTransferAttempts: Number(row.accepted_transfer_attempts || 0),
      createdAt: row.created_at,
    }));
  }

  saveProfileSnapshot(input: ExploreLearningProfileSnapshotInput): ExploreLearningProfileHistoryItem {
    return saveExploreLearningProfileSnapshot(this.db, input);
  }

  getProfileHistory(input: ExploreLearningProfileHistoryInput): ExploreLearningProfileHistoryItem[] {
    return getExploreLearningProfileSnapshotsFromDb(this.db, input);
  }

  saveTransferAttempt(input: ExploreTransferAttemptInput): ExploreTransferAttemptRecord {
    const record: ExploreTransferAttemptRecord = {
      ...input,
      id: `transfer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };

    this.insertTransferAttempt(record);
    return record;
  }

  listTransferAttempts(input: ExploreTransferAttemptListInput): ExploreTransferAttemptRecord[] {
    const limit = Math.max(1, Math.min(100, Math.round(input.limit ?? 20)));

    return this.getTransferAttemptRows(input)
      .slice(-limit)
      .reverse()
      .map(transferAttemptRowToRecord);
  }

  private getCompletedNodeRows(filter: ExploreScopeFilter) {
    const query = this.buildScopeQuery('explore_completed_nodes', filter);

    return this.db.prepare(`
      SELECT *
      FROM explore_completed_nodes
      ${query.where}
      ORDER BY updated_at ASC, rowid ASC
    `).all(...query.params) as unknown as ExploreCompletedNodeRow[];
  }

  private getTaskResultRows(filter: ExploreScopeFilter) {
    const query = this.buildScopeQuery('explore_task_results', filter);

    return this.db.prepare(`
      SELECT *
      FROM explore_task_results
      ${query.where}
      ORDER BY updated_at ASC, rowid ASC
    `).all(...query.params) as unknown as ExploreTaskResultRow[];
  }

  private getMediaTaskRows(filter: ExploreScopeFilter) {
    const query = this.buildScopeQuery('explore_media_tasks', filter);

    return this.db.prepare(`
      SELECT *
      FROM explore_media_tasks
      ${query.where}
      ORDER BY updated_at ASC, rowid ASC
    `).all(...query.params) as unknown as ExploreMediaTaskRow[];
  }

  private getTransferAttemptRows(filter: ExploreScopeFilter) {
    const query = this.buildScopeQuery('explore_transfer_attempts', filter);

    return this.db.prepare(`
      SELECT *
      FROM explore_transfer_attempts
      ${query.where}
      ORDER BY created_at ASC, rowid ASC
    `).all(...query.params) as unknown as ExploreTransferAttemptRow[];
  }

  private getLatestSyncedAt(filter: ExploreScopeFilter) {
    const query = this.buildScopeQuery('explore_sync_batches', filter);
    const row = this.db.prepare(`
      SELECT created_at
      FROM explore_sync_batches
      ${query.where}
      ORDER BY created_at DESC, rowid DESC
      LIMIT 1
    `).get(...query.params) as { created_at?: string } | undefined;

    return row?.created_at;
  }

  private buildScopeQuery(_tableName: string, filter: ExploreScopeFilter) {
    const clauses: string[] = [];
    const params: string[] = [];
    const columns: Array<[keyof ExploreScopeFilter, string]> = [
      ['userId', 'user_id'],
      ['studentId', 'student_id'],
      ['deviceId', 'device_id'],
      ['sessionId', 'session_id'],
    ];

    for (const [key, column] of columns) {
      const value = filter[key];
      if (!value) continue;
      clauses.push(`${column} = ?`);
      params.push(value);
    }

    return {
      where: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
      params,
    };
  }

  private insertBatch(input: {
    remoteBatchId: string;
    syncedAt: string;
    snapshot: JsonRecord;
    clientMeta: JsonRecord;
    userScope: JsonRecord;
    completedNodes: JsonRecord[];
    taskResults: JsonRecord[];
    mediaTasks: JsonRecord[];
    transferAttempts: JsonRecord[];
  }) {
    this.db.prepare(`
      INSERT INTO explore_sync_batches (
        id, user_id, student_id, device_id, session_id,
        schema_version, app_version, source,
        accepted_completed_nodes, accepted_task_results, accepted_media_tasks,
        accepted_transfer_attempts, raw_snapshot_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.remoteBatchId,
      stringOrNull(input.userScope.userId),
      stringOrNull(input.userScope.studentId),
      stringOrNull(input.userScope.deviceId),
      stringOrNull(input.userScope.sessionId),
      stringOrFallback(input.snapshot.schemaVersion, 'explore-remote-v0.1'),
      stringOrNull(input.clientMeta.appVersion),
      stringOrNull(input.clientMeta.source),
      input.completedNodes.length,
      input.taskResults.length,
      input.mediaTasks.length,
      input.transferAttempts.length,
      JSON.stringify(input.snapshot),
      input.syncedAt,
    );
  }

  private insertCompletedNodes(
    batchId: string,
    syncedAt: string,
    snapshotScope: JsonRecord,
    completedNodes: JsonRecord[],
  ) {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO explore_completed_nodes (
        id, batch_id, node_key, engine_key,
        user_id, student_id, device_id, session_id,
        source, evidence_id, completed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    completedNodes.forEach((item, index) => {
      const itemScope = asRecord(item.userScope);
      insert.run(
        stringOrFallback(item.id, `${batchId}-completed-${index}`),
        batchId,
        stringOrFallback(item.nodeKey, 'unknown'),
        stringOrNull(item.engineKey),
        scopeValue(itemScope, snapshotScope, 'userId'),
        scopeValue(itemScope, snapshotScope, 'studentId'),
        scopeValue(itemScope, snapshotScope, 'deviceId'),
        scopeValue(itemScope, snapshotScope, 'sessionId'),
        stringOrNull(item.source),
        stringOrNull(item.evidenceId),
        stringOrNull(item.completedAt) ?? syncedAt,
        stringOrNull(item.createdAt) ?? syncedAt,
        stringOrNull(item.updatedAt) ?? syncedAt,
      );
    });
  }

  private insertTaskResults(
    batchId: string,
    syncedAt: string,
    snapshotScope: JsonRecord,
    taskResults: JsonRecord[],
  ) {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO explore_task_results (
        id, batch_id, local_id, remote_id,
        node_key, engine_key, task_title, task_type,
        user_answer, reflection_text, quality_score, quality_level,
        user_id, student_id, device_id, session_id,
        created_at, updated_at, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    taskResults.forEach((item, index) => {
      const itemScope = asRecord(item.userScope);
      insert.run(
        stringOrFallback(item.id, `${batchId}-task-${index}`),
        batchId,
        stringOrNull(item.localId),
        stringOrNull(item.remoteId),
        stringOrFallback(item.nodeKey, 'unknown'),
        stringOrNull(item.engineKey),
        stringOrNull(item.taskTitle),
        stringOrNull(item.taskType),
        stringOrNull(item.userAnswer),
        stringOrNull(item.reflectionText),
        numberOrNull(item.qualityScore),
        stringOrNull(item.qualityLevel),
        scopeValue(itemScope, snapshotScope, 'userId'),
        scopeValue(itemScope, snapshotScope, 'studentId'),
        scopeValue(itemScope, snapshotScope, 'deviceId'),
        scopeValue(itemScope, snapshotScope, 'sessionId'),
        stringOrNull(item.createdAt) ?? syncedAt,
        stringOrNull(item.updatedAt) ?? syncedAt,
        JSON.stringify(item),
      );
    });
  }

  private insertMediaTasks(
    batchId: string,
    syncedAt: string,
    snapshotScope: JsonRecord,
    mediaTasks: JsonRecord[],
  ) {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO explore_media_tasks (
        id, batch_id, local_id, remote_id,
        node_key, engine_key, type, prompt, status,
        user_id, student_id, device_id, session_id,
        created_at, updated_at, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    mediaTasks.forEach((item, index) => {
      const itemScope = asRecord(item.userScope);
      insert.run(
        stringOrFallback(item.id, `${batchId}-media-${index}`),
        batchId,
        stringOrNull(item.localId),
        stringOrNull(item.remoteId),
        stringOrFallback(item.nodeKey, 'unknown'),
        stringOrNull(item.engineKey),
        stringOrNull(item.type),
        stringOrNull(item.prompt),
        stringOrNull(item.status),
        scopeValue(itemScope, snapshotScope, 'userId'),
        scopeValue(itemScope, snapshotScope, 'studentId'),
        scopeValue(itemScope, snapshotScope, 'deviceId'),
        scopeValue(itemScope, snapshotScope, 'sessionId'),
        stringOrNull(item.createdAt) ?? syncedAt,
        stringOrNull(item.updatedAt) ?? syncedAt,
        JSON.stringify(item),
      );
    });
  }

  private insertTransferAttemptsFromSnapshot(
    syncedAt: string,
    snapshotScope: JsonRecord,
    transferAttempts: JsonRecord[],
  ) {
    transferAttempts.forEach((item, index) => {
      const itemScope = asRecord(item.userScope);
      const structure = asRecord(item.extractedStructure);
      const targetTask = asRecord(item.targetTask);
      const rubric = asRecord(item.rubric);
      const outcome = item.outcome === 'success' ? 'success' : 'failure';
      const score = numberOrNull(item.rubricScore) ?? 0;
      const record: ExploreTransferAttemptRecord = {
        id: stringOrFallback(item.id, `transfer_${Date.now()}_${index}`),
        userScope: {
          userId: scopeValue(itemScope, snapshotScope, 'userId') ?? undefined,
          studentId: scopeValue(itemScope, snapshotScope, 'studentId') ?? undefined,
          deviceId: scopeValue(itemScope, snapshotScope, 'deviceId') ?? undefined,
          sessionId: scopeValue(itemScope, snapshotScope, 'sessionId') ?? undefined,
        },
        sourceNodeKey: stringOrFallback(item.sourceNodeKey, 'unknown'),
        sourceEvidenceId: stringOrNull(item.sourceEvidenceId) ?? undefined,
        extractedStructure: {
          key: stringOrFallback(structure.key, 'rule-trigger'),
          label: stringOrFallback(structure.label, '规则触发结构'),
          description: stringOrFallback(structure.description, '先识别结构，再迁移到新任务。'),
          engineKey: stringOrFallback(structure.engineKey, 'unknown'),
          repairNodeKey: stringOrFallback(structure.repairNodeKey, 'language.rules'),
          evidenceSummary: stringOrFallback(structure.evidenceSummary, '来自同步迁移证据。'),
        },
        targetDomain: stringOrFallback(item.targetDomain, 'unknown'),
        targetTask: {
          id: stringOrFallback(targetTask.id, `target-${index}`),
          domain: stringOrFallback(targetTask.domain, stringOrFallback(item.targetDomain, 'unknown')),
          prompt: stringOrFallback(targetTask.prompt, '用同一结构解决一个陌生任务。'),
          expectedStructureCue: stringOrFallback(targetTask.expectedStructureCue, '识别结构并迁移。'),
        },
        userApplication: stringOrFallback(item.userApplication, ''),
        outcome,
        rubricScore: score,
        rubric: {
          structureIdentified: Boolean(rubric.structureIdentified),
          mappingApplied: Boolean(rubric.mappingApplied),
          actionMechanismNamed: Boolean(rubric.actionMechanismNamed),
          resultExplained: Boolean(rubric.resultExplained),
        },
        stateBefore: item.stateBefore ?? {},
        stateAfter: item.stateAfter ?? {},
        recommendedRepairNodeKey: stringOrNull(item.recommendedRepairNodeKey) ?? undefined,
        createdAt: stringOrNull(item.createdAt) ?? syncedAt,
      };

      this.insertTransferAttempt(record);
    });
  }

  private insertTransferAttempt(record: ExploreTransferAttemptRecord) {
    this.db.prepare(`
      INSERT OR REPLACE INTO explore_transfer_attempts (
        id, source_node_key, source_evidence_id, structure_key, structure_label,
        structure_engine_key, target_domain, target_task_json, user_application,
        outcome, rubric_score, rubric_json, recommended_repair_node_key,
        state_before_json, state_after_json, user_id, student_id, device_id,
        session_id, raw_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.sourceNodeKey,
      record.sourceEvidenceId ?? null,
      record.extractedStructure.key,
      record.extractedStructure.label,
      record.extractedStructure.engineKey,
      record.targetDomain,
      JSON.stringify(record.targetTask),
      record.userApplication,
      record.outcome,
      record.rubricScore,
      JSON.stringify(record.rubric),
      record.recommendedRepairNodeKey ?? null,
      JSON.stringify(record.stateBefore),
      JSON.stringify(record.stateAfter),
      stringOrNull(record.userScope.userId),
      stringOrNull(record.userScope.studentId),
      stringOrNull(record.userScope.deviceId),
      stringOrNull(record.userScope.sessionId),
      JSON.stringify(record),
      record.createdAt,
    );
  }
}

function transferAttemptRowToRecord(row: ExploreTransferAttemptRow): ExploreTransferAttemptRecord {
  const raw = asRecord(parseJsonValue(row.raw_json));
  const structure = asRecord(raw.extractedStructure);
  const targetTask = asRecord(parseJsonValue(row.target_task_json));
  const rubric = asRecord(parseJsonValue(row.rubric_json));

  return {
    id: row.id,
    userScope: {
      userId: row.user_id ?? undefined,
      studentId: row.student_id ?? undefined,
      deviceId: row.device_id ?? undefined,
      sessionId: row.session_id ?? undefined,
    },
    sourceNodeKey: row.source_node_key,
    sourceEvidenceId: row.source_evidence_id ?? undefined,
    extractedStructure: {
      key: row.structure_key,
      label: row.structure_label,
      description: stringOrFallback(structure.description, '先识别结构，再迁移到新任务。'),
      engineKey: row.structure_engine_key ?? 'unknown',
      repairNodeKey: stringOrFallback(structure.repairNodeKey, row.recommended_repair_node_key ?? 'language.rules'),
      evidenceSummary: stringOrFallback(structure.evidenceSummary, '来自迁移验证证据。'),
    },
    targetDomain: row.target_domain,
    targetTask: {
      id: stringOrFallback(targetTask.id, 'target-task'),
      domain: stringOrFallback(targetTask.domain, row.target_domain),
      prompt: stringOrFallback(targetTask.prompt, '用同一结构解决一个陌生任务。'),
      expectedStructureCue: stringOrFallback(targetTask.expectedStructureCue, row.structure_label),
    },
    userApplication: row.user_application,
    outcome: row.outcome,
    rubricScore: Number(row.rubric_score),
    rubric: {
      structureIdentified: Boolean(rubric.structureIdentified),
      mappingApplied: Boolean(rubric.mappingApplied),
      actionMechanismNamed: Boolean(rubric.actionMechanismNamed),
      resultExplained: Boolean(rubric.resultExplained),
    },
    stateBefore: parseJsonValue(row.state_before_json),
    stateAfter: parseJsonValue(row.state_after_json),
    recommendedRepairNodeKey: row.recommended_repair_node_key ?? undefined,
    createdAt: row.created_at,
  };
}

function buildTransferEngineScores(
  rows: ExploreTransferAttemptRow[],
): ExploreProgressReadResult['transferEngineScores'] {
  const buckets = {
    worldEngine: [] as number[],
    mindEngine: [] as number[],
    meaningEngine: [] as number[],
    gameTopologyEngine: [] as number[],
    unknown: [] as number[],
  };

  for (const row of rows) {
    const bucket = engineBucket(row.structure_engine_key);
    buckets[bucket].push(row.outcome === 'success' ? Number(row.rubric_score) : 0);
  }

  return {
    worldEngine: average(buckets.worldEngine),
    mindEngine: average(buckets.mindEngine),
    meaningEngine: average(buckets.meaningEngine),
    gameTopologyEngine: average(buckets.gameTopologyEngine),
    unknown: average(buckets.unknown),
  };
}

function average(values: number[]) {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  return finiteValues.length > 0
    ? finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length
    : 0;
}
