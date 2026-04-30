import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAIErrorDiagnosisRequestFixture, buildAIErrorDiagnosisResultFixture } from './aiDiagnosisFixtures';
import { createAIErrorDiagnosisClient } from './aiDiagnosisClientFactory';
import { httpAiDiagnosisClient } from './httpAiDiagnosisClient';
import { AI_ERROR_DIAGNOSIS_SCHEMA_VERSION } from './aiDiagnosisTypes';
import type { AIErrorDiagnosisRequest } from './aiDiagnosisTypes';

function withFetch(
  handler: typeof fetch,
  run: () => Promise<void>,
) {
  return async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = handler;

    try {
      await run();
    } finally {
      globalThis.fetch = originalFetch;
    }
  };
}

test('createAIErrorDiagnosisClient returns mock and http clients', () => {
  assert.notEqual(createAIErrorDiagnosisClient('mock'), httpAiDiagnosisClient);
  assert.equal(createAIErrorDiagnosisClient('http'), httpAiDiagnosisClient);
});

test('httpAiDiagnosisClient does not call fetch when local validation fails', withFetch(
  async () => {
    throw new Error('fetch should not be called for invalid local requests');
  },
  async () => {
    const invalidRequest: AIErrorDiagnosisRequest = {
      schemaVersion: AI_ERROR_DIAGNOSIS_SCHEMA_VERSION,
      errorInput: {
        questionText: '',
        ocrText: '',
        studentAnswer: '',
        explanationText: '',
        subject: 'zh',
      },
      clientMeta: {
        appVersion: 'test',
        source: 'test',
      },
    };

    const response = await httpAiDiagnosisClient.diagnose(invalidRequest);

    assert.equal(response.ok, false);
    assert.equal(response.errors?.[0]?.code, 'MISSING_ERROR_CONTENT');
  },
));

test('httpAiDiagnosisClient maps HTTP 400 responses to ok:false', withFetch(
  async () => new Response(JSON.stringify({
    ok: false,
    diagnosis: null,
    diagnosedAt: '2026-01-01T00:00:00.000Z',
    errors: [
      {
        code: 'MISSING_DIAGNOSIS_INPUT',
        message: 'At least one of questionText, painPoint, or rule is required.',
        path: 'body',
      },
    ],
  }), {
    status: 400,
    headers: {
      'Content-Type': 'application/json',
    },
  }),
  async () => {
    const response = await httpAiDiagnosisClient.diagnose(
      buildAIErrorDiagnosisRequestFixture(),
    );

    assert.equal(response.ok, false);
    assert.equal(response.errors?.[0]?.code, 'MISSING_DIAGNOSIS_INPUT');
    assert.equal(response.diagnosedAt, '2026-01-01T00:00:00.000Z');
  },
));

test('httpAiDiagnosisClient returns ok:false for invalid JSON', withFetch(
  async () => new Response('not json', {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  }),
  async () => {
    const response = await httpAiDiagnosisClient.diagnose(
      buildAIErrorDiagnosisRequestFixture(),
    );

    assert.equal(response.ok, false);
    assert.equal(response.errors?.[0]?.code, 'INVALID_DIAGNOSIS_RESPONSE');
  },
));

test('httpAiDiagnosisClient normalizes successful server diagnosis to result', withFetch(
  async (_input, init) => {
    assert.equal(init?.method, 'POST');
    assert.equal(
      (init?.headers as Record<string, string>)['Content-Type'],
      'application/json',
    );

    const body = JSON.parse(init?.body as string) as AIErrorDiagnosisRequest;
    assert.equal(body.errorInput.questionText?.includes('阅读'), true);

    return new Response(JSON.stringify({
      ok: true,
      diagnosis: buildAIErrorDiagnosisResultFixture({
        mistakeKey: 'context_misread',
        primaryNodeKey: 'language.context',
      }),
      diagnosedAt: '2026-01-01T00:00:00.000Z',
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  },
  async () => {
    const response = await httpAiDiagnosisClient.diagnose(
      buildAIErrorDiagnosisRequestFixture(),
    );

    assert.equal(response.ok, true);
    assert.equal(response.result?.mistakeKey, 'context_misread');
    assert.equal(response.result?.recommendedExploreNodes.primaryNodeKey, 'language.context');
    assert.equal(response.diagnosedAt, '2026-01-01T00:00:00.000Z');
  },
));
