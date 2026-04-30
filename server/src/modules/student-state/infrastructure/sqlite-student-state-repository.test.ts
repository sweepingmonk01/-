import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SQLiteStudentStateRepository } from './sqlite-student-state-repository.js';

test('SQLiteStudentStateRepository can create, list, and fetch latest snapshots', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'liezi-student-state-'));
  const repository = new SQLiteStudentStateRepository({
    dbFile: path.join(tempDir, 'mobius.sqlite'),
  });

  await repository.create({
    studentId: 'student-1',
    source: 'session-created',
    sessionId: 'session-1',
    mediaJobId: 'job-1',
    cognitiveState: {
      focus: 60,
      frustration: 20,
      joy: 50,
      confidence: 48,
      fatigue: 18,
    },
    profile: {
      grade: '六年级',
      targetScore: 95,
      painPoint: '分数通分混淆',
      rule: '先找最小公倍数，再通分。',
      knowledgeActionId: 'action-1',
      knowledgeActionType: 'sequence',
      diagnosedMistakeCategories: ['concept-confusion'],
    },
    learningSignals: {
      attempts: 2,
      wrongStreak: 1,
    },
  });

  const created = await repository.create({
    studentId: 'student-1',
    source: 'interaction-resolved',
    mediaJobId: 'job-1',
    interactionOutcome: 'success',
    cognitiveState: {
      focus: 66,
      frustration: 12,
      joy: 58,
      confidence: 62,
      fatigue: 15,
    },
    profile: {
      grade: '六年级',
      targetScore: 95,
      painPoint: '分数通分混淆',
      rule: '先找最小公倍数，再通分。',
      knowledgeActionId: 'action-1',
      knowledgeActionType: 'sequence',
      diagnosedMistakeCategories: ['concept-confusion'],
    },
  });

  const latest = await repository.getLatestByStudent('student-1');
  assert.ok(latest);
  assert.equal(latest.id, created.id);
  assert.equal(latest.interactionOutcome, 'success');

  const listed = await repository.listByStudent('student-1');
  assert.equal(listed.length, 2);
  assert.equal(listed[0].id, created.id);
});

test('SQLiteStudentStateRepository preserves snapshot chronology for rapid writes', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'liezi-student-state-'));
  const repository = new SQLiteStudentStateRepository({
    dbFile: path.join(tempDir, 'mobius.sqlite'),
  });

  const first = await repository.create({
    studentId: 'student-fast',
    source: 'interaction-resolved',
    interactionOutcome: 'failure',
    cognitiveState: {
      focus: 50,
      frustration: 24,
      joy: 46,
      confidence: 42,
      fatigue: 18,
    },
    profile: {
      painPoint: '英语时态',
      rule: '先找时间标志',
      diagnosedMistakeCategories: [],
    },
  });

  const second = await repository.create({
    studentId: 'student-fast',
    source: 'interaction-resolved',
    interactionOutcome: 'success',
    cognitiveState: {
      focus: 58,
      frustration: 16,
      joy: 54,
      confidence: 56,
      fatigue: 16,
    },
    profile: {
      painPoint: '英语时态',
      rule: '先找时间标志',
      diagnosedMistakeCategories: [],
    },
  });

  assert.ok(first.createdAt < second.createdAt);

  const listed = await repository.listByStudent('student-fast');
  assert.deepEqual(
    listed.map((snapshot) => snapshot.id),
    [second.id, first.id],
  );
});
