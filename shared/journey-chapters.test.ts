import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeJourneyMap,
  findCurrentChapter,
  JOURNEY_CHAPTER_COUNT,
  JOURNEY_CHAPTER_NAMES,
} from './journey-chapters.js';

test('computeJourneyMap always returns 8 chapters', () => {
  const chapters = computeJourneyMap({ estimatedScore: 60, targetScore: 120 });
  assert.equal(chapters.length, JOURNEY_CHAPTER_COUNT);
  assert.equal(chapters.length, 8);
});

test('computeJourneyMap chapter names match constants', () => {
  const chapters = computeJourneyMap({ estimatedScore: 0, targetScore: 100 });
  chapters.forEach((ch, i) => {
    assert.equal(ch.name, JOURNEY_CHAPTER_NAMES[i]);
    assert.equal(ch.index, i);
  });
});

test('computeJourneyMap at 0% — first chapter is current, rest are future', () => {
  const chapters = computeJourneyMap({ estimatedScore: 0, targetScore: 100 });
  assert.equal(chapters[0].status, 'current');
  assert.equal(chapters[0].progressInChapter, 0);
  for (let i = 1; i < chapters.length; i++) {
    assert.equal(chapters[i].status, 'future');
    assert.equal(chapters[i].progressInChapter, 0);
  }
});

test('computeJourneyMap at 50% — first 4 chapters past, 5th current', () => {
  const chapters = computeJourneyMap({ estimatedScore: 50, targetScore: 100 });
  // 50% of 8 chapters = chapter index 4 (0-indexed)
  for (let i = 0; i < 4; i++) {
    assert.equal(chapters[i].status, 'past', `chapter ${i} should be past`);
    assert.equal(chapters[i].progressInChapter, 100);
  }
  assert.equal(chapters[4].status, 'current');
  for (let i = 5; i < 8; i++) {
    assert.equal(chapters[i].status, 'future', `chapter ${i} should be future`);
  }
});

test('computeJourneyMap at 100% — last chapter is current with 100% sub-progress', () => {
  const chapters = computeJourneyMap({ estimatedScore: 100, targetScore: 100 });
  const last = chapters[chapters.length - 1];
  assert.equal(last.status, 'current');
  assert.equal(last.progressInChapter, 100);
  // All preceding chapters should be past
  for (let i = 0; i < chapters.length - 1; i++) {
    assert.equal(chapters[i].status, 'past');
  }
});

test('computeJourneyMap handles over-target gracefully', () => {
  const chapters = computeJourneyMap({ estimatedScore: 130, targetScore: 100 });
  const last = chapters[chapters.length - 1];
  assert.equal(last.status, 'current');
  assert.equal(last.progressInChapter, 100);
});

test('computeJourneyMap handles zero target without crashing', () => {
  const chapters = computeJourneyMap({ estimatedScore: 50, targetScore: 0 });
  assert.equal(chapters.length, 8);
  // Falls back to safeTarget=100 → 50% progress
  assert.equal(chapters[4].status, 'current');
});

test('computeJourneyMap sub-progress within a chapter', () => {
  // 1/8 = 12.5% exactly → chapter index 1 with 0% sub-progress
  const at125 = computeJourneyMap({ estimatedScore: 12.5, targetScore: 100 });
  assert.equal(at125[1].status, 'current');
  assert.equal(at125[1].progressInChapter, 0);

  // 18.75% → chapter 1 at 50% sub-progress  (18.75/100*8 = 1.5)
  const at1875 = computeJourneyMap({ estimatedScore: 18.75, targetScore: 100 });
  assert.equal(at1875[1].status, 'current');
  assert.equal(at1875[1].progressInChapter, 50);
});

test('findCurrentChapter returns the current chapter', () => {
  const chapters = computeJourneyMap({ estimatedScore: 60, targetScore: 120 });
  const current = findCurrentChapter(chapters);
  assert.ok(current);
  assert.equal(current.status, 'current');
});

test('findCurrentChapter returns undefined for empty list', () => {
  assert.equal(findCurrentChapter([]), undefined);
});
