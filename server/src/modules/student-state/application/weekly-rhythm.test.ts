import test from 'node:test';
import assert from 'node:assert/strict';

import { buildWeeklyRhythm } from '../../../../../shared/weekly-rhythm.js';

const referenceDate = new Date('2026-05-08T10:00:00.000Z'); // Friday

test('buildWeeklyRhythm produces 7 days starting Monday', () => {
  const rhythm = buildWeeklyRhythm({ resolvedAtIsoList: [], referenceDate });
  assert.equal(rhythm.days.length, 7);
  assert.equal(rhythm.days[0].dayKey, 'mon');
  assert.equal(rhythm.days[6].dayKey, 'sun');
});

test('buildWeeklyRhythm flags today correctly', () => {
  const rhythm = buildWeeklyRhythm({ resolvedAtIsoList: [], referenceDate });
  const today = rhythm.days.find((d) => d.isToday);
  assert.ok(today);
  assert.equal(today!.dayKey, 'fri');
});

test('buildWeeklyRhythm buckets resolved cycles by date', () => {
  const rhythm = buildWeeklyRhythm({
    resolvedAtIsoList: [
      '2026-05-04T08:00:00.000Z', // Mon
      '2026-05-04T09:00:00.000Z', // Mon
      '2026-05-08T07:30:00.000Z', // Fri
    ],
    referenceDate,
  });
  assert.equal(rhythm.days.find((d) => d.dayKey === 'mon')!.completedCycles, 2);
  assert.equal(rhythm.days.find((d) => d.dayKey === 'fri')!.completedCycles, 1);
  assert.equal(rhythm.weekTotal, 3);
});

test('buildWeeklyRhythm computes streakDays from today backward', () => {
  const rhythm = buildWeeklyRhythm({
    resolvedAtIsoList: [
      '2026-05-06T01:00:00.000Z', // Wed
      '2026-05-07T01:00:00.000Z', // Thu
      '2026-05-08T01:00:00.000Z', // Fri (today)
    ],
    referenceDate,
  });
  assert.equal(rhythm.streakDays, 3);
});

test('buildWeeklyRhythm streakDays is 0 when today has no cycle', () => {
  const rhythm = buildWeeklyRhythm({
    resolvedAtIsoList: ['2026-05-07T01:00:00.000Z'],
    referenceDate,
  });
  assert.equal(rhythm.streakDays, 0);
});

test('buildWeeklyRhythm marks future days', () => {
  const rhythm = buildWeeklyRhythm({ resolvedAtIsoList: [], referenceDate });
  const sat = rhythm.days.find((d) => d.dayKey === 'sat')!;
  const sun = rhythm.days.find((d) => d.dayKey === 'sun')!;
  assert.equal(sat.isFuture, true);
  assert.equal(sun.isFuture, true);
});

test('buildWeeklyRhythm respects weekTarget override', () => {
  const rhythm = buildWeeklyRhythm({ resolvedAtIsoList: [], referenceDate, weekTarget: 5 });
  assert.equal(rhythm.weekTarget, 5);
});
