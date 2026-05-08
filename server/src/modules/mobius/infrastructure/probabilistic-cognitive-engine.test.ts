import test from 'node:test';
import assert from 'node:assert/strict';
import { ProbabilisticCognitiveEngine } from './probabilistic-cognitive-engine.js';

test('ProbabilisticCognitiveEngine rewards fluent evidence and penalizes overload evidence', () => {
  const engine = new ProbabilisticCognitiveEngine();
  const base = {
    schemaVersion: 'ai-active-v2' as const,
    kernel: {
      time: 60,
      signalNoiseRatio: 60,
      emotion: 60,
    },
    execution: {
      confidence: 50,
      fatigue: 20,
    },
  };

  const fluent = engine.resolve({
    responseTimeMs: 25_000,
    correctStreak: 2,
    attempts: 1,
  }, base);
  const overloaded = engine.resolve({
    responseTimeMs: 140_000,
    wrongStreak: 2,
    attempts: 3,
    scrollBurstCount: 2,
  }, base);

  assert.ok(fluent.kernel.signalNoiseRatio > overloaded.kernel.signalNoiseRatio);
  assert.ok(fluent.execution.confidence > overloaded.execution.confidence);
  assert.ok(overloaded.execution.fatigue > fluent.execution.fatigue);
});
