import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { StudentStateRepository } from '../domain/ports.js';
import type { StudentStateSnapshot, StudentStateSnapshotInput } from '../domain/types.js';
import { normalizeCognitiveState } from '../../../../../shared/cognitive-state.js';

interface SQLiteStudentStateRepositoryOptions {
  dbFile: string;
}

interface StudentStateSnapshotRow {
  id: string;
  student_id: string;
  created_at: string;
  source: StudentStateSnapshot['source'];
  session_id: string | null;
  media_job_id: string | null;
  interaction_outcome: StudentStateSnapshot['interactionOutcome'] | null;
  cognitive_state_json: string;
  profile_json: string;
  learning_signals_json: string | null;
}

export class SQLiteStudentStateRepository implements StudentStateRepository {
  private readonly db: DatabaseSync;

  constructor(options: SQLiteStudentStateRepositoryOptions) {
    this.ensureParentDir(options.dbFile);
    this.db = new DatabaseSync(options.dbFile);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS student_state_snapshots (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        source TEXT NOT NULL,
        session_id TEXT,
        media_job_id TEXT,
        interaction_outcome TEXT,
        cognitive_state_json TEXT NOT NULL,
        profile_json TEXT NOT NULL,
        learning_signals_json TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_student_state_student_created_at
      ON student_state_snapshots (student_id, created_at DESC);
    `);
  }

  async create(snapshot: StudentStateSnapshotInput): Promise<StudentStateSnapshot> {
    const record: StudentStateSnapshot = {
      id: randomUUID(),
      createdAt: this.nextCreatedAt(snapshot.studentId),
      ...snapshot,
      cognitiveState: normalizeCognitiveState(snapshot.cognitiveState),
    };

    this.db.prepare(`
      INSERT INTO student_state_snapshots (
        id, student_id, created_at, source, session_id, media_job_id,
        interaction_outcome, cognitive_state_json, profile_json, learning_signals_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.studentId,
      record.createdAt,
      record.source,
      record.sessionId ?? null,
      record.mediaJobId ?? null,
      record.interactionOutcome ?? null,
      JSON.stringify(record.cognitiveState),
      JSON.stringify(record.profile),
      record.learningSignals ? JSON.stringify(record.learningSignals) : null,
    );

    return record;
  }

  async listByStudent(studentId: string, limit: number = 50, offset: number = 0): Promise<StudentStateSnapshot[]> {
    const rows = this.db.prepare(`
      SELECT * FROM student_state_snapshots
      WHERE student_id = ?
      ORDER BY created_at DESC, rowid DESC
      LIMIT ? OFFSET ?
    `).all(studentId, limit, offset) as unknown as StudentStateSnapshotRow[];

    return rows.map((row) => this.mapRow(row));
  }

  async getLatestByStudent(studentId: string): Promise<StudentStateSnapshot | null> {
    const row = this.db.prepare(`
      SELECT * FROM student_state_snapshots
      WHERE student_id = ?
      ORDER BY created_at DESC, rowid DESC
      LIMIT 1
    `).get(studentId) as unknown as StudentStateSnapshotRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  async getStatsByStudent(studentId: string) {
    const row = this.db.prepare(`
      SELECT 
        COUNT(id) as totalSnapshots,
        SUM(CASE WHEN source = 'session-created' THEN 1 ELSE 0 END) as totalSessions,
        SUM(CASE WHEN interaction_outcome = 'success' THEN 1 ELSE 0 END) as interactionSuccessCount,
        SUM(CASE WHEN interaction_outcome = 'failure' THEN 1 ELSE 0 END) as interactionFailureCount
      FROM student_state_snapshots
      WHERE student_id = ?
    `).get(studentId) as any;

    return {
      totalSnapshots: Number(row.totalSnapshots || 0),
      totalSessions: Number(row.totalSessions || 0),
      interactionSuccessCount: Number(row.interactionSuccessCount || 0),
      interactionFailureCount: Number(row.interactionFailureCount || 0),
    };
  }

  private mapRow(row: StudentStateSnapshotRow): StudentStateSnapshot {
    return {
      id: row.id,
      studentId: row.student_id,
      createdAt: row.created_at,
      source: row.source,
      sessionId: row.session_id ?? undefined,
      mediaJobId: row.media_job_id ?? undefined,
      interactionOutcome: row.interaction_outcome ?? undefined,
      cognitiveState: normalizeCognitiveState(JSON.parse(row.cognitive_state_json)),
      profile: JSON.parse(row.profile_json) as StudentStateSnapshot['profile'],
      learningSignals: row.learning_signals_json
        ? (JSON.parse(row.learning_signals_json) as StudentStateSnapshot['learningSignals'])
        : undefined,
    };
  }

  private nextCreatedAt(studentId: string): string {
    const candidate = new Date().toISOString();
    const latestRow = this.db.prepare(`
      SELECT created_at
      FROM student_state_snapshots
      WHERE student_id = ?
      ORDER BY created_at DESC, rowid DESC
      LIMIT 1
    `).get(studentId) as { created_at?: string } | undefined;

    const latestCreatedAt = latestRow?.created_at;
    if (!latestCreatedAt || latestCreatedAt < candidate) {
      return candidate;
    }

    const bumpedMs = Date.parse(latestCreatedAt);
    if (Number.isNaN(bumpedMs)) {
      return candidate;
    }

    return new Date(bumpedMs + 1).toISOString();
  }

  private ensureParentDir(dbFile: string) {
    mkdirSync(path.dirname(dbFile), { recursive: true });
  }
}
