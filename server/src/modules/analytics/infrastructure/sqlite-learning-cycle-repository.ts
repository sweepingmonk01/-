import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type {
  LearningCycleEvent,
  LearningCycleEventType,
  LearningCycleRecord,
  LearningEvidenceEvent,
} from '../domain/types.js';

interface SQLiteLearningCycleRepositoryOptions {
  dbFile: string;
}

interface LearningCycleRow {
  id: string;
  student_id: string;
  source: LearningCycleRecord['source'];
  status: LearningCycleRecord['status'];
  session_id: string | null;
  media_job_id: string | null;
  pain_point: string;
  rule_text: string;
  knowledge_action_id: string | null;
  state_before_json: string | null;
  state_after_json: string | null;
  hypothesis_summary_json: string | null;
  selected_action_json: string | null;
  outcome: LearningCycleRecord['outcome'] | null;
  effect_score: number | null;
  effect_score_value: number | null;
  effect_score_execution: number | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

interface LearningCycleEventRow {
  id: string;
  cycle_id: string;
  event_type: LearningCycleEventType;
  event_payload_json: string | null;
  created_at: string;
}

interface LearningEvidenceEventRow {
  id: string;
  student_id: string;
  cycle_id: string | null;
  modality: LearningEvidenceEvent['modality'];
  source: string;
  target_node_key: string | null;
  pain_point: string | null;
  rule_text: string | null;
  confidence: number;
  observed_at: string;
  outcome: LearningEvidenceEvent['outcome'] | null;
  model_version: string | null;
  privacy_level: LearningEvidenceEvent['privacyLevel'];
  payload_json: string;
  created_at: string;
}

export class SQLiteLearningCycleRepository {
  private readonly db: DatabaseSync;

