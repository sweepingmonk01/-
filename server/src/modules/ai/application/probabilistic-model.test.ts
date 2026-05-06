import test from 'node:test';
import assert from 'node:assert/strict';
import {
  updateBetaBelief,
  updatePosteriorProbability,
} from './probabilistic-model.js';

test('updateBetaBelief moves means with evidence while increasing confidence', () => {
  const prior = { mean: 0.5, confidence: 0.3 };
  const positive = updateBetaBelief(prior, { positive: 2, negative: 0.25 });
  const negative = updateBetaBelief(prior, { positive: 0.25, negative: 2 });

  assert.ok(positive.mean > prior.mean);
  assert.ok(negative.mean < prior.mean);
  assert.ok(positive.confidence > prior.confidence);
  assert.ok(negative.confidence > prior.confidence);
});

test('updatePosteriorProbability applies likelihood ratios as posterior odds', () => {
  const prior = 0.45;

  assert.ok(updatePosteriorProbability(prior, 2.5) > prior);
  assert.ok(updatePosteriorProbability(prior, 0.4) < prior);
});
