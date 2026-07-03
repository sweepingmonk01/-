import type { StrategyKind } from '../../mobius/domain/types.js';
import type { LearningCycleRecord } from '../domain/types.js';

// —— T3 影子 A/B 配置晋升门 ——
// 现状:ScoredStrategyScheduler 的 DEFAULT(primary)vs BALANCED(shadow)在
// ShadowStrategyScheduler 内并行 A/B,只记录不裁决,无晋升门(审查 D3,元一"影子永续空转")。
//
// 本门做最小裁决:基于 T2 阶段一产出的**真实 value-evidence**(effect_score_value)
// 定义 shadow 胜率窗口,达阈值则输出显式"建议晋升 BALANCED / 维持 DEFAULT"决策记录。
//
// 关键纪律(与母仓元一北极星同款):
//  - 晋升判据只用真实价值信号(effect_score_value / effectScore 回落),
//    **不用**交互 resolved 这类执行代理——那会把 A/B 变成"刷回执"竞赛。
//  - 门只能自动"建议"(降级/标记是自动动作);配置真实切换(把 primary 从 DEFAULT
//    flip 成 BALANCED)保留**人工确认**——autoFlipAllowed 恒 false。
//
// 反事实的诚实边界:shadow(BALANCED)的选择从未真正执行,我们没有它的直接结果。
// 因此本门用"per-strategy 真实价值表"(由已执行策略的真实 value-evidence 聚合)给两配置
// 在同一批历史决策上下文上的**策略选择**打分:分歧 cycle 上,谁选的策略经验价值更高谁赢。
// 这评估的是"策略配置的选择政策"对照"经验测得的策略价值",不伪造反事实结果。

export const SHADOW_PROMOTION_CONFIG = {
  // 至少这么多"两配置分歧且双方策略都有真实价值样本"的决断对比,才允许出晋升裁决。
  minDecisiveWindow: 8,
  // 挑战者(BALANCED)胜率达此阈值才建议晋升。
  challengerWinRateThreshold: 0.6,
  // 两策略经验价值差小于此视为并列(避免噪声抖动误判)。
  valueEpsilon: 0.02,
} as const;

// 配置真实切换的人工确认闸:恒 false。没有任何自动路径把 primary flip 成 challenger;
// 晋升门只产出"建议",真正切换 app.ts 的 primary 配置是人类动作。
export const SHADOW_CONFIG_AUTO_FLIP_ENABLED = false as const;

export type ShadowPromotionDecision =
  | 'promote-challenger'
  | 'hold-primary'
  | 'insufficient-evidence';

export interface ShadowConfigComparisonInput {
  cycles: LearningCycleRecord[];
  primaryPolicyId: string;
  challengerPolicyId: string;
}

export interface ShadowStrategyValueEntry {
  strategy: StrategyKind;
  sampleCount: number;
  averageValueEffect: number;
}

export interface ShadowConfigComparisonReport {
  primaryPolicyId: string;
  challengerPolicyId: string;
  generatedAt: string;
  // 两配置选择都可解析、且该 cycle 有真实价值证据的 cycle 数。
  comparableCycles: number;
  // 两配置选同一策略(一致)。
  agreementCount: number;
  agreementRate: number;
  // 分歧 + 双方策略都有真实价值样本 → 可决断对比数。这是胜率窗口。
  decisiveComparisons: number;
  challengerWins: number;
  primaryWins: number;
  ties: number;
  // 挑战者在真实 value-evidence 上的胜率 = wins / decisive。窗口为空时 null。
  challengerWinRate: number | null;
  // per-strategy 真实价值表(裁决依据的经验价值)。
  perStrategyValue: ShadowStrategyValueEntry[];
  decision: ShadowPromotionDecision;
  decisionRationale: string;
  // 纪律标志:门只建议,不自动切;配置真实切换需人工确认。
  autoFlipAllowed: false;
  requiresHumanConfirmation: true;
}

const STRATEGY_KINDS: StrategyKind[] = ['probe', 'teach', 'review'];
const round = (value: number) => Math.round(value * 1000) / 1000;

// 真实 value-evidence:优先价值分量,旧行回落 effectScore。只取已判定 cycle。
// 刻意不吃执行代理(execution component 从不进这里)。
const valueEvidenceOf = (cycle: LearningCycleRecord): number | null => {
  const value = typeof cycle.effectScoreValueComponent === 'number'
    ? cycle.effectScoreValueComponent
    : cycle.effectScore;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (cycle.outcome !== 'success' && cycle.outcome !== 'failure') return null;
  return value;
};

