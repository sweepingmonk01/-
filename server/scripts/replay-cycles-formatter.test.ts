import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildReplayReport,
  buildReplayRow,
  renderReplayTable,
} from './replay-cycles-formatter.js';
import type {
  LearningCycleEvent,
  LearningCycleRecord,
} from '../src/modules/analytics/domain/types.js';

const baseCycle = (overrides: Partial<LearningCycleRecord> = {}): LearningCycleRecord => ({
  id: 'cycle-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  studentId: 'student-a',
  source: 'mobius-session',
  status: 'validated',
  painPoint: '函数图像',
  rule: '通过两点解析式',
  outcome: 'failure',
  effectScore: -0.528,
  createdAt: '2026-05-08T00:00:00.000Z',
  updatedAt: '2026-05-08T00:01:00.000Z',
  ...overrides,
});

const breakdownEvent = (cycleId: string): LearningCycleEvent => ({
  id: 'evt-1',
  cycleId,
  eventType: 'effect.evaluated',
  eventPayload: {
    outcome: 'failure',
    effectScore: -0.528,
    effectScoreBreakdown: {
      total: -0.528,
      outcomeComponent: -0.5,
      kernelComponent: -0.028,
      baselineComponent: 0,
      baselineSuccessRate: null,
      kernelDelta: -0.093,
    },
  },
  createdAt: '2026-05-08T00:01:01.000Z',
});

test('buildReplayRow extracts breakdown from effect.evaluated event', () => {
  const cycle = baseCycle();
  const row = buildReplayRow(cycle, [breakdownEvent(cycle.id)]);
  assert.equal(row.cycleIdShort, cycle.id.slice(0, 8));
  assert.equal(row.outcome, 'failure');
  assert.equal(row.effectScore, -0.528);
  assert.equal(row.breakdown?.kernelComponent, -0.028);
  assert.equal(row.shadowAgreement, 'no-shadow');
});

test('buildReplayRow marks agreement when all shadows match primary strategy', () => {
  const cycle = baseCycle({
    selectedAction: {
      selectedStrategy: 'probe',
      strategyAlternatives: [
        { policyId: 'shadow-a', selectedStrategy: 'probe', candidates: [] },
      ],
    },
  });
  const row = buildReplayRow(cycle, []);
  assert.equal(row.shadowAgreement, 'agree');
});

test('buildReplayRow marks disagreement when any shadow disagrees', () => {
  const cycle = baseCycle({
    selectedAction: {
      selectedStrategy: 'probe',
      strategyAlternatives: [
        { policyId: 'shadow-a', selectedStrategy: 'teach', candidates: [] },
      ],
    },
  });
  const row = buildReplayRow(cycle, []);
  assert.equal(row.shadowAgreement, 'disagree');
});

test('buildReplayReport aggregates success rate and component averages', () => {
  const cycle1 = baseCycle({ id: 'c1', outcome: 'success', effectScore: 0.62 });
  const cycle2 = baseCycle({ id: 'c2', outcome: 'failure', effectScore: -0.5 });
  const events = new Map<string, LearningCycleEvent[]>([
    ['c1', [{
      id: 'e1',
      cycleId: 'c1',
      eventType: 'effect.evaluated',
      eventPayload: { effectScoreBreakdown: { total: 0.62, outcomeComponent: 0.5, kernelComponent: 0.12, baselineComponent: 0, baselineSuccessRate: null, kernelDelta: 0.4 } },
      createdAt: '2026-05-08T00:00:00.000Z',
    }]],
    ['c2', [{
      id: 'e2',
      cycleId: 'c2',
      eventType: 'effect.evaluated',
      eventPayload: { effectScoreBreakdown: { total: -0.5, outcomeComponent: -0.5, kernelComponent: 0, baselineComponent: 0, baselineSuccessRate: null, kernelDelta: 0 } },
      createdAt: '2026-05-08T00:00:00.000Z',
    }]],
  ]);
  const report = buildReplayReport([cycle1, cycle2], events);

  assert.equal(report.aggregate.totalCycles, 2);
  assert.equal(report.aggregate.completedCycles, 2);
  assert.equal(report.aggregate.successRate, 0.5);
  assert.equal(report.aggregate.averageEffectScore, 0.06);
  assert.equal(report.aggregate.averageOutcomeComponent, 0);
  assert.equal(report.aggregate.averageKernelComponent, 0.06);
});

test('buildReplayReport returns shadow agreement rate only over shadowed rows', () => {
  const withShadow = baseCycle({
    id: 'cs1',
    selectedAction: {
      selectedStrategy: 'probe',
      strategyAlternatives: [
        { policyId: 'shadow-a', selectedStrategy: 'probe', candidates: [] },
      ],
    },
  });
  const noShadow = baseCycle({ id: 'cs2', selectedAction: { selectedStrategy: 'probe' } });
  const report = buildReplayReport([withShadow, noShadow], new Map());
  assert.equal(report.aggregate.shadowAgreementRate, 1);
});

test('renderReplayTable produces deterministic header and aggregate footer', () => {
  const cycle = baseCycle();
  const report = buildReplayReport([cycle], new Map([[cycle.id, [breakdownEvent(cycle.id)]]]));
  const output = renderReplayTable(report);
  assert.match(output, /createdAt {2}cycle/);
  assert.match(output, /aggregate:/);
  assert.match(output, /total cycles {18}: 1/);
});

test('renderReplayTable handles zero cycles gracefully', () => {
  const report = buildReplayReport([], new Map());
  const output = renderReplayTable(report);
  assert.match(output, /total cycles {18}: 0/);
  assert.match(output, /shadow agreement rate {9}: —/);
});
