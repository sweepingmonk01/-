import type {
  LearningCycleEvent,
  LearningCycleRecord,
} from '../src/modules/analytics/domain/types.js';
import type { EffectScoreBreakdown } from '../src/modules/analytics/application/effect-score-engine.js';
import type {
  StrategyAlternative,
  StrategyKind,
} from '../src/modules/mobius/domain/types.js';

export interface ReplayCycleRow {
  cycleId: string;
  cycleIdShort: string;
  studentId: string;
  createdAt: string;
  source: LearningCycleRecord['source'];
  status: LearningCycleRecord['status'];
  painPoint: string;
  outcome?: LearningCycleRecord['outcome'];
  effectScore?: number;
  breakdown?: EffectScoreBreakdown;
  primaryStrategy?: StrategyKind;
  primaryPolicyId?: string;
  shadowAlternatives: StrategyAlternative[];
  shadowAgreement: 'agree' | 'disagree' | 'no-shadow';
}

export interface ReplayReport {
  rows: ReplayCycleRow[];
  aggregate: {
    totalCycles: number;
    completedCycles: number;
    successRate: number;
    averageEffectScore: number | null;
    averageOutcomeComponent: number | null;
    averageKernelComponent: number | null;
    averageBaselineComponent: number | null;
    primaryByStrategy: Partial<Record<StrategyKind, number>>;
    shadowAgreementRate: number | null;
  };
}

const findEffectBreakdown = (events: LearningCycleEvent[]): EffectScoreBreakdown | undefined => {
  for (const event of events) {
    if (event.eventType !== 'effect.evaluated') continue;
    const payload = event.eventPayload as { effectScoreBreakdown?: EffectScoreBreakdown } | undefined;
    if (payload?.effectScoreBreakdown) return payload.effectScoreBreakdown;
  }
  return undefined;
};

const computeShadowAgreement = (
  primary: StrategyKind | undefined,
  shadows: StrategyAlternative[],
): ReplayCycleRow['shadowAgreement'] => {
  if (shadows.length === 0) return 'no-shadow';
  if (!primary) return 'disagree';
  return shadows.every((shadow) => shadow.selectedStrategy === primary) ? 'agree' : 'disagree';
};

export const buildReplayRow = (
  cycle: LearningCycleRecord,
  events: LearningCycleEvent[],
): ReplayCycleRow => {
  const breakdown = findEffectBreakdown(events);
  const primaryStrategy = cycle.selectedAction?.selectedStrategy;
  const shadowAlternatives = cycle.selectedAction?.strategyAlternatives ?? [];

  return {
    cycleId: cycle.id,
    cycleIdShort: cycle.id.slice(0, 8),
    studentId: cycle.studentId,
    createdAt: cycle.createdAt,
    source: cycle.source,
    status: cycle.status,
    painPoint: cycle.painPoint,
    outcome: cycle.outcome,
    effectScore: cycle.effectScore,
    breakdown,
    primaryStrategy,
    primaryPolicyId: cycle.selectedAction?.strategyPolicyId,
    shadowAlternatives,
    shadowAgreement: computeShadowAgreement(primaryStrategy, shadowAlternatives),
  };
};

const average = (values: number[]): number | null => (
  values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length
);

