import type { StrategyScheduler } from '../domain/ports.js';
import type { StrategyCandidate, StrategyKind, StrategySchedulerInput } from '../domain/types.js';
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

export class ScoredStrategyScheduler implements StrategyScheduler {
  decide(input: StrategySchedulerInput) {
    const candidates: StrategyCandidate[] = [
      this.buildCandidate('probe', input),
      this.buildCandidate('teach', input),
      this.buildCandidate('review', input),
    ].sort((left, right) => right.score - left.score);

    return {
      candidates,
      selectedStrategy: candidates[0]?.strategy ?? 'probe',
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
    const fatigue = percentToProbability(input.cognitiveState.execution.fatigue);
    const confidence = percentToProbability(input.cognitiveState.execution.confidence);

    const prior =
      strategy === 'probe'
        ? 0.5 + noisePressure * 0.18 + masteryGap * 0.08
        : strategy === 'teach'
        ? 0.45 + failurePressure * 0.2 + masteryGap * 0.18 + emotionRisk * 0.12
        : 0.48 + successRecovery * 0.22 + confidence * 0.12;
    const cost =
      strategy === 'probe'
        ? timePressure * 0.16 + fatigue * 0.08
        : strategy === 'teach'
        ? timePressure * 0.2 + fatigue * 0.12
        : masteryGap * 0.12 + noisePressure * 0.08;
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

    const teachUnlocked =
      recentFailurePressure >= 12
      || timePressure >= 18
      || emotionRisk >= 18
      || (timePressure >= 12 && noisePressure >= 16 && emotionRisk >= 14);

    if (strategy === 'teach') {
      return teachUnlocked ? 6 : -28;
    }

    if (strategy === 'probe') {
      return noisePressure >= 12 && !teachUnlocked ? 6 : 0;
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
