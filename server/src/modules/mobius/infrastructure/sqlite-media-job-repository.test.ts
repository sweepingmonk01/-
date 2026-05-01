import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SQLiteMediaJobRepository } from './sqlite-media-job-repository.js';

test('SQLiteMediaJobRepository can create, read, list, and update media jobs', async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'liezi-sqlite-media-jobs-'));
  const repository = new SQLiteMediaJobRepository({
    dbFile: path.join(tempDir, 'mobius.sqlite'),
  });

  const created = await repository.create({
    studentId: 'student-1',
    provider: 'stub',
    providerJobId: 'provider-1',
    status: 'queued',
    promptBundle: {
      title: 'Prompt Title',
      visualStyle: 'anime',
      prompt: 'Create scene.',
      durationSeconds: 10,
      aspectRatio: '9:16',
      fallbackStoryboard: ['scene', 'interaction', 'success', 'failure'],
    },
    story: {
      sceneIntro: 'scene',
      emotion: 'focused',
      interactionPrompt: 'interaction',
      successScene: 'success',
      failureScene: 'failure',
      visualStyle: 'anime',
      strategyDecision: {
        selectedStrategy: 'probe',
        candidates: [
          {
            strategy: 'probe',
            baseScore: 24,
            score: 64,
            scoreBreakdown: {
              painPointRecurrence: { label: '重复痛点', value: 18, weight: 1, contribution: 18 },
              timePressure: { label: '时间压力', value: 8, weight: -0.4, contribution: -3 },
              noisePressure: { label: '噪声压力', value: 12, weight: 1.1, contribution: 13 },
              emotionRisk: { label: '情绪风险', value: 6, weight: -0.2, contribution: -1 },
              masteryGap: { label: '掌握缺口', value: 12, weight: 0, contribution: 0 },
              recentFailurePressure: { label: '近期失败压力', value: 12, weight: 1, contribution: 12 },
              recentSuccessRecovery: { label: '近期成功恢复', value: 0, weight: -0.7, contribution: 0 },
            },
            rationale: '先探测断点。',
          },
        ],
      },
    },
    playbackUrl: 'https://example.com/preview.mp4',
    interactions: [],
  });

  const fetched = await repository.getById(created.id);
  assert.ok(fetched);
  assert.equal(fetched.id, created.id);
  assert.equal(fetched.promptBundle.title, 'Prompt Title');

  const updated = await repository.update(created.id, {
    status: 'ready',
    interactions: [{ outcome: 'success', actionType: 'select', createdAt: new Date().toISOString() }],
  });
  assert.ok(updated);
  assert.equal(updated.status, 'ready');
  assert.equal(updated.interactions?.length, 1);

  const listed = await repository.listByStudent('student-1');
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, created.id);
  assert.equal(listed[0].status, 'ready');
});
