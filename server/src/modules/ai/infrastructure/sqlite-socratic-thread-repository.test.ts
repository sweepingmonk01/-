import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SQLiteSocraticThreadRepository } from './sqlite-socratic-thread-repository.js';

test('SQLiteSocraticThreadRepository backfills new optional columns on existing databases', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'liezi-socratic-repo-'));
  const dbFile = path.join(tempDir, 'mobius.sqlite');
  const db = new DatabaseSync(dbFile);

  db.exec(`
    CREATE TABLE socratic_threads (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      agent_label TEXT NOT NULL,
      messages_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  db.close();

  const repository = new SQLiteSocraticThreadRepository({ dbFile });
  const now = new Date().toISOString();

  await repository.create({
    id: 'thread-1',
    studentId: 'student-a',
    cycleId: 'cycle-1',
    jobId: 'job-1',
    status: 'active',
    title: '深潜诊断：几何辅助线',
    agentLabel: 'Socratic Diagnostic Loop',
    painPoint: '几何辅助线',
    rule: '见中点先想中线',
    rationale: ['第一步没有触发规则'],
    messages: [
      {
        role: 'assistant',
        content: '先告诉我你第一步到底看漏了什么？',
        createdAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  });

  const saved = await repository.getById('thread-1');

  assert.equal(saved?.cycleId, 'cycle-1');
  assert.equal(saved?.jobId, 'job-1');
  assert.equal(saved?.painPoint, '几何辅助线');
  assert.equal(saved?.rule, '见中点先想中线');
  assert.deepEqual(saved?.rationale, ['第一步没有触发规则']);
});
