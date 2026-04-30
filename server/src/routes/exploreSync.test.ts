import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import { createExploreSyncRouter } from './exploreSync.js';
import { SQLiteExploreSyncStore } from '../storage/exploreSyncDbStore.js';

function createTestApp(store: SQLiteExploreSyncStore) {
  const app = express();
  app.use(express.json());
  app.use('/api/explore', createExploreSyncRouter(store));
  return app;
}

function buildValidRequest() {
  return {
    snapshot: {
      userScope: {
        userId: 'local-user',
        studentId: 'local-student',
        deviceId: 'local-device',
        sessionId: 'local-session',
      },
      completedNodes: [
        {
          id: 'completed-node-a',
          nodeKey: 'node-a',
          engineKey: 'engine-a',
          userScope: {
            userId: 'local-user',
          },
          source: 'manual',
          syncStatus: 'pending-sync',
          completedAt: '2026-01-01T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      taskResults: [
        {
          id: 'task-result-a',
          localId: 'local-task-result-a',
          nodeKey: 'node-a',
          engineKey: 'engine-a',
          taskTitle: 'Explain the pattern',
          taskType: 'reflection',
          userAnswer: 'The pattern repeats because the rule is stable.',
          reflectionText: 'Next time I will name the rule first.',
          qualityScore: 0.82,
          qualityLevel: 'excellent',
          userScope: {
            userId: 'local-user',
          },
          syncStatus: 'pending-sync',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      mediaTasks: [
        {
          id: 'media-task-a',
          localId: 'local-media-task-a',
          nodeKey: 'node-a',
          engineKey: 'engine-a',
          type: 'gpt-image',
          prompt: 'Visualize the learning pattern.',
          status: 'draft',
          userScope: {
            userId: 'local-user',
          },
          syncStatus: 'pending-sync',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      exportedAt: '2026-01-01T00:00:00.000Z',
      schemaVersion: 'explore-remote-v0.1',
    },
    clientMeta: {
      appVersion: 'local-dev',
      schemaVersion: 'explore-remote-v0.1',
      source: 'web',
    },
  };
}

test('Explore sync API rejects empty snapshots and persists valid snapshots', async (t) => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'liezi-explore-sync-'));
  const store = new SQLiteExploreSyncStore({
    dbFile: path.join(tempDir, 'explore.sqlite'),
  });

  const app = createTestApp(store);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(() => {
    server.close();
  });

  await t.test('returns an empty snapshot before data exists', async () => {
    const response = await fetch(`${baseUrl}/api/explore/snapshot?userId=local-user&studentId=local-student`);

    assert.equal(response.status, 200);
    const payload = await response.json() as {
      ok: boolean;
      snapshot: {
        completedNodes: unknown[];
        taskResults: unknown[];
        mediaTasks: unknown[];
      };
      counts: {
        completedNodes: number;
        taskResults: number;
        mediaTasks: number;
      };
    };

    assert.equal(payload.ok, true);
    assert.deepEqual(payload.counts, {
      completedNodes: 0,
      taskResults: 0,
      mediaTasks: 0,
    });
    assert.deepEqual(payload.snapshot.completedNodes, []);
    assert.deepEqual(payload.snapshot.taskResults, []);
    assert.deepEqual(payload.snapshot.mediaTasks, []);
  });

  await t.test('returns a seed learning profile before data exists', async () => {
    const response = await fetch(`${baseUrl}/api/explore/profile?userId=local-user&studentId=local-student`);

    assert.equal(response.status, 200);
    const payload = await response.json() as {
      ok: boolean;
      profile: {
        worldModelIndex: number;
        mindModelIndex: number;
        meaningModelIndex: number;
        actionMechanismIndex: number;
        activeStructuralIntelligence: number;
        stage: string;
        recommendedNodeKey?: string;
      };
      progress: {
        completedNodes: number;
        taskResults: number;
        mediaTasks: number;
      };
      generatedAt?: string;
    };

    assert.equal(payload.ok, true);
    assert.equal(payload.profile.stage, 'seed');
    assert.equal(typeof payload.profile.worldModelIndex, 'number');
    assert.equal(typeof payload.profile.mindModelIndex, 'number');
    assert.equal(typeof payload.profile.meaningModelIndex, 'number');
    assert.equal(typeof payload.profile.actionMechanismIndex, 'number');
    assert.equal(typeof payload.profile.activeStructuralIntelligence, 'number');
    assert.ok(payload.profile.recommendedNodeKey);
    assert.equal(payload.progress.completedNodes, 0);
    assert.equal(payload.progress.taskResults, 0);
    assert.equal(payload.progress.mediaTasks, 0);
    assert.ok(payload.generatedAt);
    assert.equal(store.countRows('explore_learning_profile_snapshots'), 0);
  });

  await t.test('returns an empty learning profile history before snapshots are saved', async () => {
    const response = await fetch(`${baseUrl}/api/explore/profile/history?userId=local-user&studentId=local-student`);

    assert.equal(response.status, 200);
    const payload = await response.json() as {
      ok: boolean;
      snapshots: unknown[];
    };

    assert.equal(payload.ok, true);
    assert.deepEqual(payload.snapshots, []);
  });

  await t.test('rejects empty snapshot', async () => {
    const request = buildValidRequest();
    request.snapshot.completedNodes = [];
    request.snapshot.taskResults = [];
    request.snapshot.mediaTasks = [];

    const response = await fetch(`${baseUrl}/api/explore/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    assert.equal(response.status, 400);
    const payload = await response.json() as {
      ok: boolean;
      errors: Array<{ code: string }>;
    };
    assert.equal(payload.ok, false);
    assert.equal(payload.errors[0]?.code, 'EMPTY_SNAPSHOT');
  });

  await t.test('accepts valid snapshot and persists all explore tables', async () => {
    const response = await fetch(`${baseUrl}/api/explore/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildValidRequest()),
    });

    assert.equal(response.status, 200);
    const payload = await response.json() as {
      ok: boolean;
      remoteBatchId?: string;
      syncedAt?: string;
      acceptedCounts?: {
        completedNodes: number;
        taskResults: number;
        mediaTasks: number;
      };
      message?: string;
    };
    assert.equal(payload.ok, true);
    assert.match(payload.remoteBatchId ?? '', /^batch_\d+$/);
    assert.ok(payload.syncedAt);
    assert.deepEqual(payload.acceptedCounts, {
      completedNodes: 1,
      taskResults: 1,
      mediaTasks: 1,
    });
    assert.equal(payload.message, 'Synced 3 explore records.');
    assert.equal(store.countRows('explore_sync_batches'), 1);
    assert.equal(store.countRows('explore_completed_nodes'), 1);
    assert.equal(store.countRows('explore_task_results'), 1);
    assert.equal(store.countRows('explore_media_tasks'), 1);
    assert.equal(store.countRows('explore_learning_profile_snapshots'), 0);
  });

  await t.test('reads the persisted snapshot by user scope', async () => {
    const response = await fetch(`${baseUrl}/api/explore/snapshot?userId=local-user&studentId=local-student`);

    assert.equal(response.status, 200);
    const payload = await response.json() as {
      ok: boolean;
      snapshot: {
        completedNodes: Array<{ id: string; syncStatus: string }>;
        taskResults: Array<{ id: string; syncStatus: string; qualityScore: number }>;
        mediaTasks: Array<{ id: string; syncStatus: string; type: string }>;
      };
      counts: {
        completedNodes: number;
        taskResults: number;
        mediaTasks: number;
      };
    };

    assert.equal(payload.ok, true);
    assert.deepEqual(payload.counts, {
      completedNodes: 1,
      taskResults: 1,
      mediaTasks: 1,
    });
    assert.equal(payload.snapshot.completedNodes[0]?.id, 'completed-node-a');
    assert.equal(payload.snapshot.completedNodes[0]?.syncStatus, 'synced');
    assert.equal(payload.snapshot.taskResults[0]?.id, 'task-result-a');
    assert.equal(payload.snapshot.taskResults[0]?.qualityScore, 0.82);
    assert.equal(payload.snapshot.mediaTasks[0]?.id, 'media-task-a');
    assert.equal(payload.snapshot.mediaTasks[0]?.type, 'gpt-image');
  });

  await t.test('aggregates progress by count, engine, quality, and latest sync time', async () => {
    const response = await fetch(`${baseUrl}/api/explore/progress?userId=local-user&studentId=local-student`);

    assert.equal(response.status, 200);
    const payload = await response.json() as {
      ok: boolean;
      progress: {
        completedNodes: number;
        taskResults: number;
        mediaTasks: number;
        engines: {
          worldEngine: number;
          mindEngine: number;
          meaningEngine: number;
          gameTopologyEngine: number;
          unknown: number;
        };
        averageTaskQuality: number;
        latestSyncedAt?: string;
      };
    };

    assert.equal(payload.ok, true);
    assert.equal(payload.progress.completedNodes, 1);
    assert.equal(payload.progress.taskResults, 1);
    assert.equal(payload.progress.mediaTasks, 1);
    assert.deepEqual(payload.progress.engines, {
      worldEngine: 0,
      mindEngine: 0,
      meaningEngine: 0,
      gameTopologyEngine: 0,
      unknown: 1,
    });
    assert.equal(payload.progress.averageTaskQuality, 0.82);
    assert.ok(payload.progress.latestSyncedAt);
  });

  await t.test('builds a learning profile from persisted progress', async () => {
    const response = await fetch(`${baseUrl}/api/explore/profile?userId=local-user&studentId=local-student`);

    assert.equal(response.status, 200);
    const payload = await response.json() as {
      ok: boolean;
      profile: {
        worldModelIndex: number;
        mindModelIndex: number;
        meaningModelIndex: number;
        actionMechanismIndex: number;
        activeStructuralIntelligence: number;
        stage: string;
        recommendedNodeKey?: string;
      };
      progress: {
        completedNodes: number;
        taskResults: number;
        mediaTasks: number;
        averageTaskQuality: number;
      };
      generatedAt?: string;
    };

    assert.equal(payload.ok, true);
    assert.equal(typeof payload.profile.worldModelIndex, 'number');
    assert.equal(typeof payload.profile.mindModelIndex, 'number');
    assert.equal(typeof payload.profile.meaningModelIndex, 'number');
    assert.equal(typeof payload.profile.actionMechanismIndex, 'number');
    assert.equal(typeof payload.profile.activeStructuralIntelligence, 'number');
    assert.ok(payload.profile.recommendedNodeKey);
    assert.equal(payload.progress.completedNodes, 1);
    assert.equal(payload.progress.taskResults, 1);
    assert.equal(payload.progress.mediaTasks, 1);
    assert.equal(payload.progress.averageTaskQuality, 0.82);
    assert.ok(payload.generatedAt);
    assert.equal(store.countRows('explore_learning_profile_snapshots'), 0);
  });

  await t.test('saves a learning profile snapshot only through the explicit snapshot endpoint', async () => {
    const response = await fetch(`${baseUrl}/api/explore/profile/snapshot?userId=local-user&studentId=local-student`, {
      method: 'POST',
    });

    assert.equal(response.status, 200);
    const payload = await response.json() as {
      ok: boolean;
      snapshotSaved: boolean;
      message?: string;
      profile: {
        activeStructuralIntelligence: number;
        recommendedNodeKey?: string;
      };
      progress: {
        completedNodes: number;
        taskResults: number;
        mediaTasks: number;
      };
      generatedAt?: string;
    };

    assert.equal(payload.ok, true);
    assert.equal(payload.snapshotSaved, true);
    assert.equal(payload.message, '御风快照已保存。');
    assert.equal(typeof payload.profile.activeStructuralIntelligence, 'number');
    assert.ok(payload.profile.recommendedNodeKey);
    assert.equal(payload.progress.completedNodes, 1);
    assert.equal(payload.progress.taskResults, 1);
    assert.equal(payload.progress.mediaTasks, 1);
    assert.ok(payload.generatedAt);
    assert.equal(store.countRows('explore_learning_profile_snapshots'), 1);
  });

  await t.test('reads learning profile history with index fields', async () => {
    const response = await fetch(`${baseUrl}/api/explore/profile/history?userId=local-user&studentId=local-student&limit=20`);

    assert.equal(response.status, 200);
    const payload = await response.json() as {
      ok: boolean;
      snapshots: Array<{
        id: string;
        worldModelIndex: number;
        mindModelIndex: number;
        meaningModelIndex: number;
        actionMechanismIndex: number;
        activeStructuralIntelligence: number;
        dominantStrength: string;
        dominantWeakness: string;
        stage: string;
        recommendedNodeKey?: string;
        generatedAt: string;
        source: string;
        createdBy: string;
      }>;
    };

    assert.equal(payload.ok, true);
    assert.equal(payload.snapshots.length, 1);
    assert.ok(payload.snapshots[0]?.id);
    assert.equal(typeof payload.snapshots[0]?.worldModelIndex, 'number');
    assert.equal(typeof payload.snapshots[0]?.mindModelIndex, 'number');
    assert.equal(typeof payload.snapshots[0]?.meaningModelIndex, 'number');
    assert.equal(typeof payload.snapshots[0]?.actionMechanismIndex, 'number');
    assert.equal(typeof payload.snapshots[0]?.activeStructuralIntelligence, 'number');
    assert.ok(payload.snapshots[0]?.dominantStrength);
    assert.ok(payload.snapshots[0]?.dominantWeakness);
    assert.ok(payload.snapshots[0]?.stage);
    assert.ok(payload.snapshots[0]?.recommendedNodeKey);
    assert.ok(payload.snapshots[0]?.generatedAt);
    assert.equal(payload.snapshots[0]?.source, 'manual');
    assert.equal(payload.snapshots[0]?.createdBy, 'learner');
  });

  await t.test('limits learning profile history results', async () => {
    await fetch(`${baseUrl}/api/explore/profile/snapshot?userId=local-user&studentId=local-student`, {
      method: 'POST',
    });

    const response = await fetch(`${baseUrl}/api/explore/profile/history?userId=local-user&studentId=local-student&limit=1`);

    assert.equal(response.status, 200);
    const payload = await response.json() as {
      ok: boolean;
      snapshots: unknown[];
    };

    assert.equal(payload.ok, true);
    assert.equal(payload.snapshots.length, 1);
  });

  await t.test('lists recent sync batches for debugging', async () => {
    const response = await fetch(`${baseUrl}/api/explore/sync/batches?limit=5`);

    assert.equal(response.status, 200);
    const payload = await response.json() as {
      ok: boolean;
      batches: Array<{
        id: string;
        userId?: string;
        studentId?: string;
        acceptedCompletedNodes: number;
        acceptedTaskResults: number;
        acceptedMediaTasks: number;
        createdAt: string;
      }>;
    };

    assert.equal(payload.ok, true);
    assert.equal(payload.batches.length, 1);
    assert.equal(payload.batches[0]?.userId, 'local-user');
    assert.equal(payload.batches[0]?.studentId, 'local-student');
    assert.equal(payload.batches[0]?.acceptedCompletedNodes, 1);
    assert.equal(payload.batches[0]?.acceptedTaskResults, 1);
    assert.equal(payload.batches[0]?.acceptedMediaTasks, 1);
    assert.ok(payload.batches[0]?.createdAt);
  });
});
