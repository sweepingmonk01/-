import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { SQLiteLearningCycleRepository } from '../infrastructure/sqlite-learning-cycle-repository.js';
import { LearningCycleService } from './learning-cycle-service.js';
import { compareShadowConfigs } from './shadow-config-promotion-gate.js';
import {
  DEFAULT_SCORED_SCHEDULER_CONFIG,
  BALANCED_SCORED_SCHEDULER_CONFIG,
} from '../../mobius/infrastructure/scored-strategy-scheduler.js';
import type { StrategyKind } from '../../mobius/domain/types.js';
import type { LearningCycleRecord } from '../domain/types.js';

// T3 阶段二集成证据:
//  1) 一份 shadow 对比报告能读出 DEFAULT vs BALANCED 在真实 value-evidence 上的胜率。
//  2) 一次"建议晋升/维持"的显式决策记录(结构化持久化)。
//  3) 配置真实切换需人工确认标志位(autoFlipAllowed=false / requiresHumanConfirmation=true)。

const tempDbFile = () => path.join(mkdtempSync(path.join(tmpdir(), 'liezi-t3-')), 'test.db');

const DEFAULT_POLICY = DEFAULT_SCORED_SCHEDULER_CONFIG.policyId;
const BALANCED_POLICY = BALANCED_SCORED_SCHEDULER_CONFIG.policyId;

// 播下一条已判定的 mobius-session cycle:主配置执行 executedStrategy,影子(BALANCED)选 challengerStrategy。
const seed = (
  overrides: {
    executedStrategy: StrategyKind;
    challengerStrategy: StrategyKind;
    value: number;
    outcome?: 'success' | 'failure';
  },
): Omit<LearningCycleRecord, 'id' | 'createdAt' | 'updatedAt'> => ({
  studentId: 'student-shadow',
  source: 'mobius-session',
  status: 'validated',
  painPoint: '函数图像',
  rule: '通过两点解析式',
  outcome: overrides.outcome ?? (overrides.value >= 0 ? 'success' : 'failure'),
  effectScore: overrides.value,
  effectScoreValueComponent: overrides.value,
  selectedAction: {
    selectedStrategy: overrides.executedStrategy,
    strategyPolicyId: DEFAULT_POLICY,
    strategyAlternatives: [
      { policyId: BALANCED_POLICY, selectedStrategy: overrides.challengerStrategy, candidates: [] },
    ],
  },
});

test('T3: shadow report exposes challenger win rate on real value-evidence and suggests promotion', async () => {
  const repository = new SQLiteLearningCycleRepository({ dbFile: tempDbFile() });
  const service = new LearningCycleService(repository);

  // teach 的真实价值高(+0.6),probe 的真实价值低(-0.2)——由已执行策略的真实 value 聚合。
  // 6 条 DEFAULT 执行 teach(与 BALANCED 一致)→ 给 teach 真实价值样本 + 一致对比。
  for (let i = 0; i < 6; i += 1) {
    await repository.create(seed({ executedStrategy: 'teach', challengerStrategy: 'teach', value: 0.6 }));
  }
  // 9 条 DEFAULT 执行 probe 但 BALANCED 选 teach(分歧)→ 决断对比,挑战者(teach 0.6 > probe -0.2)赢。
  for (let i = 0; i < 9; i += 1) {
    await repository.create(seed({ executedStrategy: 'probe', challengerStrategy: 'teach', value: -0.2 }));
  }

  const report = await service.getShadowConfigPromotionReport('student-shadow');

  // 胜率读得出,且建立在真实 value-evidence(teach vs probe 真实均值)上。
  assert.equal(report.primaryPolicyId, DEFAULT_POLICY);
  assert.equal(report.challengerPolicyId, BALANCED_POLICY);
  assert.equal(report.decisiveComparisons, 9);
  assert.equal(report.challengerWins, 9);
  assert.equal(report.challengerWinRate, 1);
  assert.equal(report.agreementCount, 6);

  const teachValue = report.perStrategyValue.find((e) => e.strategy === 'teach');
  const probeValue = report.perStrategyValue.find((e) => e.strategy === 'probe');
  assert.ok(teachValue && probeValue);
  assert.ok(teachValue!.averageValueEffect > probeValue!.averageValueEffect);

  // 显式"建议晋升"决策。
  assert.equal(report.decision, 'promote-challenger');
  assert.ok(report.decisionRationale.includes('建议晋升'));

  // 配置真实切换需人工确认:门只建议,不自动切。
  assert.equal(report.autoFlipAllowed, false);
  assert.equal(report.requiresHumanConfirmation, true);

  // 决策记录已结构化持久化(不只是自然语言)。
  const evidence = await repository.listEvidenceByStudent('student-shadow');
  const decisionRecord = evidence.find((e) => e.source === 'shadow.config.promotion.decision');
  assert.ok(decisionRecord, 'promotion decision must be persisted as a structured evidence record');
  const persisted = (decisionRecord!.payload as { shadowConfigPromotion: { decision: string; challengerWinRate: number } })
    .shadowConfigPromotion;
  assert.equal(persisted.decision, 'promote-challenger');
  assert.equal(persisted.challengerWinRate, 1);
});

