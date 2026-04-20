import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { getServerEnv } from '../src/config/env.js';
import type { MediaJobRecord } from '../src/modules/mobius/domain/types.js';

const env = getServerEnv();
const dataDir = path.resolve(env.dataDir);
const sourceMediaJobsFile = path.join(dataDir, 'media-jobs.json');
const sourceEventsLogFile = path.join(dataDir, 'events.log');
const targetDbFile = path.resolve(env.sqliteDbFile);

mkdirSync(path.dirname(targetDbFile), { recursive: true });

const db = new DatabaseSync(targetDbFile);
db.exec(`
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
  CREATE TABLE IF NOT EXISTS analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

const insertMediaJob = db.prepare(`
  INSERT OR REPLACE INTO media_jobs (
    id, student_id, created_at, updated_at, parent_job_id, branch_outcome, provider,
    provider_job_id, status, prompt_bundle_json, story_json, playback_url, error_message, interactions_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertEvent = db.prepare(`
  INSERT INTO analytics_events (name, payload_json, created_at)
  VALUES (?, ?, ?)
`);

let mediaJobsMigrated = 0;
if (existsSync(sourceMediaJobsFile)) {
  const jobs = JSON.parse(readFileSync(sourceMediaJobsFile, 'utf8')) as MediaJobRecord[];
  for (const job of jobs) {
    insertMediaJob.run(
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
    mediaJobsMigrated += 1;
  }
}

let eventsMigrated = 0;
if (existsSync(sourceEventsLogFile)) {
  const lines = readFileSync(sourceEventsLogFile, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const entry = JSON.parse(line) as { name: string; payload?: Record<string, unknown>; createdAt: string };
    insertEvent.run(entry.name, JSON.stringify(entry.payload ?? {}), entry.createdAt);
    eventsMigrated += 1;
  }
}

console.log(`[migrate] sqlite target: ${targetDbFile}`);
console.log(`[migrate] media jobs migrated: ${mediaJobsMigrated}`);
console.log(`[migrate] analytics events migrated: ${eventsMigrated}`);
