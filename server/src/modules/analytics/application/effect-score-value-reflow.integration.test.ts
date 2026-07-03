import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { SQLiteLearningCycleRepository } from '../infrastructure/sqlite-learning-cycle-repository.js';
import { LearningCycleService } from './learning-cycle-service.js';
import { computeStrategyValueReflow } from './strategy-value-reflow.js';
import { ScoredStrategyScheduler } from '../../mobius/infrastructure/scored-strategy-scheduler.js';
import type {
  CognitiveState,
  StrategyKind,
  StrategySchedulerInput,
} from '../../mobius/domain/types.js';
import type { LearningCycleRecord } from '../domain/types.js';

// T2 集成证据:一次 cycle 的 effect_score 能读出 value-evidence 来源分解,
// 且策略权重能因累计的 value-evidence 而变化。

const tempDbFile = () => path.join(mkdtempSync(path.join(tmpdir(), 'liezi-t2-')), 'test.db');

const state = (kernel: Partial<CognitiveState['kernel']>): CognitiveState => ({
  schemaVersion: 'ai-active-v2',
  kernel: { time: 60, signalNoiseRatio: 60, emotion: 60, ...kernel },
  execution: { confidence: 50, fatigue: 20 },
});

const seedCycle = (
  overrides: Partial<LearningCycleRecord> & { selectedStrategy: StrategyKind },
): Omit<LearningCycleRecord, 'id' | 'createdAt' | 'updatedAt'> => {
  const { selectedStrategy, ...rest } = overrides;
  return {
    studentId: 'student-reflow',
    source: 'mobius-session',
    status: 'validated',
    painPoint: '函数图像',
    rule: '通过两点解析式',
    outcome: 'success',
    selectedAction: { selectedStrategy },
    ...rest,
  };
};

const buildSchedulerInput = (
  strategyValuePriors?: Partial<Record<StrategyKind, number>>,
): StrategySchedulerInput => ({
  context: {
    studentId: 'student-reflow',
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
  cognitiveState: state({}),
  stateVector: null,
  strategyValuePriors,
});

test('T2: a real cycle exposes effect_score value-evidence source decomposition', async () => {
  const repository = new SQLiteLearningCycleRepository({ dbFile: tempDbFile() });
  const service = new LearningCycleService(repository);

  const cycle = await service.recordFoundationExploration({
    studentId: 'student-readout',
    nodeKey: 'physics:newton-2',
    nodeLabel: '牛顿第二定律',
    domain: 'physics',
    coreQuestion: '力与加速度的关系如何映射回这道错题？',
    taskId: 'task-1',
    taskLabel: '连接机制与错因',
    actionType: 'select',
    outcome: 'success',
    stateBefore: state({ time: 50, signalNoiseRatio: 50, emotion: 50 }),
    stateAfter: state({ time: 72, signalNoiseRatio: 72, emotion: 72 }),
  });

  // 结构化字段:价值分量已随 cycle 持久化。
  assert.equal(typeof cycle.effectScoreValueComponent, 'number');
  assert.ok((cycle.effectScoreValueComponent ?? 0) > 0);

  // 从闭环回读里读出 effect_score 的来源分解(挂在 cycleId 上)。
  const report = await service.getCycleReport('student-readout', cycle.id);
  assert.ok(report);
  const events = report!.flow.events;
  const effectEvent = events.find((event) => event.eventType === 'effect.evaluated');
  assert.ok(effectEvent, 'expected an effect.evaluated event on the cycle');

  const breakdown = (effectEvent!.eventPayload as { effectScoreBreakdown?: Record<string, unknown> })
    .effectScoreBreakdown as {
      valueComponent: number;
      executionComponent: number;
      evidenceSources: Array<{ kind: string; signal: string; contribution: number }>;
    };

  const valueSources = breakdown.evidenceSources.filter((source) => source.kind === 'value');
  const executionSources = breakdown.evidenceSources.filter((source) => source.kind === 'execution');
  // 价值来源三条:outcome / kernelDelta / baselineSurprise;此路径无执行代理证据。
  assert.deepEqual(
    valueSources.map((source) => source.signal).sort(),
    ['baselineSurprise', 'kernelDelta', 'outcome'],
  );
  assert.equal(executionSources.length, 0);
  assert.equal(breakdown.executionComponent, 0);
  assert.ok(breakdown.valueComponent > 0);
});

test('T2: strategy value reflow biases follow value-evidence sign', async () => {
  const repository = new SQLiteLearningCycleRepository({ dbFile: tempDbFile() });

  // teach 历史带来正向真实增益,probe 历史带来退化。
  await repository.create(seedCycle({ selectedStrategy: 'teach', effectScoreValueComponent: 0.7 }));
  await repository.create(seedCycle({ selectedStrategy: 'teach', effectScoreValueComponent: 0.5 }));
  await repository.create(seedCycle({
    selectedStrategy: 'probe',
    outcome: 'failure',
    effectScoreValueComponent: -0.6,
  }));

  const service = new LearningCycleService(repository);
  const reflow = await service.getStrategyValueReflow('student-reflow');

  assert.ok((reflow.biases.teach ?? 0) > 0, 'teach with positive value evidence should bias up');
  assert.ok((reflow.biases.probe ?? 0) < 0, 'probe with negative value evidence should bias down');
  assert.equal(reflow.consideredCycles, 3);
});

test('T2: reflow does NOT reward execution-only history (anti-Goodhart)', async () => {
  // 一条"零价值分量"的 cycle(执行完成但真实增益为 0):不应把策略偏置推正。
  const cyclesExecutionOnly: LearningCycleRecord[] = [
    {
      id: 'c1',
      studentId: 'student-reflow',
      source: 'mobius-session',
      status: 'validated',
      painPoint: '函数图像',
      rule: 'rule',
      outcome: 'success',
      effectScore: 0.0,
      effectScoreValueComponent: 0.0,
      selectedAction: { selectedStrategy: 'teach' },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];
  const reflow = computeStrategyValueReflow(cyclesExecutionOnly);
  assert.equal(reflow.biases.teach, 0);
});

test('T2: value reflow changes strategy score and can flip the selected strategy', () => {
  const scheduler = new ScoredStrategyScheduler();

  const baseline = scheduler.decide(buildSchedulerInput());
  const baselineSorted = [...baseline.candidates].sort((a, b) => b.score - a.score);
  const top = baselineSorted[0];
  const runnerUp = baselineSorted[1];
  assert.ok(top && runnerUp && top.strategy !== runnerUp.strategy);

  // 抬高第二名、压低第一名 —— 纯粹由价值证据回流驱动。
  const priors: Partial<Record<StrategyKind, number>> = {
    [runnerUp.strategy]: 8,
    [top.strategy]: -8,
  };
  const reflowed = scheduler.decide(buildSchedulerInput(priors));

  const reflowedRunnerUp = reflowed.candidates.find((c) => c.strategy === runnerUp.strategy)!;
  const reflowedTop = reflowed.candidates.find((c) => c.strategy === top.strategy)!;

  // 权重确实因价值证据变化:正偏置抬分、负偏置压分。
  assert.ok(reflowedRunnerUp.score > runnerUp.score, 'positive value prior must raise the score');
  assert.ok(reflowedTop.score < top.score, 'negative value prior must lower the score');

  // 选择随之翻转:飞轮价值信号真正回流进了在线决策。
  assert.equal(reflowed.selectedStrategy, runnerUp.strategy);
});
