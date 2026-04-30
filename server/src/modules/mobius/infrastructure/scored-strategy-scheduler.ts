import type { StrategyScheduler } from '../domain/ports.js';
import type { StrategyCandidate, StrategyKind, StrategySchedulerInput } from '../domain/types.js';
import {
  buildStrategyScoreBreakdown,
  STRATEGY_BASE_SCORES,
  summarizeStrategyBreakdown,
} from './strategy-policy-features.js';

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
    const score = Math.max(
      0,
      Math.round(
        baseScore
          + Object.values(scoreBreakdown).reduce((total, feature) => total + feature.contribution, 0)
          + strategyBias,
      ),
    );

    return {
      strategy,
      baseScore,
      score,
      scoreBreakdown,
      rationale: this.describeCandidate(strategy, scoreBreakdown),
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
  ) {
    const highlights = summarizeStrategyBreakdown(breakdown)
      .map((feature) => `${feature.label}${feature.contribution >= 0 ? '+' : ''}${feature.contribution}`)
      .join('，');

    if (strategy === 'probe') {
      return `先探测断点。${highlights || '当前需要先缩小认知断裂。'}`;
    }

    if (strategy === 'teach') {
      return `先保护性教学。${highlights || '当前需要更窄一步的示范。'}`;
    }

    return `先做规则回看。${highlights || '当前适合快速复盘再前进。'}`;
  }
}
