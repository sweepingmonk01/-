import type { StrategyKind } from '../../mobius/domain/types.js';
import type { LearningCycleRecord } from '../domain/types.js';

// —— T2 价值信号回流 ——
// 把 learning_cycles 里累计的**价值证据 effect_score**(不是执行代理)按已选策略聚合，
// 产出一个带硬上限的 per-strategy 分数偏置，回流进 ScoredStrategyScheduler。
// 历史上带来正向真实学习增益的策略下次得分被抬高；带来退化的被压低。
//
// 关键纪律:只吃 valueComponent(缺省回落到 effectScore 全量，兼容旧行)，
// 永远不吃 executionComponent——否则回流会奖励"刷回执"，正是 Goodhart 闸要挡的。
export const STRATEGY_VALUE_REFLOW_CAP = 8; // 与 scheduler 的 score 单位同尺度

const clampBias = (value: number) => (
  Math.max(-STRATEGY_VALUE_REFLOW_CAP, Math.min(STRATEGY_VALUE_REFLOW_CAP, value))
);
const round = (value: number) => Math.round(value * 1000) / 1000;

export interface StrategyValueReflowEntry {
  strategy: StrategyKind;
  sampleCount: number;
  // 该策略下已完成 cycle 的价值证据 effect_score 均值，范围 [-1, 1]。
  averageValueEffect: number;
  // 回流偏置，范围 [-CAP, CAP]。
  bias: number;
}

export interface StrategyValueReflow {
  biases: Partial<Record<StrategyKind, number>>;
  entries: StrategyValueReflowEntry[];
  // 参与聚合的已完成 cycle 数(有价值证据 + 已选策略)。
  consideredCycles: number;
}

const STRATEGY_KINDS: StrategyKind[] = ['probe', 'teach', 'review'];

const valueEffectOf = (cycle: LearningCycleRecord): number | null => {
  // 优先用价值分量;旧行只有 effectScore(彼时执行证据未接入,total≈价值)时回落。
  const value = typeof cycle.effectScoreValueComponent === 'number'
    ? cycle.effectScoreValueComponent
    : cycle.effectScore;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  // 只把已判定结果的 cycle 计入(与 effect_score 语义一致)。
  if (cycle.outcome !== 'success' && cycle.outcome !== 'failure') return null;
  return value;
};

export const computeStrategyValueReflow = (
  cycles: LearningCycleRecord[],
): StrategyValueReflow => {
  const buckets = new Map<StrategyKind, number[]>();
  let consideredCycles = 0;

  for (const cycle of cycles) {
    const strategy = cycle.selectedAction?.selectedStrategy;
    if (!strategy || !STRATEGY_KINDS.includes(strategy)) continue;
    const value = valueEffectOf(cycle);
    if (value === null) continue;
    buckets.set(strategy, [...(buckets.get(strategy) ?? []), value]);
    consideredCycles += 1;
  }

  const entries: StrategyValueReflowEntry[] = [];
  const biases: Partial<Record<StrategyKind, number>> = {};

  for (const strategy of STRATEGY_KINDS) {
    const values = buckets.get(strategy);
    if (!values || values.length === 0) continue;
    const averageValueEffect = values.reduce((sum, value) => sum + value, 0) / values.length;
    const bias = round(clampBias(averageValueEffect * STRATEGY_VALUE_REFLOW_CAP));
    entries.push({
      strategy,
      sampleCount: values.length,
      averageValueEffect: round(averageValueEffect),
      bias,
    });
    biases[strategy] = bias;
  }

  return { biases, entries, consideredCycles };
};
