import test from 'node:test';
import assert from 'node:assert/strict';

import { StateVectorService } from './state-vector-service.js';
import { StateUpdateEngine } from './state-update-engine.js';
import type { StudentStateRepository } from '../domain/ports.js';
import type { StudentStateSnapshot } from '../domain/types.js';

class InMemoryStudentStateRepository implements StudentStateRepository {
  private readonly snapshots: StudentStateSnapshot[] = [];

  add(snapshot: StudentStateSnapshot) {
    this.snapshots.push(snapshot);
  }

  async create(): Promise<StudentStateSnapshot> {
    throw new Error('not used');
  }

  async listByStudent(studentId: string, limit: number = 100): Promise<StudentStateSnapshot[]> {
    return this.snapshots
      .filter((snapshot) => snapshot.studentId === studentId)
      .slice(0, limit);
  }

  async getLatestByStudent(studentId: string): Promise<StudentStateSnapshot | null> {
    const ordered = this.snapshots
      .filter((snapshot) => snapshot.studentId === studentId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return ordered[0] ?? null;
  }
}

const makeSnapshot = (
  id: string,
  createdAt: string,
  source: StudentStateSnapshot['source'],
  cognitiveOverrides: Partial<StudentStateSnapshot['cognitiveState']['kernel']> = {},
  outcome?: StudentStateSnapshot['interactionOutcome'],
): StudentStateSnapshot => ({
  id,
  studentId: 'student-a',
  createdAt,
  source,
  cognitiveState: {
    schemaVersion: 'ai-active-v2',
    kernel: { time: 60, signalNoiseRatio: 60, emotion: 60, ...cognitiveOverrides },
    execution: { confidence: 50, fatigue: 20 },
  },
  interactionOutcome: outcome,
  profile: {
    grade: '九年级',
    targetScore: 110,
    painPoint: '函数图像',
    rule: '通过两点解析式',
    diagnosedMistakeCategories: [],
  },
});

test('projectVectorAt returns null when no snapshots exist before the cutoff', async () => {
  const repo = new InMemoryStudentStateRepository();
  repo.add(makeSnapshot('s1', '2026-05-08T00:10:00.000Z', 'session-created'));
  const service = new StateVectorService({ repository: repo, updateEngine: new StateUpdateEngine() });

  const projection = await service.projectVectorAt('student-a', '2026-05-08T00:00:00.000Z');
  assert.equal(projection, null);
});

test('projectVectorAt projects a vector from snapshots up to the cutoff (inclusive)', async () => {
  const repo = new InMemoryStudentStateRepository();
  repo.add(makeSnapshot('s1', '2026-05-08T00:00:00.000Z', 'session-created', { time: 50 }));
  repo.add(makeSnapshot('s2', '2026-05-08T00:01:00.000Z', 'interaction-resolved', { time: 70 }, 'success'));
  const service = new StateVectorService({ repository: repo, updateEngine: new StateUpdateEngine() });

  const earlyVector = await service.projectVectorAt('student-a', '2026-05-08T00:00:30.000Z');
  const lateVector = await service.projectVectorAt('student-a', '2026-05-08T00:01:00.000Z');

  assert.ok(earlyVector);
  assert.equal(earlyVector!.snapshotCount, 1);
  assert.equal(earlyVector!.cognitive.kernel.time, 50);

  assert.ok(lateVector);
  assert.equal(lateVector!.snapshotCount, 2);
  assert.equal(lateVector!.cognitive.kernel.time, 70);
});

test('computeVectorDiff returns kernel and execution deltas when both projections exist', async () => {
  const repo = new InMemoryStudentStateRepository();
  repo.add(makeSnapshot('s1', '2026-05-08T00:00:00.000Z', 'session-created', { time: 50, signalNoiseRatio: 40, emotion: 45 }));
  repo.add(makeSnapshot('s2', '2026-05-08T00:01:00.000Z', 'interaction-resolved', { time: 70, signalNoiseRatio: 60, emotion: 65 }, 'success'));
  const service = new StateVectorService({ repository: repo, updateEngine: new StateUpdateEngine() });

  const diff = await service.computeVectorDiff('student-a', {
    beforeAt: '2026-05-08T00:00:00.000Z',
    afterAt: '2026-05-08T00:01:00.000Z',
  });

  assert.ok(diff.before && diff.after);
  assert.deepEqual(diff.kernelDelta, { time: 20, signalNoiseRatio: 20, emotion: 20 });
  assert.equal(diff.snapshotCountDelta, 1);
  assert.equal(diff.executionDelta?.confidence, 0);
});

test('computeVectorDiff omits delta fields when before vector is missing', async () => {
  const repo = new InMemoryStudentStateRepository();
  repo.add(makeSnapshot('s1', '2026-05-08T00:01:00.000Z', 'session-created'));
  const service = new StateVectorService({ repository: repo, updateEngine: new StateUpdateEngine() });

  const diff = await service.computeVectorDiff('student-a', {
    beforeAt: '2026-05-08T00:00:00.000Z',
    afterAt: '2026-05-08T00:01:00.000Z',
  });

  assert.equal(diff.before, null);
  assert.ok(diff.after);
  assert.equal(diff.kernelDelta, undefined);
  assert.equal(diff.executionDelta, undefined);
});
