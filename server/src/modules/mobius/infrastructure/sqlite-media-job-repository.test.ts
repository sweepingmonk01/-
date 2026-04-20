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
