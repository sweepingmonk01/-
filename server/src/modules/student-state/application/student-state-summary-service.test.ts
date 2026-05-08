import test from 'node:test';
import assert from 'node:assert/strict';

import { StudentStateSummaryService } from './student-state-summary-service.js';
import { StateUpdateEngine } from './state-update-engine.js';
import { StateVectorService } from './state-vector-service.js';
import type { StudentStateRepository } from '../domain/ports.js';
import type { StudentStateSnapshot } from '../domain/types.js';

class InMemoryRepo implements StudentStateRepository {
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
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }

  async getLatestByStudent(studentId: string): Promise<StudentStateSnapshot | null> {
    const list = await this.listByStudent(studentId, 1);
    return list[0] ?? null;
  }
}

const makeSnapshot = (
  id: string,
  createdAt: string,
  source: StudentStateSnapshot['source'],
  kernel: { time: number; signalNoiseRatio: number; emotion: number },
  outcome?: StudentStateSnapshot['interactionOutcome'],
): StudentStateSnapshot => ({
  id,
  studentId: 'student-a',
  createdAt,
  source,
  cognitiveState: {
    schemaVersion: 'ai-active-v2',
    kernel,
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

test('summary returns lastInteractionDiff from last interaction-resolved snapshot pair', async () => {
  const repo = new InMemoryRepo();
  repo.add(makeSnapshot('s1', '2026-05-08T00:00:00.000Z', 'session-created', { time: 60, signalNoiseRatio: 60, emotion: 60 }));
  repo.add(makeSnapshot('s2', '2026-05-08T00:01:00.000Z', 'interaction-resolved', { time: 50, signalNoiseRatio: 45, emotion: 48 }, 'failure'));

  const service = new StudentStateSummaryService({
    repository: repo,
    stateVectors: new StateVectorService({ repository: repo, updateEngine: new StateUpdateEngine() }),
  });
  const summary = await service.getStudentStateSummary('student-a');

  assert.ok(summary?.lastInteractionDiff);
  assert.equal(summary!.lastInteractionDiff!.outcome, 'failure');
  assert.deepEqual(summary!.lastInteractionDiff!.before, { time: 60, signalNoiseRatio: 60, emotion: 60 });
  assert.deepEqual(summary!.lastInteractionDiff!.after, { time: 50, signalNoiseRatio: 45, emotion: 48 });
  assert.deepEqual(summary!.lastInteractionDiff!.delta, { time: -10, signalNoiseRatio: -15, emotion: -12 });
});

test('summary returns no diff when no interaction-resolved snapshot exists', async () => {
  const repo = new InMemoryRepo();
  repo.add(makeSnapshot('s1', '2026-05-08T00:00:00.000Z', 'session-created', { time: 60, signalNoiseRatio: 60, emotion: 60 }));

  const service = new StudentStateSummaryService({
    repository: repo,
    stateVectors: new StateVectorService({ repository: repo, updateEngine: new StateUpdateEngine() }),
  });
  const summary = await service.getStudentStateSummary('student-a');

  assert.equal(summary?.lastInteractionDiff, undefined);
});

test('summary picks the most recent interaction-resolved diff when multiple exist', async () => {
  const repo = new InMemoryRepo();
  repo.add(makeSnapshot('s1', '2026-05-08T00:00:00.000Z', 'session-created', { time: 50, signalNoiseRatio: 50, emotion: 50 }));
  repo.add(makeSnapshot('s2', '2026-05-08T00:01:00.000Z', 'interaction-resolved', { time: 56, signalNoiseRatio: 60, emotion: 58 }, 'success'));
  repo.add(makeSnapshot('s3', '2026-05-08T00:02:00.000Z', 'session-created', { time: 56, signalNoiseRatio: 60, emotion: 58 }));
  repo.add(makeSnapshot('s4', '2026-05-08T00:03:00.000Z', 'interaction-resolved', { time: 49, signalNoiseRatio: 48, emotion: 49 }, 'failure'));

  const service = new StudentStateSummaryService({
    repository: repo,
    stateVectors: new StateVectorService({ repository: repo, updateEngine: new StateUpdateEngine() }),
  });
  const summary = await service.getStudentStateSummary('student-a');

  assert.equal(summary?.lastInteractionDiff?.outcome, 'failure');
  assert.deepEqual(summary?.lastInteractionDiff?.delta, { time: -7, signalNoiseRatio: -12, emotion: -9 });
});
