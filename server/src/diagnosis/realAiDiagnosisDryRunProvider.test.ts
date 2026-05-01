import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDiagnosisProvider,
  getDefaultDiagnosisProvider,
} from './diagnosisProviderFactory.js';
import { realAiDiagnosisDryRunProvider } from './realAiDiagnosisDryRunProvider.js';
import { diagnosisPromptOutputFixture } from './prompt/diagnosisPromptFixtures.js';

function restoreOptionalEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function restoreDiagnosisEnv(
  provider: string | undefined,
  allow: string | undefined,
  key: string | undefined,
) {
  restoreOptionalEnv('DIAGNOSIS_PROVIDER', provider);
  restoreOptionalEnv('ALLOW_REAL_AI_DIAGNOSIS', allow);
  restoreOptionalEnv('REAL_AI_DIAGNOSIS_API_KEY', key);
}

test('diagnosis provider factory defaults to mock', () => {
  const originalProvider = process.env.DIAGNOSIS_PROVIDER;
  delete process.env.DIAGNOSIS_PROVIDER;

  try {
    assert.equal(getDefaultDiagnosisProvider().name, 'mock');
  } finally {
    restoreOptionalEnv('DIAGNOSIS_PROVIDER', originalProvider);
  }
});

test('diagnosis provider factory supports real-ai-dry-run', () => {
  const originalProvider = process.env.DIAGNOSIS_PROVIDER;
  process.env.DIAGNOSIS_PROVIDER = 'real-ai-dry-run';

  try {
    assert.equal(createDiagnosisProvider('real-ai-dry-run').name, 'real-ai-dry-run');
    assert.equal(getDefaultDiagnosisProvider().name, 'real-ai-dry-run');
  } finally {
    restoreOptionalEnv('DIAGNOSIS_PROVIDER', originalProvider);
  }
});

test('realAiDiagnosisDryRunProvider returns safety errors when gate is not allowed', async () => {
  const originalProvider = process.env.DIAGNOSIS_PROVIDER;
  const originalAllow = process.env.ALLOW_REAL_AI_DIAGNOSIS;
  const originalKey = process.env.REAL_AI_DIAGNOSIS_API_KEY;
  process.env.DIAGNOSIS_PROVIDER = 'real-ai-dry-run';
  delete process.env.ALLOW_REAL_AI_DIAGNOSIS;
  delete process.env.REAL_AI_DIAGNOSIS_API_KEY;

  try {
    const result = await realAiDiagnosisDryRunProvider.diagnose({
      questionText: '阅读材料后需要结合上下文判断。',
    });

    assert.equal(result.ok, false);
    assert.equal(result.diagnosis, null);
    assert.equal(result.provider, 'real-ai-dry-run');
    assert.equal(result.errors?.[0]?.code, 'REAL_AI_NOT_ALLOWED');
  } finally {
    restoreDiagnosisEnv(originalProvider, originalAllow, originalKey);
  }
});

test('realAiDiagnosisDryRunProvider requires API key presence after allow is enabled', async () => {
  const originalProvider = process.env.DIAGNOSIS_PROVIDER;
  const originalAllow = process.env.ALLOW_REAL_AI_DIAGNOSIS;
  const originalKey = process.env.REAL_AI_DIAGNOSIS_API_KEY;
  process.env.DIAGNOSIS_PROVIDER = 'real-ai-dry-run';
  process.env.ALLOW_REAL_AI_DIAGNOSIS = 'true';
  delete process.env.REAL_AI_DIAGNOSIS_API_KEY;

  try {
    const result = await realAiDiagnosisDryRunProvider.diagnose({
      questionText: '阅读材料后需要结合上下文判断。',
    });

    assert.equal(result.ok, false);
    assert.equal(result.diagnosis, null);
    assert.equal(result.provider, 'real-ai-dry-run');
    assert.equal(result.errors?.[0]?.code, 'REAL_AI_API_KEY_MISSING');
  } finally {
    restoreDiagnosisEnv(originalProvider, originalAllow, originalKey);
  }
});

test('realAiDiagnosisDryRunProvider returns fixture diagnosis after safety and validation pass', async () => {
  const originalProvider = process.env.DIAGNOSIS_PROVIDER;
  const originalAllow = process.env.ALLOW_REAL_AI_DIAGNOSIS;
  const originalKey = process.env.REAL_AI_DIAGNOSIS_API_KEY;
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  process.env.DIAGNOSIS_PROVIDER = 'real-ai-dry-run';
  process.env.ALLOW_REAL_AI_DIAGNOSIS = 'true';
  process.env.REAL_AI_DIAGNOSIS_API_KEY = 'placeholder';
  globalThis.fetch = (async () => {
    fetchCalled = true;
    throw new Error('dry-run provider must not call fetch');
  }) as typeof fetch;

  try {
    const result = await realAiDiagnosisDryRunProvider.diagnose({
      questionText: '阅读材料后需要结合上下文判断。',
    });

    assert.equal(result.ok, true);
    assert.equal(result.provider, 'real-ai-dry-run');
    assert.equal(result.diagnosis?.mistakeKey, diagnosisPromptOutputFixture.mistakeKey);
    assert.deepEqual(result.diagnosis, diagnosisPromptOutputFixture);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
    restoreDiagnosisEnv(originalProvider, originalAllow, originalKey);
  }
});
