import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { EventLogger } from './event-logger.js';

export class SQLiteEventLogger implements EventLogger {
  private readonly db: DatabaseSync;

  constructor(private readonly dbFile: string) {
    this.ensureParentDir();
    this.db = new DatabaseSync(dbFile);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created_at
      ON analytics_events (name, created_at DESC);
    `);
  }

  async track(input: { name: string; payload?: Record<string, unknown> }): Promise<void> {
    const statement = this.db.prepare(`
      INSERT INTO analytics_events (name, payload_json, created_at)
      VALUES (?, ?, ?)
    `);
    statement.run(
      input.name,
      JSON.stringify(input.payload ?? {}),
      new Date().toISOString(),
    );
  }

  private ensureParentDir() {
    mkdirSync(path.dirname(this.dbFile), { recursive: true });
  }
}
