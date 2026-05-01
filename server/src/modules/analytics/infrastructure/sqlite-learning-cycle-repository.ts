import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { LearningCycleEvent, LearningCycleEventType, LearningCycleRecord } from '../domain/types.js';

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
    `);
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
        hypothesis_summary_json, selected_action_json, outcome, effect_score,
        created_at, updated_at, closed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          updated_at = ?, closed_at = ?
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
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      closedAt: row.closed_at ?? undefined,
    };
  }
}