export const buildReplayReport = (
  cycles: LearningCycleRecord[],
  eventsByCycleId: Map<string, LearningCycleEvent[]>,
): ReplayReport => {
  const rows = cycles
    .map((cycle) => buildReplayRow(cycle, eventsByCycleId.get(cycle.id) ?? []))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const completed = rows.filter((row) => row.outcome === 'success' || row.outcome === 'failure');
  const successes = completed.filter((row) => row.outcome === 'success').length;

  const effectScores = completed
    .map((row) => row.effectScore)
    .filter((value): value is number => typeof value === 'number');
  const outcomeComps = completed
    .map((row) => row.breakdown?.outcomeComponent)
    .filter((value): value is number => typeof value === 'number');
  const kernelComps = completed
    .map((row) => row.breakdown?.kernelComponent)
    .filter((value): value is number => typeof value === 'number');
  const baselineComps = completed
    .map((row) => row.breakdown?.baselineComponent)
    .filter((value): value is number => typeof value === 'number');

  const primaryByStrategy: Partial<Record<StrategyKind, number>> = {};
  for (const row of rows) {
    if (row.primaryStrategy) {
      primaryByStrategy[row.primaryStrategy] = (primaryByStrategy[row.primaryStrategy] ?? 0) + 1;
    }
  }

  const rowsWithShadow = rows.filter((row) => row.shadowAgreement !== 'no-shadow');
  const agreedShadows = rowsWithShadow.filter((row) => row.shadowAgreement === 'agree').length;
  const shadowAgreementRate = rowsWithShadow.length === 0
    ? null
    : agreedShadows / rowsWithShadow.length;

  return {
    rows,
    aggregate: {
      totalCycles: rows.length,
      completedCycles: completed.length,
      successRate: completed.length === 0 ? 0 : successes / completed.length,
      averageEffectScore: average(effectScores),
      averageOutcomeComponent: average(outcomeComps),
      averageKernelComponent: average(kernelComps),
      averageBaselineComponent: average(baselineComps),
      primaryByStrategy,
      shadowAgreementRate,
    },
  };
};

const formatScore = (value: number | undefined | null): string => (
  typeof value === 'number' ? value.toFixed(3) : '—'
);

const formatPercent = (value: number | null): string => (
  value === null ? '—' : `${(value * 100).toFixed(1)}%`
);

const formatStrategy = (value: StrategyKind | undefined): string => (
  value ?? '—'
);

const formatShadowSummary = (alternatives: StrategyAlternative[]): string => (
  alternatives.length === 0
    ? '—'
    : alternatives.map((alt) => `${alt.policyId}:${alt.selectedStrategy}`).join('; ')
);

export const renderReplayTable = (report: ReplayReport): string => {
  const headers = ['createdAt', 'cycle', 'student', 'pain', 'outcome', 'effect', 'kern', 'base', 'primary', 'shadow', 'agree'];
  const lines: string[] = [];
  lines.push(headers.join('  '));
  lines.push(headers.map((header) => '-'.repeat(header.length)).join('  '));

  for (const row of report.rows) {
    lines.push([
      row.createdAt.slice(0, 19),
      row.cycleIdShort,
      row.studentId.slice(0, 10),
      row.painPoint.slice(0, 12),
      row.outcome ?? '—',
      formatScore(row.effectScore),
      formatScore(row.breakdown?.kernelComponent),
      formatScore(row.breakdown?.baselineComponent),
      formatStrategy(row.primaryStrategy),
      formatShadowSummary(row.shadowAlternatives),
      row.shadowAgreement,
    ].join('  '));
  }

  lines.push('');
  lines.push('aggregate:');
  lines.push(`  total cycles                  : ${report.aggregate.totalCycles}`);
  lines.push(`  completed cycles              : ${report.aggregate.completedCycles}`);
  lines.push(`  success rate                  : ${formatPercent(report.aggregate.successRate)}`);
  lines.push(`  avg effectScore               : ${formatScore(report.aggregate.averageEffectScore)}`);
  lines.push(`  avg outcomeComponent          : ${formatScore(report.aggregate.averageOutcomeComponent)}`);
  lines.push(`  avg kernelComponent           : ${formatScore(report.aggregate.averageKernelComponent)}`);
  lines.push(`  avg baselineComponent         : ${formatScore(report.aggregate.averageBaselineComponent)}`);
  lines.push(`  primary strategy distribution : ${JSON.stringify(report.aggregate.primaryByStrategy)}`);
  lines.push(`  shadow agreement rate         : ${formatPercent(report.aggregate.shadowAgreementRate)}`);

  return lines.join('\n');
};
