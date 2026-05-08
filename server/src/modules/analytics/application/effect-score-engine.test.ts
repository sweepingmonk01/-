import test from 'node:test';
import assert from 'node:assert/strict';

import { computeEffectScore, EFFECT_SCORE_WEIGHTS } from './effect-score-engine.js';
import type { CognitiveState } from '../../mobius/domain/types.js';
import type { LearningCycleRecord } from '../domain/types.js';

const baseState = (overrides: Partial<CognitiveState['kernel']> = {}): CognitiveState => ({
  schemaVersion: 'ai-active-v2',
  kernel: { time: 60, signalNoiseRatio: 60, emotion: 60, ...overrides },
  execution: { confidence: 50, fatigue: 20 },
});

const completedCycle = (outcome: 'success' | 'failure'): LearningCycleRecord => ({
  id: `cycle-${Math.random()}`,
  studentId: 'student-a',
  source: 'mobius-session',
  status: 'validated',
  painPoint: '函数图像',
  rule: 'rule',
  outcome,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

test('computeEffectScore: failure with no state and no baseline returns -W_OUTCOME', () => {
  const result = computeEffectScore({ outcome: 'failure' });
  assert.equal(result.total, -EFFECT_SCORE_WEIGHTS.outcome);
  assert.equal(result.kernelDelta, 0);
  assert.equal(result.baselineSuccessRate, null);
});

test('computeEffectScore: success with no state and no baseline returns +W_OUTCOME', () => {
  const result = computeEffectScore({ outcome: 'success' });
  assert.equal(result.total, EFFECT_SCORE_WEIGHTS.outcome);
});

test('computeEffectScore: success with kernel improvement adds positive kernel component', () => {
  const before = baseState({ time: 50, signalNoiseRatio: 50, emotion: 50 });
  const after = baseState({ time: 70, signalNoiseRatio: 70, emotion: 70 });
  const result = computeEffectScore({ outcome: 'success', stateBefore: before, stateAfter: after });
  assert.ok(result.kernelComponent > 0);
  assert.ok(result.total > EFFECT_SCORE_WEIGHTS.outcome);
  assert.ok(result.total <= 1);
});

test('computeEffectScore: failure with kernel deterioration goes more negative', () => {
  const before = baseState({ time: 70, signalNoiseRatio: 70, emotion: 70 });
  const after = baseState({ time: 50, signalNoiseRatio: 50, emotion: 50 });
  const result = computeEffectScore({ outcome: 'failure', stateBefore: before, stateAfter: after });
  assert.ok(result.kernelComponent < 0);
  assert.ok(result.total < -EFFECT_SCORE_WEIGHTS.outcome);
  assert.ok(result.total >= -1);
});

test('computeEffectScore: success against low baseline yields positive surprise', () => {
  const result = computeEffectScore({
    outcome: 'success',
    historicalCycles: [
      completedCycle('failure'),
      completedCycle('failure'),
      completedCycle('failure'),
    ],
  });
  assert.equal(result.baselineSuccessRate, 0);
  assert.equal(result.baselineComponent, EFFECT_SCORE_WEIGHTS.baseline);
  assert.equal(result.total, EFFECT_SCORE_WEIGHTS.outcome + EFFECT_SCORE_WEIGHTS.baseline);
});

test('computeEffectScore: failure against high baseline yields negative surprise', () => {
  const result = computeEffectScore({
    outcome: 'failure',
    historicalCycles: [
      completedCycle('success'),
      completedCycle('success'),
      completedCycle('success'),
    ],
  });
  assert.equal(result.baselineSuccessRate, 1);
  assert.equal(result.baselineComponent, -EFFECT_SCORE_WEIGHTS.baseline);
  assert.equal(result.total, -EFFECT_SCORE_WEIGHTS.outcome - EFFECT_SCORE_WEIGHTS.baseline);
});

test('computeEffectScore: total stays clamped within [-1, 1]', () => {
  const before = baseState({ time: 0, signalNoiseRatio: 0, emotion: 0 });
  const after = baseState({ time: 100, signalNoiseRatio: 100, emotion: 100 });
  const positive = computeEffectScore({
    outcome: 'success',
    stateBefore: before,
    stateAfter: after,
    historicalCycles: [completedCycle('failure'), completedCycle('failure')],
  });
  assert.equal(positive.total, 1);

  const negative = computeEffectScore({
    outcome: 'failure',
    stateBefore: after,
    stateAfter: before,
    historicalCycles: [completedCycle('success'), completedCycle('success')],
  });
  assert.equal(negative.total, -1);
});

test('computeEffectScore: ignores incomplete history and treats as no baseline', () => {
  const incompleteCycle: LearningCycleRecord = {
    ...completedCycle('success'),
    outcome: undefined,
    status: 'started',
  };
  const result = computeEffectScore({
    outcome: 'success',
    historicalCycles: [incompleteCycle, incompleteCycle],
  });
  assert.equal(result.baselineSuccessRate, null);
  assert.equal(result.baselineComponent, 0);
});