  constructor(options: SQLiteLearningCycleRepositoryOptions) {
    mkdirSync(path.dirname(options.dbFile), { recursive: true });
    this.db = new DatabaseSync(options.dbFile);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS learning_cycles (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        source TEXT NOT NULL,
        status TEXT NOT NULL,
        session_id TEXT,
        media_job_id TEXT,
        pain_point TEXT NOT NULL,
        rule_text TEXT NOT NULL,
        knowledge_action_id TEXT,
        state_before_json TEXT,
        state_after_json TEXT,
        hypothesis_summary_json TEXT,
        selected_action_json TEXT,
        outcome TEXT,
        effect_score REAL,
        effect_score_value REAL,
        effect_score_execution REAL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        closed_at TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_cycles_media_job_unique
      ON learning_cycles (media_job_id);
      CREATE INDEX IF NOT EXISTS idx_learning_cycles_student_created
      ON learning_cycles (student_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS learning_cycle_events (
        id TEXT PRIMARY KEY,
        cycle_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_payload_json TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_learning_cycle_events_cycle_created
      ON learning_cycle_events (cycle_id, created_at ASC);

      CREATE TABLE IF NOT EXISTS learning_evidence_events (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        cycle_id TEXT,
        modality TEXT NOT NULL,
        source TEXT NOT NULL,
        target_node_key TEXT,
        pain_point TEXT,
        rule_text TEXT,
        confidence REAL NOT NULL,
        observed_at TEXT NOT NULL,
        outcome TEXT,
        model_version TEXT,
        privacy_level TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_learning_evidence_student_observed
      ON learning_evidence_events (student_id, observed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_learning_evidence_cycle_observed
      ON learning_evidence_events (cycle_id, observed_at ASC);
    `);

    this.ensureColumn('learning_cycles', 'effect_score_value', 'REAL');
    this.ensureColumn('learning_cycles', 'effect_score_execution', 'REAL');
  }

  // 幂等迁移:老 DB 的 learning_cycles 没有 effect_score_value 列时补上。
  private ensureColumn(table: string, column: string, type: string): void {
    const columns = this.db.prepare(`PRAGMA table_info(${table})`).all() as unknown as Array<{ name: string }>;
    if (columns.some((info) => info.name === column)) return;
    this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }

  async create(input: Omit<LearningCycleRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<LearningCycleRecord> {
    const now = new Date().toISOString();
    const record: LearningCycleRecord = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      ...input,
    };

    this.db.prepare(`
      INSERT INTO learning_cycles (
        id, student_id, source, status, session_id, media_job_id,
        pain_point, rule_text, knowledge_action_id, state_before_json, state_after_json,
        hypothesis_summary_json, selected_action_json, outcome, effect_score, effect_score_value,
        effect_score_execution, created_at, updated_at, closed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.studentId,
      record.source,
      record.status,
      record.sessionId ?? null,
      record.mediaJobId ?? null,
      record.painPoint,
      record.rule,
      record.knowledgeActionId ?? null,
      record.stateBefore ? JSON.stringify(record.stateBefore) : null,
      record.stateAfter ? JSON.stringify(record.stateAfter) : null,
      record.hypothesisSummary ? JSON.stringify(record.hypothesisSummary) : null,
      record.selectedAction ? JSON.stringify(record.selectedAction) : null,
      record.outcome ?? null,
      record.effectScore ?? null,
      record.effectScoreValueComponent ?? null,
      record.effectScoreExecutionComponent ?? null,
      record.createdAt,
      record.updatedAt,
      record.closedAt ?? null,
    );

    return record;
  }

  async update(
    id: string,
    changes: Partial<Omit<LearningCycleRecord, 'id' | 'studentId' | 'source' | 'createdAt'>>,
  ): Promise<LearningCycleRecord | null> {
    const current = await this.getById(id);
    if (!current) return null;

    const next: LearningCycleRecord = {
      ...current,
      ...changes,
      updatedAt: new Date().toISOString(),
    };

    this.db.prepare(`
      UPDATE learning_cycles
      SET status = ?, session_id = ?, media_job_id = ?, pain_point = ?, rule_text = ?,
          knowledge_action_id = ?, state_before_json = ?, state_after_json = ?,
          hypothesis_summary_json = ?, selected_action_json = ?, outcome = ?, effect_score = ?,
          effect_score_value = ?, effect_score_execution = ?, updated_at = ?, closed_at = ?
      WHERE id = ?
    `).run(
      next.status,
      next.sessionId ?? null,
      next.mediaJobId ?? null,
      next.painPoint,
      next.rule,
      next.knowledgeActionId ?? null,
      next.stateBefore ? JSON.stringify(next.stateBefore) : null,
      next.stateAfter ? JSON.stringify(next.stateAfter) : null,
      next.hypothesisSummary ? JSON.stringify(next.hypothesisSummary) : null,
      next.selectedAction ? JSON.stringify(next.selectedAction) : null,
      next.outcome ?? null,
      next.effectScore ?? null,
      next.effectScoreValueComponent ?? null,
      next.effectScoreExecutionComponent ?? null,
      next.updatedAt,
      next.closedAt ?? null,
      id,
    );

    return next;
  }

  async getById(id: string): Promise<LearningCycleRecord | null> {
    const row = this.db.prepare(`
      SELECT * FROM learning_cycles WHERE id = ?
    `).get(id) as unknown as LearningCycleRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  async getByMediaJobId(mediaJobId: string): Promise<LearningCycleRecord | null> {
    const row = this.db.prepare(`
      SELECT * FROM learning_cycles WHERE media_job_id = ?
    `).get(mediaJobId) as unknown as LearningCycleRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  async listByStudent(studentId: string, limit: number = 20): Promise<LearningCycleRecord[]> {
    const rows = this.db.prepare(`
      SELECT * FROM learning_cycles
      WHERE student_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(studentId, limit) as unknown as LearningCycleRow[];

    return rows.map((row) => this.mapRow(row));
  }

  async appendEvent(input: {
    cycleId: string;
    eventType: LearningCycleEventType;
    eventPayload?: Record<string, unknown>;
  }): Promise<LearningCycleEvent> {
    const event: LearningCycleEvent = {
      id: randomUUID(),
      cycleId: input.cycleId,
      eventType: input.eventType,
      eventPayload: input.eventPayload,
      createdAt: new Date().toISOString(),
    };

    this.db.prepare(`
      INSERT INTO learning_cycle_events (
        id, cycle_id, event_type, event_payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?)
    `).run(
      event.id,
      event.cycleId,
      event.eventType,
      event.eventPayload ? JSON.stringify(event.eventPayload) : null,
      event.createdAt,
    );

    return event;
  }

  async listEvents(cycleId: string): Promise<LearningCycleEvent[]> {
    const rows = this.db.prepare(`
      SELECT * FROM learning_cycle_events
      WHERE cycle_id = ?
      ORDER BY created_at ASC
    `).all(cycleId) as unknown as LearningCycleEventRow[];

    return rows.map((row) => ({
      id: row.id,
      cycleId: row.cycle_id,
      eventType: row.event_type,
      eventPayload: row.event_payload_json
        ? (JSON.parse(row.event_payload_json) as Record<string, unknown>)
        : undefined,
      createdAt: row.created_at,
    }));
  }

  async appendEvidence(input: Omit<LearningEvidenceEvent, 'id' | 'createdAt'>): Promise<LearningEvidenceEvent> {
    const evidence: LearningEvidenceEvent = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      ...input,
      confidence: Math.max(0, Math.min(1, Number(input.confidence.toFixed(4)))),
    };

    this.db.prepare(`
      INSERT INTO learning_evidence_events (
        id, student_id, cycle_id, modality, source, target_node_key,
        pain_point, rule_text, confidence, observed_at, outcome, model_version,
        privacy_level, payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      evidence.id,
      evidence.studentId,
      evidence.cycleId ?? null,
      evidence.modality,
      evidence.source,
      evidence.targetNodeKey ?? null,
      evidence.painPoint ?? null,
      evidence.rule ?? null,
      evidence.confidence,
      evidence.observedAt,
      evidence.outcome ?? null,
      evidence.modelVersion ?? null,
      evidence.privacyLevel,
      JSON.stringify(evidence.payload),
      evidence.createdAt,
    );

    return evidence;
  }

  async listEvidenceByCycle(cycleId: string): Promise<LearningEvidenceEvent[]> {
    const rows = this.db.prepare(`
      SELECT * FROM learning_evidence_events
      WHERE cycle_id = ?
      ORDER BY observed_at ASC, created_at ASC
    `).all(cycleId) as unknown as LearningEvidenceEventRow[];

    return rows.map((row) => this.mapEvidenceRow(row));
  }

  async listEvidenceByStudent(studentId: string, limit: number = 100): Promise<LearningEvidenceEvent[]> {
    const rows = this.db.prepare(`
      SELECT * FROM learning_evidence_events
      WHERE student_id = ?
      ORDER BY observed_at DESC, created_at DESC
      LIMIT ?
    `).all(studentId, limit) as unknown as LearningEvidenceEventRow[];

    return rows.map((row) => this.mapEvidenceRow(row));
  }

  private mapRow(row: LearningCycleRow): LearningCycleRecord {
    return {
      id: row.id,
      studentId: row.student_id,
      source: row.source,
      status: row.status,
      sessionId: row.session_id ?? undefined,
      mediaJobId: row.media_job_id ?? undefined,
      painPoint: row.pain_point,
      rule: row.rule_text,
      knowledgeActionId: row.knowledge_action_id ?? undefined,
      stateBefore: row.state_before_json ? JSON.parse(row.state_before_json) as LearningCycleRecord['stateBefore'] : undefined,
      stateAfter: row.state_after_json ? JSON.parse(row.state_after_json) as LearningCycleRecord['stateAfter'] : undefined,
      hypothesisSummary: row.hypothesis_summary_json
        ? (JSON.parse(row.hypothesis_summary_json) as LearningCycleRecord['hypothesisSummary'])
        : undefined,
      selectedAction: row.selected_action_json
        ? (JSON.parse(row.selected_action_json) as LearningCycleRecord['selectedAction'])
        : undefined,
      outcome: row.outcome ?? undefined,
      effectScore: row.effect_score ?? undefined,
      effectScoreValueComponent: row.effect_score_value ?? undefined,
      effectScoreExecutionComponent: row.effect_score_execution ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      closedAt: row.closed_at ?? undefined,
    };
  }

  private mapEvidenceRow(row: LearningEvidenceEventRow): LearningEvidenceEvent {
    return {
      id: row.id,
      studentId: row.student_id,
      cycleId: row.cycle_id ?? undefined,
      modality: row.modality,
      source: row.source,
      targetNodeKey: row.target_node_key ?? undefined,
      painPoint: row.pain_point ?? undefined,
      rule: row.rule_text ?? undefined,
      confidence: row.confidence,
      observedAt: row.observed_at,
      outcome: row.outcome ?? undefined,
      modelVersion: row.model_version ?? undefined,
      privacyLevel: row.privacy_level,
      payload: JSON.parse(row.payload_json) as Record<string, unknown>,
      createdAt: row.created_at,
    };
  }
}
