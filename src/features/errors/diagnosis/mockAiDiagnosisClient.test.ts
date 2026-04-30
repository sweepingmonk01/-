import assert from 'node:assert/strict';
import test from 'node:test';
import { AI_ERROR_DIAGNOSIS_SCHEMA_VERSION } from './aiDiagnosisTypes';
import type { AIErrorDiagnosisRequest } from './aiDiagnosisTypes';
import { buildAIErrorDiagnosisRequestFixture } from './aiDiagnosisFixtures';
import { mockAiDiagnosisClient } from './mockAiDiagnosisClient';
import { validateAIErrorDiagnosisResponse } from './aiDiagnosisValidators';

function requestWithText(text: string): AIErrorDiagnosisRequest {
  const fixture = buildAIErrorDiagnosisRequestFixture();

  return {
    ...fixture,
    errorInput: {
      questionText: text,
      subject: 'zh',
    },
    learningProfile: undefined,
  };
}

test('mockAiDiagnosisClient returns ok:false for invalid request', async () => {
  const response = await mockAiDiagnosisClient.diagnose({
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
  });

  assert.equal(response.ok, false);
  assert.equal(response.result, undefined);
  assert.equal(response.errors?.[0]?.code, 'MISSING_ERROR_CONTENT');
});

test('mockAiDiagnosisClient maps context and reading text to context_misread', async () => {
  const response = await mockAiDiagnosisClient.diagnose(
    requestWithText('这道阅读题没有结合上下文和语境判断人物动机。'),
  );

  assert.equal(response.ok, true);
  assert.equal(response.result?.mistakeKey, 'context_misread');
  assert.equal(validateAIErrorDiagnosisResponse(response).ok, true);
});

test('mockAiDiagnosisClient maps rule and formula text to rule_mismatch', async () => {
  const response = await mockAiDiagnosisClient.diagnose(
    requestWithText('学生套错公式，没有先识别题目规则和运算关系。'),
  );

  assert.equal(response.ok, true);
  assert.equal(response.result?.mistakeKey, 'rule_mismatch');
  assert.equal(validateAIErrorDiagnosisResponse(response).ok, true);
});

test('mockAiDiagnosisClient prioritizes question text over optional context fields', async () => {
  const fixture = buildAIErrorDiagnosisRequestFixture();
  const response = await mockAiDiagnosisClient.diagnose({
    ...fixture,
    errorInput: {
      ...fixture.errorInput,
      questionText: '公式规则套错，计算时用了错误公式。',
      painPoint: '语境判断失败',
      rule: '先看上下文，再判断主旨',
    },
    learningProfile: undefined,
  });

  assert.equal(response.ok, true);
  assert.equal(response.result?.mistakeKey, 'rule_mismatch');
  assert.equal(validateAIErrorDiagnosisResponse(response).ok, true);
});

test('mockAiDiagnosisClient maps attention text to attention_distracted', async () => {
  const response = await mockAiDiagnosisClient.diagnose(
    requestWithText('这次是粗心看错条件，注意力被干扰项带偏。'),
  );

  assert.equal(response.ok, true);
  assert.equal(response.result?.mistakeKey, 'attention_distracted');
  assert.equal(validateAIErrorDiagnosisResponse(response).ok, true);
});

test('mockAiDiagnosisClient returns unknown when no keyword matches', async () => {
  const response = await mockAiDiagnosisClient.diagnose(
    requestWithText('这道题需要重新整理信息，再决定下一步。'),
  );

  assert.equal(response.ok, true);
  assert.equal(response.result?.mistakeKey, 'unknown');
  assert.equal(validateAIErrorDiagnosisResponse(response).ok, true);
});
