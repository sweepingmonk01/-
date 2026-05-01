import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAIErrorDiagnosisResultFixture } from './aiDiagnosisFixtures';
import { buildYufengTaskDraftFromDiagnosis } from './buildYufengTaskDraftFromDiagnosis';

const STORAGE_KEY = 'yufeng.dailyTaskState';

class MemoryLocalStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function installWindowMock() {
  const storage = new MemoryLocalStorage();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: storage,
    },
  });
  return storage;
}

test('buildYufengTaskDraftFromDiagnosis keeps the recommended primary node', () => {
  const diagnosis = buildAIErrorDiagnosisResultFixture({
    primaryNodeKey: 'language.context',
    secondaryNodeKeys: ['game.feedback_loop'],
  });

  const draft = buildYufengTaskDraftFromDiagnosis(diagnosis);

  assert.equal(draft.primaryNodeKey, 'language.context');
  assert.deepEqual(draft.secondaryNodeKeys, ['game.feedback_loop']);
});

test('buildYufengTaskDraftFromDiagnosis gives high confidence a lower estimate', () => {
  const highConfidenceDraft = buildYufengTaskDraftFromDiagnosis(
    buildAIErrorDiagnosisResultFixture({ confidence: 0.92 }),
  );
  const lowConfidenceDraft = buildYufengTaskDraftFromDiagnosis(
    buildAIErrorDiagnosisResultFixture({ confidence: 0.45 }),
  );

  assert.ok(highConfidenceDraft.estimatedMinutes < lowConfidenceDraft.estimatedMinutes);
});

test('buildYufengTaskDraftFromDiagnosis increases estimate for low confidence', () => {
  const mediumConfidenceDraft = buildYufengTaskDraftFromDiagnosis(
    buildAIErrorDiagnosisResultFixture({ confidence: 0.72 }),
  );
  const lowConfidenceDraft = buildYufengTaskDraftFromDiagnosis(
    buildAIErrorDiagnosisResultFixture({ confidence: 0.45 }),
  );

  assert.equal(mediumConfidenceDraft.estimatedMinutes, 12);
  assert.equal(lowConfidenceDraft.estimatedMinutes, 14);
});

test('buildYufengTaskDraftFromDiagnosis never estimates below 8 minutes', () => {
  const draft = buildYufengTaskDraftFromDiagnosis(
    buildAIErrorDiagnosisResultFixture({ confidence: 0.99 }),
  );

  assert.ok(draft.estimatedMinutes >= 8);
});

test('buildYufengTaskDraftFromDiagnosis never estimates above 18 minutes', () => {
  const draft = buildYufengTaskDraftFromDiagnosis(
    buildAIErrorDiagnosisResultFixture({ confidence: 0 }),
  );

  assert.ok(draft.estimatedMinutes <= 18);
});

test('buildYufengTaskDraftFromDiagnosis completion standard includes evidence and snapshot', () => {
  const draft = buildYufengTaskDraftFromDiagnosis(buildAIErrorDiagnosisResultFixture());

  assert.match(draft.completionStandard, /探索证据/);
  assert.match(draft.completionStandard, /御风快照/);
});

test('buildYufengTaskDraftFromDiagnosis does not write yufeng daily task state', () => {
  const storage = installWindowMock();

  buildYufengTaskDraftFromDiagnosis(buildAIErrorDiagnosisResultFixture());

  assert.equal(storage.getItem(STORAGE_KEY), null);
});