test('T3: insufficient real value-evidence window holds DEFAULT and does not promote', () => {
  // 只有 3 个分歧对比(< minDecisiveWindow=8),且缺乏足够真实样本 → 维持,不晋升。
  const cycles: LearningCycleRecord[] = [];
  const now = Date.now();
  for (let i = 0; i < 3; i += 1) {
    cycles.push({
      id: `c-${i}`,
      studentId: 'student-thin',
      source: 'mobius-session',
      status: 'validated',
      painPoint: '函数图像',
      rule: 'rule',
      outcome: 'success',
      effectScore: 0.4,
      effectScoreValueComponent: 0.4,
      selectedAction: {
        selectedStrategy: 'teach',
        strategyPolicyId: DEFAULT_POLICY,
        strategyAlternatives: [
          { policyId: BALANCED_POLICY, selectedStrategy: 'probe', candidates: [] },
        ],
      },
      createdAt: new Date(now + i).toISOString(),
      updatedAt: new Date(now + i).toISOString(),
    });
  }

  const report = compareShadowConfigs({
    cycles,
    primaryPolicyId: DEFAULT_POLICY,
    challengerPolicyId: BALANCED_POLICY,
  });

  assert.equal(report.decision, 'insufficient-evidence');
  assert.ok(report.decisiveComparisons < 8);
  // 纪律不变:即使数据薄,晋升也从不自动 flip。
  assert.equal(report.autoFlipAllowed, false);
  assert.equal(report.requiresHumanConfirmation, true);
});

test('T3: promotion gate never fires on execution-only signals (uses value-evidence, not resolved proxy)', () => {
  // 构造"执行代理很漂亮但真实价值为负"的分歧样本:挑战者选的策略真实价值更低。
  // teach 真实价值 -0.5(执行都 resolved 也不影响),probe 真实价值 +0.3。
  const cycles: LearningCycleRecord[] = [];
  const now = Date.now();
  const push = (i: number, executed: StrategyKind, challenger: StrategyKind, value: number) => {
    cycles.push({
      id: `x-${i}`,
      studentId: 'student-goodhart',
      source: 'mobius-session',
      status: 'validated',
      painPoint: '函数图像',
      rule: 'rule',
      outcome: value >= 0 ? 'success' : 'failure',
      effectScore: value,
      effectScoreValueComponent: value,
      // 即便执行分量拉满,也不进入 gate(gate 只读 value 分量)。
      effectScoreExecutionComponent: 0.1,
      selectedAction: {
        selectedStrategy: executed,
        strategyPolicyId: DEFAULT_POLICY,
        strategyAlternatives: [
          { policyId: BALANCED_POLICY, selectedStrategy: challenger, candidates: [] },
        ],
      },
      createdAt: new Date(now + i).toISOString(),
      updatedAt: new Date(now + i).toISOString(),
    });
  };
  // 给 teach 真实负价值样本。
  for (let i = 0; i < 6; i += 1) push(i, 'teach', 'teach', -0.5);
  // 分歧:DEFAULT 执行 probe(+0.3),BALANCED 选 teach(-0.5)→ 挑战者真实价值更低,应输。
  for (let i = 6; i < 16; i += 1) push(i, 'probe', 'teach', 0.3);

  const report = compareShadowConfigs({
    cycles,
    primaryPolicyId: DEFAULT_POLICY,
    challengerPolicyId: BALANCED_POLICY,
  });

  assert.equal(report.decisiveComparisons, 10);
  assert.equal(report.challengerWins, 0);
  assert.equal(report.primaryWins, 10);
  assert.equal(report.decision, 'hold-primary');
});
