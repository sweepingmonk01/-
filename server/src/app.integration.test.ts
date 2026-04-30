import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { once } from 'node:events';
import { SignJWT } from 'jose';
import { createMobiusApp } from './app.js';
import { SQLiteLearningCycleRepository } from './modules/analytics/infrastructure/sqlite-learning-cycle-repository.js';
import { SQLiteStudentProfileRepository } from './modules/student-state/infrastructure/sqlite-student-profile-repository.js';
import { SQLiteStudentStateRepository } from './modules/student-state/infrastructure/sqlite-student-state-repository.js';

const TEST_PROJECT_ID = 'mobius-test-project';
const TEST_SECRET = 'mobius-test-secret';

const createAuthHeader = async (studentId: string) => {
  const token = await new SignJWT({
    sub: studentId,
    user_id: studentId,
    email: `${studentId}@example.com`,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(`https://securetoken.google.com/${TEST_PROJECT_ID}`)
    .setAudience(TEST_PROJECT_ID)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(TEST_SECRET));

  return {
    Authorization: `Bearer ${token}`,
  };
};

const buildExploreSyncRequest = () => ({
  snapshot: {
    userScope: {},
    completedNodes: [
      {
        id: `completed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        nodeKey: 'physics.symmetry_conservation',
        engineKey: 'world-engine',
        userScope: {},
        source: 'manual',
        syncStatus: 'pending-sync',
        completedAt: '2026-01-01T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    taskResults: [],
    mediaTasks: [],
    exportedAt: '2026-01-01T00:00:00.000Z',
    schemaVersion: 'explore-remote-v0.1',
  },
  clientMeta: {
    appVersion: 'test',
    schemaVersion: 'explore-remote-v0.1',
    source: 'test',
  },
});

const waitFor = async <T>(getValue: () => Promise<T | null>, timeoutMs: number = 1500): Promise<T> => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const value = await getValue();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }

  throw new Error('Timed out waiting for async job result.');
};

test('Mobius app enforces auth isolation and serves queued AI artifacts', { concurrency: false }, async (t) => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'liezi-app-integration-'));
  const dbFile = path.join(tempDir, 'mobius.sqlite');
  const envPatch = {
    MOBIUS_STORAGE_PROVIDER: 'sqlite',
    MOBIUS_SQLITE_DB_FILE: dbFile,
    MOBIUS_FIREBASE_PROJECT_ID: TEST_PROJECT_ID,
    MOBIUS_AUTH_TEST_SECRET: TEST_SECRET,
    MOBIUS_AGENT_JOB_POLL_MS: '25',
  };
  const previousEnv = Object.fromEntries(
    Object.keys(envPatch).map((key) => [key, process.env[key]]),
  );

  Object.assign(process.env, envPatch);

  const app = createMobiusApp();
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  const learningCycles = new SQLiteLearningCycleRepository({ dbFile });
  const profileRepo = new SQLiteStudentProfileRepository({ dbFile });
  const studentStates = new SQLiteStudentStateRepository({ dbFile });

  try {
    await t.test('reports readiness without exposing secrets', async () => {
      const response = await fetch(`${baseUrl}/api/health/ready`);
      assert.equal(response.status, 200);
      const payload = await response.json() as {
        dependencies: {
          ai: {
            configured: boolean;
            provider: string;
            flashModel: string;
            proModel: string;
            timeoutMs: number;
            maxRetries: number;
            apiKey?: string;
          };
        };
      };

      assert.equal(payload.dependencies.ai.configured, false);
      assert.equal(payload.dependencies.ai.provider, 'deepseek');
      assert.equal(payload.dependencies.ai.flashModel, 'deepseek-v4-flash');
      assert.equal(payload.dependencies.ai.proModel, 'deepseek-v4-pro');
      assert.equal(payload.dependencies.ai.timeoutMs, 30_000);
      assert.equal(payload.dependencies.ai.maxRetries, 1);
      assert.equal(payload.dependencies.ai.apiKey, undefined);
    });

    await t.test('rejects missing auth and mismatched studentId access', async () => {
      const unauthenticated = await fetch(`${baseUrl}/api/mobius/students/student-a/dashboard-stats`);
      assert.equal(unauthenticated.status, 401);

      const wrongUser = await fetch(`${baseUrl}/api/mobius/students/student-b/dashboard-stats`, {
        headers: await createAuthHeader('student-a'),
      });
      assert.equal(wrongUser.status, 403);
    });

    await t.test('enforces authenticated scope on Explore read and write APIs', async () => {
      const missingAuth = await fetch(`${baseUrl}/api/explore/progress`);
      assert.equal(missingAuth.status, 401);

      const unauthorizedScope = await fetch(`${baseUrl}/api/explore/snapshot?studentId=student-b`, {
        headers: await createAuthHeader('student-a'),
      });
      assert.equal(unauthorizedScope.status, 403);

      const forgedRequest = buildExploreSyncRequest();
      forgedRequest.snapshot.userScope = {
        userId: 'student-b',
        studentId: 'student-b',
      };
      const forgedWrite = await fetch(`${baseUrl}/api/explore/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await createAuthHeader('student-a')),
        },
        body: JSON.stringify(forgedRequest),
      });
      assert.equal(forgedWrite.status, 403);

      const writeStudentA = await fetch(`${baseUrl}/api/explore/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await createAuthHeader('student-a')),
        },
        body: JSON.stringify(buildExploreSyncRequest()),
      });
      assert.equal(writeStudentA.status, 200);

      const writeStudentB = await fetch(`${baseUrl}/api/explore/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await createAuthHeader('student-b')),
        },
        body: JSON.stringify(buildExploreSyncRequest()),
      });
      assert.equal(writeStudentB.status, 200);

      const studentARead = await fetch(`${baseUrl}/api/explore/snapshot`, {
        headers: await createAuthHeader('student-a'),
      });
      assert.equal(studentARead.status, 200);
      const studentAPayload = await studentARead.json() as {
        counts: { completedNodes: number };
        snapshot: {
          userScope: { userId?: string; studentId?: string };
          completedNodes: Array<{ userScope?: { userId?: string; studentId?: string } }>;
        };
      };
      assert.equal(studentAPayload.counts.completedNodes, 1);
      assert.equal(studentAPayload.snapshot.userScope.userId, 'student-a');
      assert.equal(studentAPayload.snapshot.userScope.studentId, 'student-a');
      assert.equal(studentAPayload.snapshot.completedNodes[0]?.userScope?.userId, 'student-a');
      assert.equal(studentAPayload.snapshot.completedNodes[0]?.userScope?.studentId, 'student-a');

      const studentABatches = await fetch(`${baseUrl}/api/explore/sync/batches`, {
        headers: await createAuthHeader('student-a'),
      });
      assert.equal(studentABatches.status, 200);
      const batchesPayload = await studentABatches.json() as {
        batches: Array<{ userId?: string; studentId?: string }>;
      };
      assert.equal(batchesPayload.batches.length, 1);
      assert.equal(batchesPayload.batches[0]?.userId, 'student-a');
      assert.equal(batchesPayload.batches[0]?.studentId, 'student-a');
    });

    await t.test('requires auth for standalone error diagnosis API mount', async () => {
      const unauthenticated = await fetch(`${baseUrl}/api/errors/diagnosis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ questionText: '阅读材料后需要结合上下文判断。' }),
      });
      assert.equal(unauthenticated.status, 401);

      const authenticated = await fetch(`${baseUrl}/api/errors/diagnosis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await createAuthHeader('student-a')),
        },
        body: JSON.stringify({ questionText: '阅读材料后需要结合上下文判断。' }),
      });
      assert.equal(authenticated.status, 200);
    });

    await t.test('serves foundation science seed nodes for exploration maps', async () => {
      const nodesResponse = await fetch(`${baseUrl}/api/mobius/content/foundation-science/nodes?domain=physics`, {
        headers: await createAuthHeader('student-a'),
      });
      assert.equal(nodesResponse.status, 200);
      const nodesPayload = await nodesResponse.json() as {
        items: Array<{
          key: string;
          label: string;
          domain: string;
          domainLayer: string;
          mediaPromptSeed?: { seedanceStoryboard?: string[] };
        }>;
      };
      assert.equal(nodesPayload.items.length, 9);
      assert.ok(nodesPayload.items.every((node) => node.domain === 'physics'));
      assert.ok(nodesPayload.items.some((node) => node.key === 'physics.symmetry_conservation'));
      assert.equal(nodesPayload.items[0]?.domainLayer, 'foundation-science');
      assert.ok((nodesPayload.items[0]?.mediaPromptSeed?.seedanceStoryboard?.length ?? 0) >= 3);

      const detailResponse = await fetch(`${baseUrl}/api/mobius/content/foundation-science/nodes/neuroscience.learning_memory`, {
        headers: await createAuthHeader('student-a'),
      });
      assert.equal(detailResponse.status, 200);
      const detailPayload = await detailResponse.json() as { item: { label: string; relatedCurriculumNodes: string[] } };
      assert.equal(detailPayload.item.label, '学习与记忆');
      assert.ok(detailPayload.item.relatedCurriculumNodes.includes('en-g4-grammar-there-be'));

      const edgesResponse = await fetch(`${baseUrl}/api/mobius/content/foundation-science/edges?domain=neuroscience`, {
        headers: await createAuthHeader('student-a'),
      });
      assert.equal(edgesResponse.status, 200);
      const edgesPayload = await edgesResponse.json() as { items: Array<{ source: string; kind: string }> };
      assert.ok(edgesPayload.items.some((edge) => edge.source === 'neuroscience.learning_memory' || edge.kind === 'supports-cognition'));
    });

    await t.test('returns dashboard stats for the authenticated student', async () => {
      await profileRepo.updateProfile('student-a', {
        targetScore: 118,
        timeSaved: 210,
        cognitiveState: { focus: 61, frustration: 16, joy: 58 },
      } as any);
      await profileRepo.addErrorRecord('student-a', 'dashboard-error', {
        painPoint: '函数图像',
        rule: '先看单调性',
      });
      await studentStates.create({
        studentId: 'student-a',
        source: 'interaction-resolved',
        interactionOutcome: 'failure',
        cognitiveState: { focus: 60, frustration: 24, joy: 50, confidence: 46, fatigue: 20 },
        profile: {
          painPoint: '函数图像',
          rule: '先看单调性',
          targetScore: 118,
          diagnosedMistakeCategories: [],
        },
      });

      const response = await fetch(`${baseUrl}/api/mobius/students/student-a/dashboard-stats`, {
        headers: await createAuthHeader('student-a'),
      });

      assert.equal(response.status, 200);
      const payload = await response.json() as {
        targetScore: number;
        activeIssuesCount: number;
        topPainPoints: string[];
      };
      assert.equal(payload.targetScore, 118);
      assert.equal(payload.activeIssuesCount, 1);
      assert.deepEqual(payload.topPainPoints, ['函数图像']);
    });

    await t.test('rejects invalid AI payloads before they reach service orchestration', async () => {
      const response = await fetch(`${baseUrl}/api/mobius/ai/dehydrate-homework`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await createAuthHeader('student-a')),
        },
        body: JSON.stringify({
          imageBase64: 'abc123',
          mimeType: 'image/png',
          targetScore: '115',
        }),
      });

      assert.equal(response.status, 400);
      const payload = await response.json() as { error: string };
      assert.match(payload.error, /Invalid dehydrate-homework payload/);
    });

    await t.test('serves demo AI fallbacks while keeping non-demo no-DeepSeek requests blocked', async () => {
      const demoAnalyze = await fetch(`${baseUrl}/api/mobius/ai/analyze-question-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mobius-demo-mode': 'true',
        },
        body: JSON.stringify({
          imageBase64: 'demo-question-image',
          mimeType: 'image/png',
        }),
      });

      assert.equal(demoAnalyze.status, 200);
      const analyzePayload = await demoAnalyze.json() as {
        painPoint: string;
        rule: string;
        options: string[];
        correctAnswer: string;
      };
      assert.ok(analyzePayload.painPoint.length > 0);
      assert.ok(analyzePayload.options.includes(analyzePayload.correctAnswer));

      const authedAnalyze = await fetch(`${baseUrl}/api/mobius/ai/analyze-question-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await createAuthHeader('student-a')),
        },
        body: JSON.stringify({
          imageBase64: 'demo-question-image',
          mimeType: 'image/png',
        }),
      });

      assert.equal(authedAnalyze.status, 503);

      const demoDehydrate = await fetch(`${baseUrl}/api/mobius/ai/dehydrate-homework`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mobius-demo-mode': 'true',
        },
        body: JSON.stringify({
          imageBase64: 'demo-homework-image',
          mimeType: 'image/jpeg',
          targetScore: 115,
        }),
      });

      assert.equal(demoDehydrate.status, 200);
      const dehydratePayload = await demoDehydrate.json() as {
        total: number;
        mustDo: number;
        mustDoIndices: string;
        strategicPlan?: { focusKnowledgePoints: string[] };
      };
      assert.ok(dehydratePayload.total >= dehydratePayload.mustDo);
      assert.match(dehydratePayload.mustDoIndices, /Q\d+/);
      assert.ok((dehydratePayload.strategicPlan?.focusKnowledgePoints.length ?? 0) >= 1);
    });

    await t.test('builds a knowledge graph through the queued graph weaver job', async () => {
      const createError = await fetch(`${baseUrl}/api/mobius/students/student-a/errors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await createAuthHeader('student-a')),
        },
        body: JSON.stringify({
          painPoint: '分式通分',
          rule: '先通分再约分',
          questionText: '化简分式并说明步骤',
          options: [],
        }),
      });

      assert.equal(createError.status, 200);

      const graph = await waitFor(async () => {
        const response = await fetch(`${baseUrl}/api/mobius/students/student-a/knowledge-graph`, {
          headers: await createAuthHeader('student-a'),
        });
        if (!response.ok) return null;
        const payload = await response.json() as { nodes: Array<{ label: string }>; edges: unknown[] };
        return payload.nodes.length ? payload : null;
      });

      assert.ok(graph.nodes.some((node) => node.label.includes('分式通分')));
      assert.ok(graph.edges.length >= 1);
    });

    await t.test('bootstraps a knowledge graph from existing active errors when the graph is empty', async () => {
      await profileRepo.addErrorRecord('student-b', 'bootstrap-error', {
        painPoint: '几何辅助线',
        rule: '见中点先想倍长中线',
        questionText: '已知中点，先补哪条线最稳？',
        options: [],
      });

      const response = await fetch(`${baseUrl}/api/mobius/students/student-b/knowledge-graph`, {
        headers: await createAuthHeader('student-b'),
      });

      assert.equal(response.status, 200);
      const payload = await response.json() as { nodes: Array<{ label: string }>; edges: unknown[] };
      assert.ok(payload.nodes.some((node) => node.label.includes('几何辅助线')));
      assert.ok(payload.nodes.length >= 1);
    });

    await t.test('returns a diagnostic thread on failure and isolates thread access by owner', async () => {
      const sessionResponse = await fetch(`${baseUrl}/api/mobius/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await createAuthHeader('student-a')),
        },
        body: JSON.stringify({
          studentId: 'student-a',
          painPoint: '几何辅助线',
          rule: '见中点先想中线',
          knowledgeAction: {
            id: 'action-1',
            label: '先补中线',
            actionType: 'draw',
            instruction: '先画出最稳辅助线',
            successCriteria: ['先补中线再判断'],
            failureSignals: ['直接猜答案'],
          },
          diagnosedMistakes: [],
        }),
      });
      assert.equal(sessionResponse.status, 201);
      const session = await sessionResponse.json() as {
        cycleId?: string;
        strategyDecision?: { selectedStrategy?: string };
        video?: { jobId?: string };
        story?: { strategyDecision?: { selectedStrategy?: string; candidates?: unknown[] } };
      };
      assert.ok(session.cycleId);
      assert.ok(session.video?.jobId);
      assert.equal(session.strategyDecision?.selectedStrategy, 'probe');
      assert.equal(session.story?.strategyDecision?.selectedStrategy, 'probe');
      assert.equal(session.story?.strategyDecision?.candidates?.length, 3);

      const failureResponse = await fetch(`${baseUrl}/api/mobius/media-jobs/${session.video.jobId}/interactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await createAuthHeader('student-a')),
        },
        body: JSON.stringify({
          outcome: 'failure',
          actionType: 'draw',
        }),
      });
      assert.equal(failureResponse.status, 200);

      const failurePayload = await failureResponse.json() as {
        cycleId?: string;
        outcome: string;
        strategyDecision?: { selectedStrategy?: string; candidates?: unknown[] };
        diagnosticThread?: {
          id: string;
          cycleId?: string;
          status: string;
          messages: Array<{ role: string; content: string }>;
        };
      };
      assert.equal(failurePayload.cycleId, session.cycleId);
      assert.equal(failurePayload.outcome, 'failure');
      assert.ok(['probe', 'teach', 'review'].includes(failurePayload.strategyDecision?.selectedStrategy ?? ''));
      assert.equal(failurePayload.strategyDecision?.candidates?.length, 3);
      assert.ok(failurePayload.diagnosticThread?.id);
      assert.equal(failurePayload.diagnosticThread?.cycleId, session.cycleId);
      assert.equal(failurePayload.diagnosticThread?.status, 'active');
      assert.equal(failurePayload.diagnosticThread?.messages.length, 1);

      const cycle = await learningCycles.getByMediaJobId(session.video.jobId);
      assert.ok(cycle);
      assert.equal(cycle.status, 'diagnosed');
      assert.equal(cycle.id, session.cycleId);
      assert.equal(cycle.outcome, 'failure');
      assert.ok(cycle.stateAfter);
      assert.equal(cycle.selectedAction?.selectedStrategy, 'probe');
      assert.equal(cycle.selectedAction?.strategyCandidates?.length, 3);
      assert.equal(cycle.hypothesisSummary?.source, 'heuristic-v1');
      assert.ok(Array.isArray(cycle.hypothesisSummary?.candidates));

      const events = await learningCycles.listEvents(cycle.id);
      assert.deepEqual(
        events.map((event) => event.eventType),
        [
          'cycle.started',
          'state.snapshot.before',
          'action.selected',
          'interaction.resolved',
          'state.snapshot.after',
          'effect.evaluated',
          'action.selected',
          'hypothesis.summary.updated',
          'diagnostic.thread.created',
        ],
      );

      const cyclesResponse = await fetch(`${baseUrl}/api/mobius/students/student-a/learning-cycles?limit=10`, {
        headers: await createAuthHeader('student-a'),
      });
      assert.equal(cyclesResponse.status, 200);
      const cyclesPayload = await cyclesResponse.json() as {
        evaluation: {
          totalCycles: number;
          completedCycles: number;
          successCount: number;
          failureCount: number;
          successRate: number;
          averageEffectScore: number;
          painPointTrends: Array<{
            painPoint: string;
            attempts: number;
            latestOutcome?: string;
          }>;
        };
        cycles: Array<{
          id: string;
          outcome?: string;
          effectScore?: number;
          selectedStrategy?: string;
        }>;
      };
      assert.ok(cyclesPayload.evaluation.totalCycles >= 1);
      assert.ok(cyclesPayload.evaluation.completedCycles >= 1);
      assert.ok(cyclesPayload.evaluation.failureCount >= 1);
      assert.equal(cyclesPayload.evaluation.successRate, 0);
      assert.equal(cyclesPayload.evaluation.averageEffectScore, 0);
      assert.ok(cyclesPayload.evaluation.painPointTrends.some((item) => item.painPoint === '几何辅助线'));
      assert.ok(cyclesPayload.cycles.some((item) => item.id === session.cycleId));

      const cycleReportResponse = await fetch(
        `${baseUrl}/api/mobius/students/student-a/learning-cycles/${session.cycleId}/report`,
        {
          headers: await createAuthHeader('student-a'),
        },
      );
      assert.equal(cycleReportResponse.status, 200);
      const cycleReport = await cycleReportResponse.json() as {
        cycle: {
          id: string;
          outcome?: string;
          effectScore?: number;
        };
        flow: {
          stateBefore?: unknown;
          hypothesis?: unknown;
          selectedAction?: { selectedStrategy?: string };
          result: { outcome?: string; effectScore?: number; status: string };
          stateAfter?: unknown;
          events: Array<{ eventType: string }>;
        };
      };
      assert.equal(cycleReport.cycle.id, session.cycleId);
      assert.equal(cycleReport.flow.result.outcome, 'failure');
      assert.equal(cycleReport.flow.result.effectScore, 0);
      assert.ok(cycleReport.flow.stateBefore);
      assert.ok(cycleReport.flow.stateAfter);
      assert.ok(cycleReport.flow.hypothesis);
      assert.equal(cycleReport.flow.selectedAction?.selectedStrategy, 'probe');
      assert.deepEqual(
        cycleReport.flow.events.map((event) => event.eventType),
        events.map((event) => event.eventType),
      );

      const forbiddenCycleReport = await fetch(
        `${baseUrl}/api/mobius/students/student-b/learning-cycles/${session.cycleId}/report`,
        {
          headers: await createAuthHeader('student-b'),
        },
      );
      assert.equal(forbiddenCycleReport.status, 404);

      const forbiddenThreadRead = await fetch(
        `${baseUrl}/api/mobius/ai/socratic-diagnostic/threads/${failurePayload.diagnosticThread?.id}`,
        {
          headers: await createAuthHeader('student-b'),
        },
      );
      assert.equal(forbiddenThreadRead.status, 403);
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    for (const [key, value] of Object.entries(previousEnv)) {
      if (typeof value === 'undefined') {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});

test('Mobius app disables demo header auth by default in production', { concurrency: false }, async () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'liezi-app-production-auth-'));
  const envPatch = {
    NODE_ENV: 'production',
    MOBIUS_STORAGE_PROVIDER: 'sqlite',
    MOBIUS_SQLITE_DB_FILE: path.join(tempDir, 'mobius.sqlite'),
    MOBIUS_FIREBASE_PROJECT_ID: TEST_PROJECT_ID,
    MOBIUS_AUTH_TEST_SECRET: TEST_SECRET,
  };
  const previousEnv = Object.fromEntries(
    Object.keys(envPatch)
      .concat('MOBIUS_DEMO_MODE_ENABLED')
      .map((key) => [key, process.env[key]]),
  );

  Object.assign(process.env, envPatch);
  delete process.env.MOBIUS_DEMO_MODE_ENABLED;

  const app = createMobiusApp();
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const response = await fetch(`${baseUrl}/api/mobius/ai/analyze-question-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-mobius-demo-mode': 'true',
      },
      body: JSON.stringify({
        imageBase64: 'demo-question-image',
        mimeType: 'image/png',
      }),
    });

    assert.equal(response.status, 403);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    for (const [key, value] of Object.entries(previousEnv)) {
      if (typeof value === 'undefined') {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});
