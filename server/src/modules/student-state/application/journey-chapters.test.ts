import test from 'node:test';
import assert from 'node:assert/strict';

import {
  JOURNEY_CHAPTER_COUNT,
  JOURNEY_CHAPTER_NAMES,
  computeJourneyMap,
  findCurrentChapter,
} from '../../../../../shared/journey-chapters.js';

test('computeJourneyMap returns 8 chapters with stable names', () => {
  const map = computeJourneyMap({ estimatedScore: 0, targetScore: 100 });
  assert.equal(map.length, JOURNEY_CHAPTER_COUNT);
  assert.deepEqual(map.map((c) => c.name), [...JOURNEY_CHAPTER_NAMES]);
});

test('computeJourneyMap places current at chapter 0 when score is 0', () => {
  const map = computeJourneyMap({ estimatedScore: 0, targetScore: 100 });
  assert.equal(map[0].status, 'current');
  assert.equal(map[0].progressInChapter, 0);
  for (let i = 1; i < JOURNEY_CHAPTER_COUNT; i += 1) {
    assert.equal(map[i].status, 'future');
  }
});

test('computeJourneyMap marks past/current/future in middle of journey', () => {
  // 50 / 100 = 0.5 → position = 4 → 章节 4（index 4 = 登顶）为 current
  const map = computeJourneyMap({ estimatedScore: 50, targetScore: 100 });
  assert.equal(map[3].status, 'past');
  assert.equal(map[3].progressInChapter, 100);
  assert.equal(map[4].status, 'current');
  assert.equal(map[5].status, 'future');
});

test('computeJourneyMap computes intra-chapter progress', () => {
  // 56 / 100 = 0.56 → position = 4.48 → 章节 4 内进度 48%
  const map = computeJourneyMap({ estimatedScore: 56, targetScore: 100 });
  assert.equal(map[4].status, 'current');
  assert.equal(map[4].progressInChapter, 48);
});

test('computeJourneyMap pins current to last chapter at 100% progress when score >= target', () => {
  const map = computeJourneyMap({ estimatedScore: 100, targetScore: 100 });
  const last = map[JOURNEY_CHAPTER_COUNT - 1];
  assert.equal(last.status, 'current');
  assert.equal(last.progressInChapter, 100);
  // 超过 target 也不抛错
  const overshoot = computeJourneyMap({ estimatedScore: 130, targetScore: 100 });
  const overshootLast = overshoot[JOURNEY_CHAPTER_COUNT - 1];
  assert.equal(overshootLast.status, 'current');
  assert.equal(overshootLast.progressInChapter, 100);
});

test('computeJourneyMap defends against zero / negative target', () => {
  const map = computeJourneyMap({ estimatedScore: 30, targetScore: 0 });
  // 不应抛错，应落在中间某章
  assert.ok(map.some((c) => c.status === 'current'));
});

test('findCurrentChapter returns the unique current chapter', () => {
  // 60 / 100 = 0.6 → position = 4.8 → 章节 4（登顶）为 current。
  const map = computeJourneyMap({ estimatedScore: 60, targetScore: 100 });
  const current = findCurrentChapter(map);
  assert.ok(current);
  assert.equal(current!.name, '登顶');
});
