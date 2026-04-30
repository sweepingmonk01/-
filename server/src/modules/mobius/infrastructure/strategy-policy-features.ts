import type {
  StrategyFeatureKey,
  StrategyKind,
  StrategySchedulerInput,
  StrategyScoreBreakdown,
} from '../domain/types.js';

interface StrategyPolicyFeatureDefinition {
  key: StrategyFeatureKey;
  label: string;
  resolve: (input: StrategySchedulerInput) => number;
  weights: Record<StrategyKind, number>;
}

const clampScore = (value: number) => Math.max(0, Math.round(value));

export const STRATEGY_BASE_SCORES: Record<StrategyKind, number> = {
  probe: 22,
  teach: 10,
  review: 34,
};

const strategyPolicyFeatures: StrategyPolicyFeatureDefinition[] = [
  {
    key: 'painPointRecurrence',
    label: '重复痛点',
    resolve: (input) => (input.stateVector?.recentPainPoints.includes(input.context.painPoint) ? 18 : 8),
    weights: {
      probe: 1,
      teach: 0,
      review: 0,
    },
  },
  {
    key: 'timePressure',
    label: '时间压力',
    resolve: (input) => Math.round(((100 - input.cognitiveState.kernel.time) / 100) * 24),
    weights: {
      probe: -0.4,
      teach: 1.2,
      review: -0.6,
    },
  },
  {
    key: 'noisePressure',
    label: '噪声压力',
    resolve: (input) => Math.round(((100 - input.cognitiveState.kernel.signalNoiseRatio) / 100) * 26),
    weights: {
      probe: 1.1,
      teach: 1,
      review: -0.8,
    },
  },
  {
    key: 'emotionRisk',
    label: '情绪风险',
    resolve: (input) => Math.round(((100 - input.cognitiveState.kernel.emotion) / 100) * 22),
    weights: {
      probe: -0.2,
      teach: 1.3,
      review: -0.9,
    },
  },
  {
    key: 'masteryGap',
    label: '掌握缺口',
    resolve: (input) => {
      const masteryEntry = input.context.knowledgeAction?.id
        ? input.stateVector?.mastery[input.context.knowledgeAction.id]
        : undefined;

      return masteryEntry
        ? Math.round(((100 - masteryEntry.score) / 100) * 24)
        : 16;
    },
    weights: {
      probe: 0,
      teach: 0.7,
      review: -0.6,
    },
  },
  {
    key: 'recentFailurePressure',
    label: '近期失败压力',
    resolve: (input) => Math.min(24, (input.stateVector?.sessionContext.recentFailureCount ?? 0) * 6),
    weights: {
      probe: 1,
      teach: 1.2,
      review: -0.7,
    },
  },
  {
    key: 'recentSuccessRecovery',
    label: '近期成功恢复',
    resolve: (input) => Math.min(18, (input.stateVector?.sessionContext.recentSuccessCount ?? 0) * 5),
    weights: {
      probe: -0.7,
      teach: -0.4,
      review: 1.4,
    },
  },
];

export const buildStrategyScoreBreakdown = (
  strategy: StrategyKind,
  input: StrategySchedulerInput,
): StrategyScoreBreakdown => {
  const entries = strategyPolicyFeatures.map((feature) => {
    const value = clampScore(feature.resolve(input));
    const weight = feature.weights[strategy];

    return [feature.key, {
      label: feature.label,
      value,
      weight,
      contribution: Math.round(value * weight),
    }];
  });

  return Object.fromEntries(entries) as StrategyScoreBreakdown;
};

export const summarizeStrategyBreakdown = (breakdown: StrategyScoreBreakdown, limit: number = 2) =>
  Object.values(breakdown)
    .filter((feature) => feature.contribution !== 0)
    .sort((left, right) => Math.abs(right.contribution) - Math.abs(left.contribution))
    .slice(0, limit);
