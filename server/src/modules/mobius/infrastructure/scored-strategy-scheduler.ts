import type { StrategyScheduler } from '../domain/ports.js';
import type {
  StrategyCandidate,
  StrategyDecision,
  StrategyKind,
  StrategySchedulerInput,
} from '../domain/types.js';
import {
  buildStrategyScoreBreakdown,
  STRATEGY_BASE_SCORES,
  summarizeStrategyBreakdown,
} from './strategy-policy-features.js';
import {
  logit,
  percentToProbability,
  probabilityToPercent,
  sigmoid,
} from '../../ai/application/probabilistic-model.js';

// v0 工程估值。这些阈值是当前线上策略的不锁字段，A/B 影子策略通过覆盖
// teachUnlock 阈值与 strategyBias 来产生与主策略不同的决策曲面。
// 等到累计 N=200 cycles 之后，这套阈值会被基于 effectScore 的回归替换。
export interface ScoredSchedulerConfig {
  policyId: string;
  teachUnlock: {
    recentFailurePressure: number;
    timePressureSolo: number;
    emotionRiskSolo: number;
    timePressureCombo: number;
    noisePressureCombo: number;
    emotionRiskCombo: number;
  };
  strategyBias: {
    teachUnlocked: number;
    teachLocked: number;
    probeWhenNoisy: number;
    probeNoiseThreshold: number;
  };
}

export const DEFAULT_SCORED_SCHEDULER_CONFIG: ScoredSchedulerConfig = {
  policyId: 'scored-default-v0',
  teachUnlock: {
    recentFailurePressure: 12,
    timePressureSolo: 18,
    emotionRiskSolo: 18,
    timePressureCombo: 12,
    noisePressureCombo: 16,
    emotionRiskCombo: 14,
  },
  strategyBias: {
    teachUnlocked: 6,
    teachLocked: -28,
    probeWhenNoisy: 6,
    probeNoiseThreshold: 12,
  },
};

// 影子策略：更早解锁 teach，对 probe 在低噪声下也给出鼓励，
// 用于离线对比哪种策略带来更高的 effectScore。
export const BALANCED_SCORED_SCHEDULER_CONFIG: ScoredSchedulerConfig = {
  policyId: 'scored-balanced-v0',
  teachUnlock: {
    recentFailurePressure: 8,
    timePressureSolo: 14,
    emotionRiskSolo: 14,
    timePressureCombo: 10,
    noisePressureCombo: 12,
    emotionRiskCombo: 10,
  },
  strategyBias: {
    teachUnlocked: 4,
    teachLocked: -20,
    probeWhenNoisy: 8,
    probeNoiseThreshold: 8,
  },
};

export class ScoredStrategyScheduler implements StrategyScheduler {
  private readonly config: ScoredSchedulerConfig;

  constructor(config: ScoredSchedulerConfig = DEFAULT_SCORED_SCHEDULER_CONFIG) {
    this.config = config;
  }

  get policyId(): string {
    return this.config.policyId;
  }

  decide(input: StrategySchedulerInput): StrategyDecision {
    const candidates: StrategyCandidate[] = [
      this.buildCandidate('probe', input),
      this.buildCandidate('teach', input),
      this.buildCandidate('review', input),
    ].sort((left, right) => right.score - left.score);

    return {
      candidates,
      selectedStrategy: candidates[0]?.strategy ?? 'probe',
      policyId: this.config.policyId,
    };
  }

  private buildCandidate(strategy: StrategyKind, input: StrategySchedulerInput): StrategyCandidate {
    const baseScore = STRATEGY_BASE_SCORES[strategy];
    const scoreBreakdown = buildStrategyScoreBreakdown(strategy, input);
    const strategyBias = this.resolveStrategyBias(strategy, scoreBreakdown);
    const expectedUtility = this.estimateExpectedUtility(strategy, input, scoreBreakdown);
    const score = Math.max(
      0,
      Math.round(
        baseScore
          + Object.values(scoreBreakdown).reduce((total, feature) => total + feature.contribution, 0)
          + expectedUtility.utilityBonus
          + strategyBias
      ),
    );

    return {
      strategy,
      baseScore,
      score,
      scoreBreakdown,
      expectedUtility,
      rationale: this.describeCandidate(strategy, scoreBreakdown, expectedUtility),
    };
  }

