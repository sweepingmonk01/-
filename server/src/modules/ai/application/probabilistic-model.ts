export interface BetaBeliefInput {
  mean: number;
  confidence: number;
}

export interface BetaEvidence {
  positive: number;
  negative: number;
}

export interface BetaBelief {
  mean: number;
  confidence: number;
  alpha: number;
  beta: number;
  evidenceWeight: number;
}

export const clampUnit = (value: number) => Math.max(0.01, Math.min(0.99, Number(value.toFixed(4))));
export const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export const percentToProbability = (value: number) => clampUnit(value / 100);
export const probabilityToPercent = (value: number) => clampPercent(clampUnit(value) * 100);

export const logit = (value: number) => {
  const probability = clampUnit(value);
  return Math.log(probability / (1 - probability));
};

export const sigmoid = (value: number) => clampUnit(1 / (1 + Math.exp(-value)));

export const updateBetaBelief = (
  input: BetaBeliefInput,
  evidence: BetaEvidence,
  options: { priorStrength?: number; maxConfidence?: number } = {},
): BetaBelief => {
  const priorStrength = options.priorStrength ?? (2 + Math.max(0, input.confidence) * 18);
  const priorMean = clampUnit(input.mean);
  const alpha = priorMean * priorStrength + Math.max(0, evidence.positive);
  const beta = (1 - priorMean) * priorStrength + Math.max(0, evidence.negative);
  const evidenceWeight = alpha + beta;
  const mean = clampUnit(alpha / evidenceWeight);
  const maxConfidence = options.maxConfidence ?? 0.95;
  const confidence = Math.min(maxConfidence, Math.max(0.05, Number((evidenceWeight / (evidenceWeight + 8)).toFixed(2))));

  return {
    mean,
    confidence,
    alpha,
    beta,
    evidenceWeight,
  };
};

export const updatePosteriorProbability = (
  prior: number,
  likelihoodRatio: number,
): number => {
  const posteriorOdds = Math.exp(logit(prior)) * Math.max(0.05, likelihoodRatio);
  return clampUnit(posteriorOdds / (1 + posteriorOdds));
};

export const normalizeProbabilities = <T extends { confidence: number }>(items: T[]): T[] => {
  const total = items.reduce((sum, item) => sum + Math.max(0.01, item.confidence), 0);
  if (total <= 0) return items;

  return items.map((item) => ({
    ...item,
    confidence: clampUnit(item.confidence / total),
  }));
};
