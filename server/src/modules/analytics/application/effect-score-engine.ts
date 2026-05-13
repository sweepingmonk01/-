import type { CognitiveState } from '../../mobius/domain/types.js';
import type { LearningCycleRecord } from '../domain/types.js';

// v0 工程估值。N=200 cycles 后回归替换。
// 验收：替换后 7 天内 cycle 完成率下降不超过 5%。
//
// 设计目标：把单点 0/1 的 binary effectScore 升级为带方向的边际贡献度量。
// 输出范围 [-1, 1]，正向表示本次干预相对历史与状态有改善，负向表示退化。
//
// 总分 = W_OUTCOME * outcomeSign         // ±1，绝对方向
//      + W_KERNEL  * kernelDelta          // [-1,1]，三轴均值变化
//      + W_BASELINE * surpriseDelta       // [-1,1]，相对历史的"出人意料"程度
//
// W_OUTCOME / W_KERNEL / W_BASELINE 之和为 1，单位归一化。
export const EFFECT_SCORE_WEIGHTS = {
  outcome: 0.5,
  kernel: 0.3,
  baseline: 0.2,
} as const;

export type EffectScoreOutcome = 'success' | 'failure';

export interface EffectScoreInput {
  outcome: EffectScoreOutcome;
  stateBefore?: CognitiveState | null;
  stateAfter?: CognitiveState | null;
  // 同 student + painPoint 的历史完成 cycle 列表，不应包含当前 cycle。
  // 只取 outcome 为 success/failure 的记录用于基线计算。
  historicalCycles?: LearningCycleRecord[];
}

export interface EffectScoreBreakdown {
  total: number;
  outcomeComponent: number;
  kernelComponent: number;
  baselineComponent: number;
  baselineSuccessRate: number | null;
  kernelDelta: number;
}

const clamp = (value: number, min: number = -1, max: number = 1) => (
  Math.max(min, Math.min(max, value))
);

const round = (value: number) => Math.round(value * 1000) / 1000;

const computeKernelDelta = (
  stateBefore?: CognitiveState | null,
  stateAfter?: CognitiveState | null,
): number => {
  if (!stateBefore?.kernel || !stateAfter?.kernel) return 0;
  const before = stateBefore.kernel;
  const after = stateAfter.kernel;
  const deltas = [
    (after.time - before.time) / 100,
    (after.signalNoiseRatio - before.signalNoiseRatio) / 100,
    (after.emotion - before.emotion) / 100,
  ];
  const mean = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
  return clamp(mean);
};

const computeBaselineSuccessRate = (cycles: LearningCycleRecord[] | undefined): number | null => {
  if (!cycles || cycles.length === 0) return null;
  const completed = cycles.filter(
    (cycle) => cycle.outcome === 'success' || cycle.outcome === 'failure',
  );
  if (completed.length === 0) return null;
  const successes = completed.filter((cycle) => cycle.outcome === 'success').length;
  return successes / completed.length;
};

export const computeEffectScore = (input: EffectScoreInput): EffectScoreBreakdown => {
  const outcomeSign = input.outcome === 'success' ? 1 : -1;
  const kernelDelta = computeKernelDelta(input.stateBefore, input.stateAfter);
  const baselineSuccessRate = computeBaselineSuccessRate(input.historicalCycles);

  const outcomeComponent = EFFECT_SCORE_WEIGHTS.outcome * outcomeSign;
  const kernelComponent = EFFECT_SCORE_WEIGHTS.kernel * kernelDelta;

  // surpriseDelta：现在的 binary 结果 (0/1) 减去历史成功率。
  // 在低基线下成功 → 正向 surprise；高基线下失败 → 负向 surprise。
  // 没有基线时不贡献分数。
  const surpriseDelta = baselineSuccessRate === null
    ? 0
    : (input.outcome === 'success' ? 1 : 0) - baselineSuccessRate;
  const baselineComponent = EFFECT_SCORE_WEIGHTS.baseline * surpriseDelta;

  const total = clamp(outcomeComponent + kernelComponent + baselineComponent);

  return {
    total: round(total),
    outcomeComponent: round(outcomeComponent),
    kernelComponent: round(kernelComponent),
    baselineComponent: round(baselineComponent),
    baselineSuccessRate: baselineSuccessRate === null ? null : round(baselineSuccessRate),
    kernelDelta: round(kernelDelta),
  };
};
