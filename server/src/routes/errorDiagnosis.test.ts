import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { errorDiagnosisRouter } from './errorDiagnosis.js';
import type { AIErrorMistakeKey } from '../diagnosis/errorDiagnosisTypes.js';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/errors', errorDiagnosisRouter);
  return app;
}

async function postDiagnosis(
  baseUrl: string,
  body: Record<string, unknown>,
) {
  return fetch(`${baseUrl}/api/errors/diagnosis`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function restoreDiagnosisProvider(value: string | undefined) {
  if (value === undefined) {
    delete process.env.DIAGNOSIS_PROVIDER;
    return;
  }

  process.env.DIAGNOSIS_PROVIDER = value;
}

function restoreOptionalEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

test('Mock error diagnosis API route validates input and returns deterministic mock diagnoses', async (t) => {
  const originalProvider = process.env.DIAGNOSIS_PROVIDER;
  const originalAllowRealAi = process.env.ALLOW_REAL_AI_DIAGNOSIS;
  const originalApiKey = process.env.REAL_AI_DIAGNOSIS_API_KEY;
  delete process.env.DIAGNOSIS_PROVIDER;
  delete process.env.ALLOW_REAL_AI_DIAGNOSIS;
  delete process.env.REAL_AI_DIAGNOSIS_API_KEY;
  const app = createTestApp();
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(() => {
    restoreDiagnosisProvider(originalProvider);
    restoreOptionalEnv('ALLOW_REAL_AI_DIAGNOSIS', originalAllowRealAi);
    restoreOptionalEnv('REAL_AI_DIAGNOSIS_API_KEY', originalApiKey);
    server.close();
  });

  await t.test('returns 400 ok:false for empty requests', async () => {
    const response = await postDiagnosis(baseUrl, {});

    assert.equal(response.status, 400);
    const payload = await response.json() as {
      ok: boolean;
      diagnosis: null;
      errors: Array<{ code: string; message: string; path: string }>;
      diagnosedAt?: string;
      provider?: string;
    };

    assert.equal(payload.ok, false);
    assert.equal(payload.diagnosis, null);
    assert.equal(payload.errors[0]?.code, 'MISSING_DIAGNOSIS_INPUT');
    assert.equal(
      payload.errors[0]?.message,
      'At least one of questionText, painPoint, or rule is required.',
    );
    assert.equal(payload.errors[0]?.path, 'body');
    assert.ok(payload.diagnosedAt);
    assert.equal(payload.provider, 'mock');
  });

  const cases: Array<{
    name: string;
    body: Record<string, unknown>;
    mistakeKey: AIErrorMistakeKey;
  }> = [
    {
      name: 'maps context and reading text to context_misread',
      body: {
        questionText: '这道阅读题没有结合上下文和语境判断人物动机。',
      },
      mistakeKey: 'context_misread',
    },
    {
      name: 'maps rule and formula text to rule_mismatch',
      body: {
        questionText: '学生套错公式，没有先识别题目规则和运算关系。',
      },
      mistakeKey: 'rule_mismatch',
    },
    {
      name: 'maps attention text to attention_distracted',
      body: {
        questionText: '这次是粗心看错条件，注意力被干扰项带偏。',
      },
      mistakeKey: 'attention_distracted',
    },
    {
      name: 'returns unknown when no keyword matches',
      body: {
        questionText: '这道题需要重新整理信息，再决定下一步。',
      },
      mistakeKey: 'unknown',
    },
  ];

  for (const item of cases) {
    await t.test(item.name, async () => {
      const response = await postDiagnosis(baseUrl, item.body);

      assert.equal(response.status, 200);
      const payload = await response.json() as {
        ok: boolean;
        diagnosis: {
          mistakeKey: AIErrorMistakeKey;
          recommendedExploreNodes: {
            primaryNodeKey?: string;
          };
        };
        diagnosedAt?: string;
        provider?: string;
      };

      assert.equal(payload.ok, true);
      assert.equal(payload.diagnosis.mistakeKey, item.mistakeKey);
      assert.ok(payload.diagnosis.recommendedExploreNodes.primaryNodeKey);
      assert.ok(payload.diagnosedAt);
      assert.equal(payload.provider, 'mock');
    });
  }

  await t.test('accepts the documented nested errorInput shape', async () => {
    const response = await postDiagnosis(baseUrl, {
      schemaVersion: 'ai-error-diagnosis-v0.1',
      errorInput: {
        questionText: '阅读材料后需要结合上下文判断。',
        subject: 'zh',
      },
      clientMeta: {
        appVersion: 'test',
        source: 'test',
      },
    });

    assert.equal(response.status, 200);
    const payload = await response.json() as {
      diagnosis: {
        mistakeKey: AIErrorMistakeKey;
        recommendedExploreNodes: {
          primaryNodeKey: string;
        };
      };
      provider?: string;
    };

    assert.equal(payload.diagnosis.mistakeKey, 'context_misread');
    assert.equal(payload.diagnosis.recommendedExploreNodes.primaryNodeKey, 'language.context');
    assert.equal(payload.provider, 'mock');
  });

  await t.test('returns real-ai-stub provider errors when explicitly selected', async () => {
    process.env.DIAGNOSIS_PROVIDER = 'real-ai-stub';

    const response = await postDiagnosis(baseUrl, {
      questionText: '阅读材料后需要结合上下文判断。',
    });

    assert.equal(response.status, 500);
    const payload = await response.json() as {
      ok: boolean;
      diagnosis: null;
      errors: Array<{ code: string; message: string; path?: string }>;
      diagnosedAt?: string;
      provider?: string;
    };

    assert.equal(payload.ok, false);
    assert.equal(payload.diagnosis, null);
    assert.equal(payload.provider, 'real-ai-stub');
    assert.equal(payload.errors[0]?.code, 'REAL_AI_NOT_ALLOWED');
    assert.equal(payload.errors[0]?.path, 'allowRealAi');
    assert.ok(payload.diagnosedAt);

    restoreDiagnosisProvider(originalProvider);
  });

  await t.test('returns stub-only error when real-ai-stub safety gate passes', async () => {
    process.env.DIAGNOSIS_PROVIDER = 'real-ai-stub';
    process.env.ALLOW_REAL_AI_DIAGNOSIS = 'true';
    process.env.REAL_AI_DIAGNOSIS_API_KEY = 'placeholder';

    const response = await postDiagnosis(baseUrl, {
      questionText: '阅读材料后需要结合上下文判断。',
    });

    assert.equal(response.status, 500);
    const payload = await response.json() as {
      ok: boolean;
      diagnosis: null;
      errors: Array<{ code: string; message: string; path?: string }>;
      diagnosedAt?: string;
      provider?: string;
    };

    assert.equal(payload.ok, false);
    assert.equal(payload.diagnosis, null);
    assert.equal(payload.provider, 'real-ai-stub');
    assert.equal(payload.errors[0]?.code, 'REAL_AI_PROVIDER_STUB_ONLY');
    assert.equal(payload.errors[0]?.path, 'provider');
    assert.ok(payload.diagnosedAt);

    restoreDiagnosisProvider(originalProvider);
    restoreOptionalEnv('ALLOW_REAL_AI_DIAGNOSIS', originalAllowRealAi);
    restoreOptionalEnv('REAL_AI_DIAGNOSIS_API_KEY', originalApiKey);
  });

  await t.test('returns dry-run fixture diagnosis when real-ai-dry-run safety gate passes', async () => {
    process.env.DIAGNOSIS_PROVIDER = 'real-ai-dry-run';
    process.env.ALLOW_REAL_AI_DIAGNOSIS = 'true';
    process.env.REAL_AI_DIAGNOSIS_API_KEY = 'placeholder';

    const response = await postDiagnosis(baseUrl, {
      questionText: '阅读材料后需要结合上下文判断。',
    });

    assert.equal(response.status, 200);
    const payload = await response.json() as {
      ok: boolean;
      diagnosis: {
        mistakeKey: AIErrorMistakeKey;
      };
      errors: Array<{ code: string; message: string; path?: string }>;
      diagnosedAt?: string;
      provider?: string;
    };

    assert.equal(payload.ok, true);
    assert.equal(payload.provider, 'real-ai-dry-run');
    assert.equal(payload.diagnosis.mistakeKey, 'context_misread');
    assert.deepEqual(payload.errors, []);
    assert.ok(payload.diagnosedAt);

    restoreDiagnosisProvider(originalProvider);
    restoreOptionalEnv('ALLOW_REAL_AI_DIAGNOSIS', originalAllowRealAi);
    restoreOptionalEnv('REAL_AI_DIAGNOSIS_API_KEY', originalApiKey);
  });
});
