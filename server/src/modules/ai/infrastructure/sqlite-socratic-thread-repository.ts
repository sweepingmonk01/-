import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { SocraticMessage, SocraticThread } from '../domain/types.js';

interface SQLiteSocraticThreadRepositoryOptions {
  dbFile: string;
}

interface SocraticThreadRow {
  id: string;
  student_id: string;
  cycle_id: string | null;
  job_id: string | null;
  status: string;
  title: string;
  agent_label: string;
  pain_point: string | null;
  rule_text: string | null;
  rationale_json: string | null;
  messages_json: string;
  created_at: string;
  updated_at: string;
}

export class SQLiteSocraticThreadRepository {
  private readonly db: DatabaseSync;

  constructor(options: SQLiteSocraticThreadRepositoryOptions) {
    mkdirSync(path.dirname(options.dbFile), { recursive: true });
    this.db = new DatabaseSync(options.dbFile);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS socratic_threads (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        cycle_id TEXT,
        job_id TEXT,
        status TEXT NOT NULL,
        title TEXT NOT NULL,
        agent_label TEXT NOT NULL,
        pain_point TEXT,
        rule_text TEXT,
        rationale_json TEXT,
        messages_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_socratic_threads_student
      ON socratic_threads (student_id, updated_at DESC);
    `);
    this.ensureColumns();
  }

  async create(thread: SocraticThread): Promise<SocraticThread> {
    this.db.prepare(`
      INSERT INTO socratic_threads (
        id, student_id, cycle_id, job_id, status, title, agent_label, pain_point, rule_text, rationale_json, messages_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      thread.id,
      thread.studentId,
      thread.cycleId ?? null,
      thread.jobId ?? null,
      thread.status,
      thread.title,
      thread.agentLabel,
      thread.painPoint ?? null,
      thread.rule ?? null,
      thread.rationale ? JSON.stringify(thread.rationale) : null,
      JSON.stringify(thread.messages),
      thread.createdAt,
      thread.updatedAt,
    );

    return thread;
  }

  async getById(id: string): Promise<SocraticThread | null> {
    const row = this.db.prepare(`
      SELECT * FROM socratic_threads WHERE id = ?
    `).get(id) as unknown as SocraticThreadRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  async updateMessages(
    id: string,
    updates: {
      messages: SocraticMessage[];
      status?: SocraticThread['status'];
    },
  ): Promise<SocraticThread | null> {
    const current = await this.getById(id);
    if (!current) return null;

    const next: SocraticThread = {
      ...current,
      messages: updates.messages,
      status: updates.status ?? current.status,
      updatedAt: new Date().toISOString(),
    };

    this.db.prepare(`
      UPDATE socratic_threads
      SET messages_json = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).run(JSON.stringify(next.messages), next.status, next.updatedAt, id);

    return next;
  }

  private mapRow(row: SocraticThreadRow): SocraticThread {
    return {
      id: row.id,
      studentId: row.student_id,
      cycleId: row.cycle_id ?? undefined,
      jobId: row.job_id ?? undefined,
      status: row.status as SocraticThread['status'],
      title: row.title,
      agentLabel: row.agent_label,
      painPoint: row.pain_point ?? undefined,
      rule: row.rule_text ?? undefined,
      rationale: row.rationale_json ? JSON.parse(row.rationale_json) as string[] : undefined,
      messages: JSON.parse(row.messages_json) as SocraticMessage[],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private ensureColumns() {
    const rows = this.db.prepare(`PRAGMA table_info(socratic_threads)`).all() as Array<{ name?: string }>;
    const existing = new Set(rows.map((row) => row.name).filter((name): name is string => Boolean(name)));
    const requiredColumns: Array<{ name: string; sql: string }> = [
      { name: 'cycle_id', sql: 'ALTER TABLE socratic_threads ADD COLUMN cycle_id TEXT' },
      { name: 'job_id', sql: 'ALTER TABLE socratic_threads ADD COLUMN job_id TEXT' },
      { name: 'pain_point', sql: 'ALTER TABLE socratic_threads ADD COLUMN pain_point TEXT' },
      { name: 'rule_text', sql: 'ALTER TABLE socratic_threads ADD COLUMN rule_text TEXT' },
      { name: 'rationale_json', sql: 'ALTER TABLE socratic_threads ADD COLUMN rationale_json TEXT' },
    ];

    for (const column of requiredColumns) {
      if (!existing.has(column.name)) {
        this.db.exec(column.sql);
      }
    }
  }
}
