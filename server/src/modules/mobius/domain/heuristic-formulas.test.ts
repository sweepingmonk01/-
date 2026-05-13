import test from 'node:test';
import assert from 'node:assert/strict';

import { HEURISTIC_FORMULA_REGISTRY, listHeuristicFormulas } from './heuristic-formulas.js';

test('heuristic formula registry has at least one entry per major heuristic surface', () => {
  const ids = Object.keys(HEURISTIC_FORMULA_REGISTRY);
  // 这些是当前已知的主要 v0 启发式表面。新增 v0 公式时应同步登记。
  for (const expected of [
    'state-update.interaction-delta',
    'state-update.foundation-delta',
    'state-update.mastery-evidence',
    'state-update.error-belief',
    'cognitive-engine.heuristic-projection',
    'story-planner.heuristic-branching',
    'strategy.scored-default-v0',
    'strategy.policy-features',
    'effect-score.v0-blend',
  ]) {
    assert.ok(ids.includes(expected), `missing registry entry: ${expected}`);
  }
});

test('every heuristic formula tag declares describes and replacementTrigger', () => {
  for (const tag of listHeuristicFormulas()) {
    assert.ok(tag.id, 'id required');
    assert.ok(tag.location, `location required for ${tag.id}`);
    assert.ok(tag.describes && tag.describes.length > 0, `describes required for ${tag.id}`);
    assert.ok(
      tag.replacementTrigger && tag.replacementTrigger.length > 0,
      `replacementTrigger required for ${tag.id}`,
    );
  }
});

test('registry id matches the map key (no rename drift)', () => {
  for (const [key, value] of Object.entries(HEURISTIC_FORMULA_REGISTRY)) {
    assert.equal(value.id, key, `registry key/id drift at ${key}`);
  }
});
