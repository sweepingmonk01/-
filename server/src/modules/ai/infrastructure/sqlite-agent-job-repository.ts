import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { AgentJobPayload, AgentJobRecord, AgentJobType } from '../domain/types.js';

interface SQLiteAgentJobRepositoryOptions {
  dbFile: string;
}

interface AgentJobRow {
  id: string;
  job_type: AgentJobType;
  student_id: string;
  status: AgentJobRecord['status'];
  idempotency_key: string;
  attempts: number;
  max_attempts: number;
  payload_json: string;
  last_error: string | null;
  available_at: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export class SQLiteAgentJobRepository {
  private readonly db: DatabaseSync;

  constructor(options: SQLiteAgentJobRepositoryOptions) {
    mkdirSync(path.dirname(options.dbFile), { recursive: true });
    this.db = new DatabaseSync(options.dbFile);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_jobs (
        id TEXT PRIMARY KEY,
        job_type TEXT NOT NULL,
        student_id TEXT NOT NULL,
        status TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        attempts INTEGER NOT NULL,
        max_attempts INTEGER NOT NULL,
        payload_json TEXT NOT NULL,
        last_error TEXT,
        available_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_agent_jobs_status_available
      ON agent_jobs (status, available_at, created_at);
      CREATE INDEX IF NOT EXISTS idx_agent_jobs_student_type
      ON agent_jobs (student_id, job_type, created_at DESC);
    `);
  }

  async enqueueUnique<TPayload extends AgentJobPayload>(input: {
    jobType: AgentJobType;
    studentId: string;
    idempotencyKey: string;
    payload: TPayload;
    maxAttempts?: number;
  }): Promise<AgentJobRecord<TPayload>> {
    const now = new Date().toISOString();
    const id = randomUUID();
    this.db.prepare(`
      INSERT OR IGNORE INTO agent_jobs (
        id, job_type, student_id, status, idempotency_key, attempts, max_attempts,
        payload_json, available_at, created_at, updated_at
      ) VALUES (?, ?, ?, 'pending', ?, 0, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.jobType,
      input.studentId,
      input.idempotencyKey,
      input.maxAttempts ?? 4,
      JSON.stringify(input.payload),
      now,
      now,
      now,
    );

    return this.getByIdempotencyKey(input.idempotencyKey) as Promise<AgentJobRecord<TPayload>>;
  }

  async claimDueJob(jobTypes?: AgentJobType[]): Promise<AgentJobRecord | null> {
    const now = new Date().toISOString();
    const typeFilter = jobTypes?.length ? `AND job_type IN (${jobTypes.map(() => '?').join(', ')})` : '';
    const select = this.db.prepare(`
      SELECT * FROM agent_jobs
      WHERE status = 'pending' AND available_at <= ? ${typeFilter}
      ORDER BY available_at ASC, created_at ASC
      LIMIT 1
    `);

    for (;;) {
      const params = jobTypes?.length ? [now, ...jobTypes] : [now];
      const row = select.get(...params) as unknown as AgentJobRow | undefined;
      if (!row) return null;

      const update = this.db.prepare(`
        UPDATE agent_jobs
        SET status = 'running', attempts = attempts + 1, updated_at = ?
        WHERE id = ? AND status = 'pending'
      `).run(now, row.id);

      if (update.changes) {
        return this.getById(row.id);
      }
    }
  }

  async markCompleted(id: string): Promise<void> {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE agent_jobs
      SET status = 'completed', completed_at = ?, updated_at = ?, last_error = NULL
      WHERE id = ?
    `).run(now, now, id);
  }

  async markFailed(id: string, errorMessage: string): Promise<AgentJobRecord | null> {
    const current = await this.getById(id);
    if (!current) return null;

    const now = new Date().toISOString();
    const exhausted = current.attempts >= current.maxAttempts;
    const backoffMs = Math.min(30000, 1000 * (2 ** Math.max(0, current.attempts - 1)));
    const nextAvailableAt = exhausted ? current.availableAt : new Date(Date.now() + backoffMs).toISOString();

    this.db.prepare(`
      UPDATE agent_jobs
      SET status = ?, last_error = ?, available_at = ?, updated_at = ?, completed_at = ?
      WHERE id = ?
    `).run(
      exhausted ? 'failed' : 'pending',
      errorMessage,
      nextAvailableAt,
      now,
      exhausted ? now : null,
      id,
    );

    return this.getById(id);
  }

  async getById(id: string): Promise<AgentJobRecord | null> {
    const row = this.db.prepare(`
      SELECT * FROM agent_jobs WHERE id = ?
    `).get(id) as unknown as AgentJobRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  async getByIdempotencyKey(idempotencyKey: string): Promise<AgentJobRecord | null> {
    const row = this.db.prepare(`
      SELECT * FROM agent_jobs WHERE idempotency_key = ?
    `).get(idempotencyKey) as unknown as AgentJobRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  private mapRow(row: AgentJobRow): AgentJobRecord {
    return {
      id: row.id,
      jobType: row.job_type,
      studentId: row.student_id,
      status: row.status,
      idempotencyKey: row.idempotency_key,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      payload: JSON.parse(row.payload_json) as AgentJobPayload,
      lastError: row.last_error ?? undefined,
      availableAt: row.available_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at ?? undefined,
    };
  }
}
