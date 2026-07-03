import type { CognitiveState } from '../../mobius/domain/types.js';
import type { LearningCycleRecord } from '../domain/types.js';

// v0 工程估值。N=200 cycles 后回归替换。
// 验收：替换后 7 天内 cycle 完成率下降不超过 5%。
//
// 设计目标：把单点 0/1 的 binary effectScore 升级为带方向的边际贡献度量。
// 输出范围 [-1, 1]，正向表示本次干预相对历史与状态有改善，负向表示退化。
//
// —— T2 飞轮价值信号闭合(防 Goodhart)——
// effect_score 的**价值分量**只由 value-evidence 计算：
//   value-evidence = 前后状态向量差(kernelDelta) + 本轮真实作答对错(outcome)
//                  + 同类历史正确率基线(surprise，作为后续正确率/留存代理)。
// execution-evidence(交互是否 resolved / 媒体是否生成)只能贡献一个**带硬上限**的
// 微弱确认分量(EXECUTION_EVIDENCE_CAP)。即使执行信号全部满足，也无法把一次真实
// 学习增益为负的干预顶成正分——避免飞轮朝"刷干净回执"而非"真实提分"优化。
//
// 价值总分 = W_OUTCOME * outcomeSign      // ±1，绝对方向
//         + W_KERNEL  * kernelDelta        // [-1,1]，三轴均值变化
//         + W_BASELINE * surpriseDelta     // [-1,1]，相对历史的"出人意料"程度
// 最终 total = clamp(valueComponent + executionComponent(capped))。
//
// W_OUTCOME / W_KERNEL / W_BASELINE 之和为 1，单位归一化。
export const EFFECT_SCORE_WEIGHTS = {
  outcome: 0.5,
  kernel: 0.3,
  baseline: 0.2,
} as const;

// 执行代理证据的加权与硬上限。总执行贡献被夹在 [-CAP, CAP]。
export const EXECUTION_EVIDENCE_CAP = 0.1;
export const EXECUTION_EVIDENCE_WEIGHTS = {
  interactionResolved: 0.06,
  mediaGenerated: 0.04,
} as const;

export type EffectScoreOutcome = 'success' | 'failure';

export type EffectEvidenceKind = 'value' | 'execution';

// execution-evidence:交互是否 resolved、媒体是否生成。刻意与 value-evidence 分开，
// 且对 effect_score 只有被夹住的微弱贡献。undefined 表示未知(不贡献)。
export interface ExecutionEvidence {
  interactionResolved?: boolean;
  mediaGenerated?: boolean;
}

// 单条证据来源:标注它属于价值证据还是执行证据、贡献了多少分。
// 一次 cycle 可据此读出 effect_score 的来源分解(飞轮价值信号可审计)。
export interface EffectScoreEvidenceSource {
  kind: EffectEvidenceKind;
  signal: string;
  label: string;
  contribution: number;
  capped?: boolean;
}

export interface EffectScoreInput {
  outcome: EffectScoreOutcome;
  stateBefore?: CognitiveState | null;
  stateAfter?: CognitiveState | null;
  // 同 student + painPoint 的历史完成 cycle 列表，不应包含当前 cycle。
  // 只取 outcome 为 success/failure 的记录用于基线计算。
  historicalCycles?: LearningCycleRecord[];
  // execution-evidence，可选。缺省时不贡献任何分数。
  executionEvidence?: ExecutionEvidence;
}

export interface EffectScoreBreakdown {
  total: number;
  // 价值分量:唯一推动 effect_score 主体的来源(outcome + kernel + baseline)。
  valueComponent: number;
  // 执行分量:被 EXECUTION_EVIDENCE_CAP 夹住的代理确认。
  executionComponent: number;
  executionCapReached: boolean;
  outcomeComponent: number;
  kernelComponent: number;
  baselineComponent: number;
  baselineSuccessRate: number | null;
  kernelDelta: number;
  // 逐条来源分解:value vs execution。供回流与审计读出。
  evidenceSources: EffectScoreEvidenceSource[];
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

// 执行代理证据 → 被夹住的贡献。true=+weight，false=-weight，undefined=0。
const computeExecutionComponent = (
  evidence: ExecutionEvidence | undefined,
): { component: number; capReached: boolean; sources: EffectScoreEvidenceSource[] } => {
  if (!evidence) return { component: 0, capReached: false, sources: [] };

  const signed = (present: boolean | undefined, weight: number) => (
    present === undefined ? 0 : present ? weight : -weight
  );
  const raw =
    signed(evidence.interactionResolved, EXECUTION_EVIDENCE_WEIGHTS.interactionResolved)
    + signed(evidence.mediaGenerated, EXECUTION_EVIDENCE_WEIGHTS.mediaGenerated);
  const component = clamp(raw, -EXECUTION_EVIDENCE_CAP, EXECUTION_EVIDENCE_CAP);
  const capReached = Math.abs(raw) > EXECUTION_EVIDENCE_CAP + 1e-9;

  const sources: EffectScoreEvidenceSource[] = [];
  if (evidence.interactionResolved !== undefined) {
    sources.push({
      kind: 'execution',
      signal: 'interactionResolved',
      label: '交互是否 resolved',
      contribution: signed(evidence.interactionResolved, EXECUTION_EVIDENCE_WEIGHTS.interactionResolved),
      capped: capReached,
    });
  }
  if (evidence.mediaGenerated !== undefined) {
    sources.push({
      kind: 'execution',
      signal: 'mediaGenerated',
      label: '媒体是否生成',
      contribution: signed(evidence.mediaGenerated, EXECUTION_EVIDENCE_WEIGHTS.mediaGenerated),
      capped: capReached,
    });
  }

  return { component, capReached, sources };
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

  // 价值分量:只由 value-evidence 组成。这是 effect_score 的主体与回流依据。
  const valueComponent = outcomeComponent + kernelComponent + baselineComponent;

  // 执行分量:代理证据,硬上限,永远不能主导。
  const execution = computeExecutionComponent(input.executionEvidence);

  const total = clamp(valueComponent + execution.component);

  const evidenceSources: EffectScoreEvidenceSource[] = [
    {
      kind: 'value',
      signal: 'outcome',
      label: '本轮真实作答对错',
      contribution: round(outcomeComponent),
    },
    {
      kind: 'value',
      signal: 'kernelDelta',
      label: '三因子状态向量前后差',
      contribution: round(kernelComponent),
    },
    {
      kind: 'value',
      signal: 'baselineSurprise',
      label: '同类历史正确率基线(留存/后续正确率代理)',
      contribution: round(baselineComponent),
    },
    ...execution.sources.map((source) => ({ ...source, contribution: round(source.contribution) })),
  ];

  return {
    total: round(total),
    valueComponent: round(valueComponent),
    executionComponent: round(execution.component),
    executionCapReached: execution.capReached,
    outcomeComponent: round(outcomeComponent),
    kernelComponent: round(kernelComponent),
    baselineComponent: round(baselineComponent),
    baselineSuccessRate: baselineSuccessRate === null ? null : round(baselineSuccessRate),
    kernelDelta: round(kernelDelta),
    evidenceSources,
  };
};