  private estimateExpectedUtility(
    strategy: StrategyKind,
    input: StrategySchedulerInput,
    breakdown: StrategyCandidate['scoreBreakdown'],
  ) {
    const masteryGap = breakdown.masteryGap.value / 24;
    const failurePressure = breakdown.recentFailurePressure.value / 24;
    const successRecovery = breakdown.recentSuccessRecovery.value / 18;
    const noisePressure = breakdown.noisePressure.value / 26;
    const emotionRisk = breakdown.emotionRisk.value / 22;
    const timePressure = breakdown.timePressure.value / 24;
    const graphPriorPressure = breakdown.graphPriorPressure.value / 24;
    const fatigue = percentToProbability(input.cognitiveState.execution.fatigue);
    const confidence = percentToProbability(input.cognitiveState.execution.confidence);

    const prior =
      strategy === 'probe'
        ? 0.5 + noisePressure * 0.18 + masteryGap * 0.08 + graphPriorPressure * 0.1
        : strategy === 'teach'
        ? 0.45 + failurePressure * 0.2 + masteryGap * 0.18 + emotionRisk * 0.12 + graphPriorPressure * 0.18
        : 0.48 + successRecovery * 0.22 + confidence * 0.12 - graphPriorPressure * 0.08;
    const cost =
      strategy === 'probe'
        ? timePressure * 0.16 + fatigue * 0.08
      : strategy === 'teach'
        ? timePressure * 0.2 + fatigue * 0.12
        : masteryGap * 0.12 + noisePressure * 0.08 + graphPriorPressure * 0.05;
    const calibratedSuccess = sigmoid(logit(prior) - cost);
    const utility = calibratedSuccess - cost;

    return {
      successProbability: probabilityToPercent(calibratedSuccess),
      utilityBonus: Math.round((utility - 0.35) * 18),
    };
  }

  private resolveStrategyBias(
    strategy: StrategyKind,
    breakdown: StrategyCandidate['scoreBreakdown'],
  ) {
    const timePressure = breakdown.timePressure.value;
    const noisePressure = breakdown.noisePressure.value;
    const emotionRisk = breakdown.emotionRisk.value;
    const recentFailurePressure = breakdown.recentFailurePressure.value;
    const { teachUnlock, strategyBias } = this.config;

    const teachUnlocked =
      recentFailurePressure >= teachUnlock.recentFailurePressure
      || timePressure >= teachUnlock.timePressureSolo
      || emotionRisk >= teachUnlock.emotionRiskSolo
      || (
        timePressure >= teachUnlock.timePressureCombo
        && noisePressure >= teachUnlock.noisePressureCombo
        && emotionRisk >= teachUnlock.emotionRiskCombo
      );

    if (strategy === 'teach') {
      return teachUnlocked ? strategyBias.teachUnlocked : strategyBias.teachLocked;
    }

    if (strategy === 'probe') {
      return noisePressure >= strategyBias.probeNoiseThreshold && !teachUnlocked
        ? strategyBias.probeWhenNoisy
        : 0;
    }

    return 0;
  }

  private describeCandidate(
    strategy: StrategyKind,
    breakdown: StrategyCandidate['scoreBreakdown'],
    expectedUtility: { successProbability: number; utilityBonus: number },
  ) {
    const highlights = summarizeStrategyBreakdown(breakdown)
      .map((feature) => `${feature.label}${feature.contribution >= 0 ? '+' : ''}${feature.contribution}`)
      .join('，');

    if (strategy === 'probe') {
      return `先探测断点。后验成功率约${expectedUtility.successProbability}/100，效用校准${expectedUtility.utilityBonus >= 0 ? '+' : ''}${expectedUtility.utilityBonus}。${highlights || '当前需要先缩小认知断裂。'}`;
    }

    if (strategy === 'teach') {
      return `先保护性教学。后验成功率约${expectedUtility.successProbability}/100，效用校准${expectedUtility.utilityBonus >= 0 ? '+' : ''}${expectedUtility.utilityBonus}。${highlights || '当前需要更窄一步的示范。'}`;
    }

    return `先做规则回看。后验成功率约${expectedUtility.successProbability}/100，效用校准${expectedUtility.utilityBonus >= 0 ? '+' : ''}${expectedUtility.utilityBonus}。${highlights || '当前适合快速复盘再前进。'}`;
  }
}
