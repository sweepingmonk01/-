import test from 'node:test';
import assert from 'node:assert/strict';

import { ShadowStrategyScheduler } from './shadow-strategy-scheduler.js';
import {
  BALANCED_SCORED_SCHEDULER_CONFIG,
  DEFAULT_SCORED_SCHEDULER_CONFIG,
  ScoredStrategyScheduler,
} from './scored-strategy-scheduler.js';
import type {
  StrategyDecision,
  StrategySchedulerInput,
} from '../domain/types.js';
import type { StrategyScheduler } from '../domain/ports.js';

const buildInput = (overrides: Partial<StrategySchedulerInput['cognitiveState']['kernel']> = {}): StrategySchedulerInput => ({
  context: {
    studentId: 'student-a',
    grade: '九年级',
    targetScore: 110,
    painPoint: '函数图像',
    rule: '通过两点解析式',
    questionText: '...题干...',
    learningSignals: {
      responseTimeMs: 30000,
      attempts: 1,
      scrollBurstCount: 0,
      timeSavedMinutes: 0,
      wrongStreak: 1,
      correctStreak: 0,
    },
  },
  cognitiveState: {
    schemaVersion: 'ai-active-v2',
    kernel: { time: 60, signalNoiseRatio: 60, emotion: 60, ...overrides },
    execution: { confidence: 50, fatigue: 20 },
  },
  stateVector: null,
});

class StubScheduler implements StrategyScheduler {
  constructor(private readonly decision: StrategyDecision) {}
  decide(): StrategyDecision { return this.decision; }
}

test('ShadowStrategyScheduler returns primary decision and appends shadow alternatives', () => {
  const primary = new StubScheduler({
    candidates: [],
    selectedStrategy: 'probe',
    policyId: 'primary-stub',
  });
  const shadow = new StubScheduler({
    candidates: [],
    selectedStrategy: 'teach',
    policyId: 'shadow-stub',
  });
  const scheduler = new ShadowStrategyScheduler(
    { policyId: 'primary-stub', scheduler: primary },
    [{ policyId: 'shadow-stub', scheduler: shadow }],
  );

  const decision = scheduler.decide(buildInput());

  assert.equal(decision.selectedStrategy, 'probe');
  assert.equal(decision.policyId, 'primary-stub');
  assert.ok(decision.alternatives);
  assert.equal(decision.alternatives?.length, 1);
  assert.equal(decision.alternatives?.[0]?.policyId, 'shadow-stub');
  assert.equal(decision.alternatives?.[0]?.selectedStrategy, 'teach');
});

test('ShadowStrategyScheduler omits alternatives when shadows list is empty', () => {
  const primary = new StubScheduler({
    candidates: [],
    selectedStrategy: 'probe',
    policyId: 'primary-stub',
  });
  const scheduler = new ShadowStrategyScheduler(
    { policyId: 'primary-stub', scheduler: primary },
    [],
  );

  const decision = scheduler.decide(buildInput());

  assert.equal(decision.alternatives, undefined);
});

test('ShadowStrategyScheduler falls back to wrapper policyId if primary decision lacks one', () => {
  const primary = new StubScheduler({
    candidates: [],
    selectedStrategy: 'probe',
  });
  const scheduler = new ShadowStrategyScheduler(
    { policyId: 'wrapper-policy', scheduler: primary },
    [],
  );

  const decision = scheduler.decide(buildInput());
  assert.equal(decision.policyId, 'wrapper-policy');
});

test('ShadowStrategyScheduler preserves primary alternatives and appends shadows after them', () => {
  const primary = new StubScheduler({
    candidates: [],
    selectedStrategy: 'probe',
    policyId: 'primary',
    alternatives: [
      { policyId: 'inner', selectedStrategy: 'review', candidates: [] },
    ],
  });
  const shadow = new StubScheduler({
    candidates: [],
    selectedStrategy: 'teach',
    policyId: 'shadow',
  });
  const scheduler = new ShadowStrategyScheduler(
    { policyId: 'primary', scheduler: primary },
    [{ policyId: 'shadow', scheduler: shadow }],
  );

  const decision = scheduler.decide(buildInput());
  assert.equal(decision.alternatives?.length, 2);
  assert.equal(decision.alternatives?.[0]?.policyId, 'inner');
  assert.equal(decision.alternatives?.[1]?.policyId, 'shadow');
});

test('ScoredStrategyScheduler exposes its policyId on the decision', () => {
  const scheduler = new ScoredStrategyScheduler(DEFAULT_SCORED_SCHEDULER_CONFIG);
  const decision = scheduler.decide(buildInput());
  assert.equal(decision.policyId, 'scored-default-v0');
});

test('Balanced variant unlocks teach earlier than the default scheduler', () => {
  // 选一个 default 不解锁 teach、balanced 解锁 teach 的输入：
  // recentFailurePressure 通过 stateVector.recentFailureCount * 6 计算。
  // 选 1 次最近失败 -> recentFailurePressure = 6
  //   default.teachUnlock.recentFailurePressure = 12 (不解锁)
  //   balanced.teachUnlock.recentFailurePressure = 8 (依然不解锁，需要更高输入)
  // 改用 timePressureSolo：
  //   default = 18, balanced = 14
  //   设 kernel.time = 78 -> timePressure = round((100-78)/100 * 24) = 5 (不够)
  //   设 kernel.time = 38 -> timePressure = round((100-38)/100 * 24) = 15
  //     default 不解锁 (15 < 18)，balanced 解锁 (15 >= 14)
  const input = buildInput({ time: 38 });

  const defaultScheduler = new ScoredStrategyScheduler(DEFAULT_SCORED_SCHEDULER_CONFIG);
  const balancedScheduler = new ScoredStrategyScheduler(BALANCED_SCORED_SCHEDULER_CONFIG);

  const defaultDecision = defaultScheduler.decide(input);
  const balancedDecision = balancedScheduler.decide(input);

  const defaultTeach = defaultDecision.candidates.find((c) => c.strategy === 'teach');
  const balancedTeach = balancedDecision.candidates.find((c) => c.strategy === 'teach');

  assert.ok(defaultTeach && balancedTeach);
  // balanced 应当对 teach 给出比 default 更高的分数（teachUnlocked 解锁 vs locked penalty）
  assert.ok(balancedTeach.score > defaultTeach.score);
});
