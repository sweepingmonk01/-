import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRealAiProviderSafety } from './realAiProviderSafetyGate.js';

function createSafeInput() {
  return {
    providerMode: 'real-ai-stub',
    allowRealAi: true,
    apiKeyPresent: true,
    promptCostGuard: {
      maxInputChars: 6000,
      maxOutputTokens: 900,
      requireJsonOnly: true,
    },
    inputCharCount: 1200,
    hasPrivacyRedaction: true,
  };
}

test('validateRealAiProviderSafety rejects when real AI is not explicitly allowed', () => {
  const result = validateRealAiProviderSafety({
    ...createSafeInput(),
    allowRealAi: false,
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.code, 'REAL_AI_NOT_ALLOWED');
  assert.equal(result.errors[0]?.path, 'allowRealAi');
});

test('validateRealAiProviderSafety rejects missing API key presence', () => {
  const result = validateRealAiProviderSafety({
    ...createSafeInput(),
    apiKeyPresent: false,
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.code, 'REAL_AI_API_KEY_MISSING');
  assert.equal(result.errors[0]?.path, 'apiKey');
});

test('validateRealAiProviderSafety rejects prompts that do not require JSON-only output', () => {
  const result = validateRealAiProviderSafety({
    ...createSafeInput(),
    promptCostGuard: {
      ...createSafeInput().promptCostGuard,
      requireJsonOnly: false,
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.code, 'JSON_ONLY_REQUIRED');
  assert.equal(result.errors[0]?.path, 'promptCostGuard.requireJsonOnly');
});

test('validateRealAiProviderSafety rejects input over maxInputChars', () => {
  const result = validateRealAiProviderSafety({
    ...createSafeInput(),
    promptCostGuard: {
      ...createSafeInput().promptCostGuard,
      maxInputChars: 10,
    },
    inputCharCount: 11,
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.code, 'INPUT_TOO_LARGE');
  assert.equal(result.errors[0]?.path, 'inputCharCount');
});

test('validateRealAiProviderSafety rejects missing privacy redaction', () => {
  const result = validateRealAiProviderSafety({
    ...createSafeInput(),
    hasPrivacyRedaction: false,
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.code, 'PRIVACY_REDACTION_REQUIRED');
  assert.equal(result.errors[0]?.path, 'privacy');
});

test('validateRealAiProviderSafety warns when maxOutputTokens is high', () => {
  const result = validateRealAiProviderSafety({
    ...createSafeInput(),
    promptCostGuard: {
      ...createSafeInput().promptCostGuard,
      maxOutputTokens: 1201,
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.warnings[0]?.code, 'HIGH_OUTPUT_TOKEN_LIMIT');
  assert.equal(result.warnings[0]?.path, 'promptCostGuard.maxOutputTokens');
});

test('validateRealAiProviderSafety accepts fully gated real AI configuration', () => {
  const result = validateRealAiProviderSafety(createSafeInput());

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
});
