import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  GeneratedAssetKind,
  GeneratedAssetRecord,
  GeneratedAssetRepository,
} from '../domain/generated-assets.js';

interface SQLiteGeneratedAssetRepositoryOptions {
  dbFile: string;
}

interface GeneratedAssetRow {
  id: string;
  student_id: string;
  kind: GeneratedAssetKind;
  provider: GeneratedAssetRecord['provider'];
  source_hash: string;
  prompt_json: string;
  status: GeneratedAssetRecord['status'];
  url_or_blob_ref: string | null;
  mime_type: string | null;
  provider_metadata_json: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export class SQLiteGeneratedAssetRepository implements GeneratedAssetRepository {
  private readonly db: DatabaseSync;

  constructor(options: SQLiteGeneratedAssetRepositoryOptions) {
    mkdirSync(path.dirname(options.dbFile), { recursive: true });
    this.db = new DatabaseSync(options.dbFile);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS generated_assets (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        provider TEXT NOT NULL,
        source_hash TEXT NOT NULL,
        prompt_json TEXT NOT NULL,
        status TEXT NOT NULL,
        url_or_blob_ref TEXT,
        mime_type TEXT,
        provider_metadata_json TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_generated_assets_source
      ON generated_assets (student_id, kind, source_hash);
      CREATE INDEX IF NOT EXISTS idx_generated_assets_student_created
      ON generated_assets (student_id, created_at DESC);
    `);
  }

  async create(record: Omit<GeneratedAssetRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<GeneratedAssetRecord> {
    const now = new Date().toISOString();
    const asset: GeneratedAssetRecord = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      ...record,
    };

    this.db.prepare(`
      INSERT INTO generated_assets (
        id, student_id, kind, provider, source_hash, prompt_json, status,
        url_or_blob_ref, mime_type, provider_metadata_json, error_message, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      asset.id,
      asset.studentId,
      asset.kind,
      asset.provider,
      asset.sourceHash,
      JSON.stringify(asset.promptJson),
      asset.status,
      asset.urlOrBlobRef ?? null,
      asset.mimeType ?? null,
      asset.providerMetadata ? JSON.stringify(asset.providerMetadata) : null,
      asset.errorMessage ?? null,
      asset.createdAt,
      asset.updatedAt,
    );

    return asset;
  }

  async getById(id: string): Promise<GeneratedAssetRecord | null> {
    const row = this.db.prepare('SELECT * FROM generated_assets WHERE id = ?').get(id) as unknown as GeneratedAssetRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  async findBySourceHash(studentId: string, kind: GeneratedAssetKind, sourceHash: string): Promise<GeneratedAssetRecord | null> {
    const row = this.db.prepare(`
      SELECT * FROM generated_assets
      WHERE student_id = ? AND kind = ? AND source_hash = ?
    `).get(studentId, kind, sourceHash) as unknown as GeneratedAssetRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  async listByStudent(studentId: string): Promise<GeneratedAssetRecord[]> {
    const rows = this.db.prepare(`
      SELECT * FROM generated_assets
      WHERE student_id = ?
      ORDER BY created_at DESC
    `).all(studentId) as unknown as GeneratedAssetRow[];

    return rows.map((row) => this.mapRow(row));
  }

  async update(
    id: string,
    changes: Partial<Omit<GeneratedAssetRecord, 'id' | 'studentId' | 'createdAt'>>,
  ): Promise<GeneratedAssetRecord | null> {
    const current = await this.getById(id);
    if (!current) return null;

    const next: GeneratedAssetRecord = {
      ...current,
      ...changes,
      updatedAt: new Date().toISOString(),
    };

    this.db.prepare(`
      UPDATE generated_assets
      SET kind = ?, provider = ?, source_hash = ?, prompt_json = ?, status = ?,
          url_or_blob_ref = ?, mime_type = ?, provider_metadata_json = ?, error_message = ?, updated_at = ?
      WHERE id = ?
    `).run(
      next.kind,
      next.provider,
      next.sourceHash,
      JSON.stringify(next.promptJson),
      next.status,
      next.urlOrBlobRef ?? null,
      next.mimeType ?? null,
      next.providerMetadata ? JSON.stringify(next.providerMetadata) : null,
      next.errorMessage ?? null,
      next.updatedAt,
      id,
    );

    return next;
  }

  private mapRow(row: GeneratedAssetRow): GeneratedAssetRecord {
    return {
      id: row.id,
      studentId: row.student_id,
      kind: row.kind,
      provider: row.provider,
      sourceHash: row.source_hash,
      promptJson: JSON.parse(row.prompt_json) as Record<string, unknown>,
      status: row.status,
      urlOrBlobRef: row.url_or_blob_ref ?? undefined,
      mimeType: row.mime_type ?? undefined,
      providerMetadata: row.provider_metadata_json
        ? (JSON.parse(row.provider_metadata_json) as Record<string, unknown>)
        : undefined,
      errorMessage: row.error_message ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
