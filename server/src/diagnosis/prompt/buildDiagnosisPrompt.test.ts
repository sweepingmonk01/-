import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDiagnosisPrompt } from './buildDiagnosisPrompt.js';
import { diagnosisPromptInputFixture } from './diagnosisPromptFixtures.js';

test('buildDiagnosisPrompt returns prompt bundle with JSON-only and mistake key constraints', () => {
  const bundle = buildDiagnosisPrompt(diagnosisPromptInputFixture);

  assert.ok(bundle.systemPrompt.length > 0);
  assert.ok(bundle.developerPrompt.length > 0);
  assert.ok(bundle.userPrompt.length > 0);
  assert.match(bundle.systemPrompt, /Return JSON only/);
  assert.equal(bundle.costGuard.requireJsonOnly, true);
  assert.equal(bundle.costGuard.maxOutputTokens, 900);
  assert.ok(bundle.outputSchema.required.includes('mistakeKey'));
  assert.match(bundle.developerPrompt, /context_misread/);
  assert.match(bundle.developerPrompt, /feedback_loop_broken/);
});

test('buildDiagnosisPrompt redacts email-like strings and 11-digit phone numbers', () => {
  const bundle = buildDiagnosisPrompt({
    request: {
      ...diagnosisPromptInputFixture.request,
      questionText: '联系 learner@example.com 或 13800138000 后再判断上下文。',
      painPoint: 'student.email@test.org 出现在原始文本里。',
    },
  });

  assert.match(bundle.userPrompt, /\[REDACTED_EMAIL\]/);
  assert.match(bundle.userPrompt, /\[REDACTED_PHONE\]/);
  assert.doesNotMatch(bundle.userPrompt, /learner@example\.com/);
  assert.doesNotMatch(bundle.userPrompt, /student\.email@test\.org/);
  assert.doesNotMatch(bundle.userPrompt, /13800138000/);
});

test('buildDiagnosisPrompt keeps user prompt within maxInputChars', () => {
  const bundle = buildDiagnosisPrompt({
    request: {
      ...diagnosisPromptInputFixture.request,
      questionText: '阅读'.repeat(5000),
      studentAnswer: '答案'.repeat(5000),
      correctAnswer: '正确'.repeat(5000),
      painPoint: '语境'.repeat(5000),
      rule: '规则'.repeat(5000),
    },
    context: {
      availableExploreNodes: Array.from({ length: 200 }, (_, index) => ({
        nodeKey: `node.${index}`,
        engineKey: 'language',
        label: `节点 ${index}`,
        summary: '用于测试很长的 prompt 上下文。',
      })),
    },
  });

  assert.ok(bundle.userPrompt.length <= bundle.costGuard.maxInputChars);
});
