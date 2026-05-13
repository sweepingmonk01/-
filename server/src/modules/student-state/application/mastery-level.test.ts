import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeMasteryLevel,
  masteryLevelLabel,
  MASTERY_LEVEL_COUNT,
  MASTERY_LEVEL_RANGE,
} from '../../../../../shared/mastery.js';

test('computeMasteryLevel maps 0-19 to Lv.1', () => {
  assert.equal(computeMasteryLevel(0).level, 1);
  assert.equal(computeMasteryLevel(19).level, 1);
});

test('computeMasteryLevel maps 20-39 to Lv.2', () => {
  assert.equal(computeMasteryLevel(20).level, 2);
  assert.equal(computeMasteryLevel(39).level, 2);
});

test('computeMasteryLevel caps at Lv.5 from 80 onward', () => {
  assert.equal(computeMasteryLevel(80).level, MASTERY_LEVEL_COUNT);
  assert.equal(computeMasteryLevel(100).level, MASTERY_LEVEL_COUNT);
});

test('computeMasteryLevel returns within-level percent', () => {
  assert.equal(computeMasteryLevel(50).percentInLevel, 50);
  assert.equal(computeMasteryLevel(45).percentInLevel, 25);
  assert.equal(computeMasteryLevel(60).percentInLevel, 0);
});

test('computeMasteryLevel toNextLevel zeroes out at Lv.5', () => {
  assert.equal(computeMasteryLevel(85).toNextLevel, 0);
});

test('computeMasteryLevel clamps invalid input to [0, 100]', () => {
  assert.equal(computeMasteryLevel(-50).level, 1);
  assert.equal(computeMasteryLevel(150).level, MASTERY_LEVEL_COUNT);
  assert.equal(computeMasteryLevel(-50).score, 0);
  assert.equal(computeMasteryLevel(150).score, 100);
});

test('masteryLevelLabel formats label as Lv.N', () => {
  assert.equal(masteryLevelLabel(3), 'Lv.3');
});

test('MASTERY_LEVEL_RANGE × COUNT covers 0..100', () => {
  assert.equal(MASTERY_LEVEL_RANGE * MASTERY_LEVEL_COUNT, 100);
});
