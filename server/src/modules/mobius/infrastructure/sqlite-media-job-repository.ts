import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import type { MediaJobRepository } from '../domain/ports.js';
import type { InteractionOutcome, MediaJobRecord, StoryBeatPlan } from '../domain/types.js';

interface SQLiteMediaJobRepositoryOptions {
  dbFile: string;
}

interface MediaJobRow {
  id: string;
  student_id: string;
  created_at: string;
  updated_at: string;
  parent_job_id: string | null;
  branch_outcome: InteractionOutcome | null;
  provider: MediaJobRecord['provider'];
  provider_job_id: string | null;
  status: MediaJobRecord['status'];
  prompt_bundle_json: string;
  story_json: string | null;
  playback_url: string | null;
  error_message: string | null;
  interactions_json: string | null;
}

export class SQLiteMediaJobRepository implements MediaJobRepository {
  private readonly db: DatabaseSync;

  constructor(options: SQLiteMediaJobRepositoryOptions) {
    this.ensureParentDir(options.dbFile);
    this.db = new DatabaseSync(options.dbFile);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS media_jobs (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        parent_job_id TEXT,
        branch_outcome TEXT,
        provider TEXT NOT NULL,
        provider_job_id TEXT,
        status TEXT NOT NULL,
        prompt_bundle_json TEXT NOT NULL,
        story_json TEXT,
        playback_url TEXT,
        error_message TEXT,
        interactions_json TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_media_jobs_student_created_at
      ON media_jobs (student_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_media_jobs_parent_branch
      ON media_jobs (parent_job_id, branch_outcome);
    `);
  }

  async create(record: Omit<MediaJobRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<MediaJobRecord> {
    const now = new Date().toISOString();
    const job: MediaJobRecord = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      ...record,
    };

    this.db.prepare(`
      INSERT INTO media_jobs (
        id, student_id, created_at, updated_at, parent_job_id, branch_outcome, provider,
        provider_job_id, status, prompt_bundle_json, story_json, playback_url, error_message, interactions_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      job.id,
      job.studentId,
      job.createdAt,
      job.updatedAt,
      job.parentJobId ?? null,
      job.branchOutcome ?? null,
      job.provider,
      job.providerJobId ?? null,
      job.status,
      JSON.stringify(job.promptBundle),
      job.story ? JSON.stringify(job.story) : null,
      job.playbackUrl ?? null,
      job.errorMessage ?? null,
      job.interactions ? JSON.stringify(job.interactions) : null,
    );

    return job;
  }

  async getById(id: string): Promise<MediaJobRecord | null> {
    const row = this.db.prepare(`
      SELECT * FROM media_jobs WHERE id = ?
    `).get(id) as unknown as MediaJobRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  async listByStudent(studentId: string): Promise<MediaJobRecord[]> {
    const rows = this.db.prepare(`
      SELECT * FROM media_jobs
      WHERE student_id = ?
      ORDER BY created_at DESC
    `).all(studentId) as unknown as MediaJobRow[];

    return rows.map((row) => this.mapRow(row));
  }

  async update(
    id: string,
    changes: Partial<Omit<MediaJobRecord, 'id' | 'studentId' | 'createdAt'>>,
  ): Promise<MediaJobRecord | null> {
    const current = await this.getById(id);
    if (!current) return null;

    const next: MediaJobRecord = {
      ...current,
      ...changes,
      updatedAt: new Date().toISOString(),
    };

    this.db.prepare(`
      UPDATE media_jobs
      SET updated_at = ?, parent_job_id = ?, branch_outcome = ?, provider = ?, provider_job_id = ?,
          status = ?, prompt_bundle_json = ?, story_json = ?, playback_url = ?, error_message = ?, interactions_json = ?
      WHERE id = ?
    `).run(
      next.updatedAt,
      next.parentJobId ?? null,
      next.branchOutcome ?? null,
      next.provider,
      next.providerJobId ?? null,
      next.status,
      JSON.stringify(next.promptBundle),
      next.story ? JSON.stringify(next.story) : null,
      next.playbackUrl ?? null,
      next.errorMessage ?? null,
      next.interactions ? JSON.stringify(next.interactions) : null,
      id,
    );

    return next;
  }

  private mapRow(row: MediaJobRow): MediaJobRecord {
    return {
      id: row.id,
      studentId: row.student_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      parentJobId: row.parent_job_id ?? undefined,
      branchOutcome: row.branch_outcome ?? undefined,
      provider: row.provider,
      providerJobId: row.provider_job_id ?? undefined,
      status: row.status,
      promptBundle: JSON.parse(row.prompt_bundle_json) as MediaJobRecord['promptBundle'],
      story: row.story_json ? (JSON.parse(row.story_json) as StoryBeatPlan) : undefined,
      playbackUrl: row.playback_url ?? undefined,
      errorMessage: row.error_message ?? undefined,
      interactions: row.interactions_json
        ? (JSON.parse(row.interactions_json) as MediaJobRecord['interactions'])
        : undefined,
    };
  }

  private ensureParentDir(dbFile: string) {
    mkdirSync(path.dirname(dbFile), { recursive: true });
  }
}
