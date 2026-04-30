import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnosisPromptOutputFixture } from './diagnosisPromptFixtures.js';
import { validateParsedDiagnosisModelOutput } from './diagnosisPromptValidators.js';

test('validateParsedDiagnosisModelOutput accepts the valid fixture', () => {
  const result = validateParsedDiagnosisModelOutput(diagnosisPromptOutputFixture);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('validateParsedDiagnosisModelOutput rejects invalid mistakeKey', () => {
  const result = validateParsedDiagnosisModelOutput({
    ...diagnosisPromptOutputFixture,
    mistakeKey: 'unsupported_key',
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.code, 'INVALID_MISTAKE_KEY');
});

test('validateParsedDiagnosisModelOutput rejects confidence outside 0-1', () => {
  const result = validateParsedDiagnosisModelOutput({
    ...diagnosisPromptOutputFixture,
    confidence: 1.4,
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.code, 'INVALID_CONFIDENCE');
});

test('validateParsedDiagnosisModelOutput rejects missing primary node', () => {
  const result = validateParsedDiagnosisModelOutput({
    ...diagnosisPromptOutputFixture,
    recommendedExploreNodes: {
      primaryNodeKey: '',
      secondaryNodeKeys: [],
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.code, 'MISSING_PRIMARY_NODE');
});