const decideGate = (
  decisiveComparisons: number,
  challengerWinRate: number | null,
): ShadowPromotionDecision => {
  if (decisiveComparisons < SHADOW_PROMOTION_CONFIG.minDecisiveWindow || challengerWinRate === null) {
    return 'insufficient-evidence';
  }
  if (challengerWinRate >= SHADOW_PROMOTION_CONFIG.challengerWinRateThreshold) {
    return 'promote-challenger';
  }
  return 'hold-primary';
};

export const compareShadowConfigs = (
  input: ShadowConfigComparisonInput,
): ShadowConfigComparisonReport => {
  // 1. per-strategy 真实价值表:用所有已判定 cycle 的**已执行策略** + 真实 value 聚合。
  const buckets = new Map<StrategyKind, number[]>();
  for (const cycle of input.cycles) {
    const strategy = cycle.selectedAction?.selectedStrategy;
    if (!strategy || !STRATEGY_KINDS.includes(strategy)) continue;
    const value = valueEvidenceOf(cycle);
    if (value === null) continue;
    buckets.set(strategy, [...(buckets.get(strategy) ?? []), value]);
  }

  const valueTable = new Map<StrategyKind, { avg: number; n: number }>();
  const perStrategyValue: ShadowStrategyValueEntry[] = [];
  for (const strategy of STRATEGY_KINDS) {
    const values = buckets.get(strategy);
    if (!values || values.length === 0) continue;
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    valueTable.set(strategy, { avg, n: values.length });
    perStrategyValue.push({ strategy, sampleCount: values.length, averageValueEffect: round(avg) });
  }

  // 2. 逐 cycle 比较两配置的策略选择。
  let comparableCycles = 0;
  let agreementCount = 0;
  let decisiveComparisons = 0;
  let challengerWins = 0;
  let primaryWins = 0;
  let ties = 0;

  for (const cycle of input.cycles) {
    const action = cycle.selectedAction;
    if (!action) continue;
    // 该 cycle 必须确实由主配置执行(否则不是这组 A/B 的对照)。
    if (action.strategyPolicyId !== input.primaryPolicyId) continue;
    const primaryStrategy = action.selectedStrategy;
    const challengerAlt = action.strategyAlternatives?.find(
      (alt) => alt.policyId === input.challengerPolicyId,
    );
    if (!primaryStrategy || !challengerAlt) continue;
    // 只在有真实价值证据的 cycle 上比较(真实 value-evidence 上的胜率)。
    if (valueEvidenceOf(cycle) === null) continue;

    comparableCycles += 1;
    const challengerStrategy = challengerAlt.selectedStrategy;
    if (primaryStrategy === challengerStrategy) {
      agreementCount += 1;
      continue;
    }

    // 分歧:用两策略的真实经验价值裁决。缺任一策略真实样本则不决断。
    const primaryValue = valueTable.get(primaryStrategy);
    const challengerValue = valueTable.get(challengerStrategy);
    if (!primaryValue || !challengerValue) continue;

    decisiveComparisons += 1;
    const diff = challengerValue.avg - primaryValue.avg;
    if (diff > SHADOW_PROMOTION_CONFIG.valueEpsilon) challengerWins += 1;
    else if (diff < -SHADOW_PROMOTION_CONFIG.valueEpsilon) primaryWins += 1;
    else ties += 1;
  }

  const challengerWinRate = decisiveComparisons > 0
    ? round(challengerWins / decisiveComparisons)
    : null;
  const decision = decideGate(decisiveComparisons, challengerWinRate);

  const decisionRationale = decision === 'insufficient-evidence'
    ? `真实价值证据窗口不足(可决断对比 ${decisiveComparisons} < ${SHADOW_PROMOTION_CONFIG.minDecisiveWindow}),维持 DEFAULT 并继续累积。`
    : decision === 'promote-challenger'
      ? `挑战者 ${input.challengerPolicyId} 在真实 value-evidence 上胜率 ${challengerWinRate}(≥ ${SHADOW_PROMOTION_CONFIG.challengerWinRateThreshold}),建议晋升;配置真实切换需人工确认。`
      : `挑战者 ${input.challengerPolicyId} 胜率 ${challengerWinRate}(< ${SHADOW_PROMOTION_CONFIG.challengerWinRateThreshold}),维持 DEFAULT。`;

  return {
    primaryPolicyId: input.primaryPolicyId,
    challengerPolicyId: input.challengerPolicyId,
    generatedAt: new Date().toISOString(),
    comparableCycles,
    agreementCount,
    agreementRate: comparableCycles > 0 ? round(agreementCount / comparableCycles) : 0,
    decisiveComparisons,
    challengerWins,
    primaryWins,
    ties,
    challengerWinRate,
    perStrategyValue,
    decision,
    decisionRationale,
    autoFlipAllowed: SHADOW_CONFIG_AUTO_FLIP_ENABLED,
    requiresHumanConfirmation: true,
  };
};
