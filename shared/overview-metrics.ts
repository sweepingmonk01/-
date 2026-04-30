import { normalizeCognitiveState, type CompatibleCognitiveState } from './cognitive-state.js';

const clamp = (value: number, min: number, max: number) => (
  Math.max(min, Math.min(max, Math.round(value)))
);

export type OverviewMetricTone = 'primary' | 'secondary' | 'green' | 'neutral';

export interface OverviewMetric {
  label: string;
  value: string;
  detail: string;
  tone: OverviewMetricTone;
}

export interface OverviewMetricInputs {
  timeSavedMinutes?: number;
  masteredNodes?: number;
  learningNodes?: number;
  successCount?: number;
  failureCount?: number;
  activeIssueCount?: number;
  cognitiveState?: CompatibleCognitiveState;
  currentFocus?: string | null;
  activeSignals?: Array<string | null | undefined>;
}

export interface OverviewViewState {
  efficiencyGrade: string;
  efficiencyLabel: string;
  efficiencySummary: string;
  currentFocus: string;
  activeSignals: string[];
  metrics: OverviewMetric[];
}

export const buildOverviewViewState = ({
  timeSavedMinutes = 0,
  masteredNodes = 0,
  learningNodes = 0,
  successCount = 0,
  failureCount = 0,
  activeIssueCount = 0,
  cognitiveState,
  currentFocus,
  activeSignals = [],
}: OverviewMetricInputs): OverviewViewState => {
  const resolvedCognitiveState = normalizeCognitiveState(cognitiveState);
  const totalInteractions = successCount + failureCount;
  const successRate = totalInteractions > 0
    ? Math.round((successCount / totalInteractions) * 100)
    : null;
  const noisePenalty = Math.min(
    10,
    Math.round((100 - resolvedCognitiveState.kernel.signalNoiseRatio) / 8),
  );
  const emotionPenalty = Math.min(
    8,
    Math.round((100 - resolvedCognitiveState.kernel.emotion) / 10),
  );
  const efficiencyScore = clamp(
    56
      + Math.min(18, masteredNodes * 4)
      + Math.min(8, Math.round(timeSavedMinutes / 12))
      + Math.min(8, successRate === null ? 0 : Math.round((successRate - 50) / 6))
      - Math.min(12, activeIssueCount * 2)
      - noisePenalty
      - emotionPenalty,
    24,
    98,
  );

  const efficiencyGrade = efficiencyScore >= 88
    ? 'S'
    : efficiencyScore >= 76
      ? 'A'
      : efficiencyScore >= 64
        ? 'B'
        : efficiencyScore >= 52
          ? 'C'
          : 'D';
  const efficiencyLabel = efficiencyGrade === 'S'
    ? '极佳'
    : efficiencyGrade === 'A'
      ? '稳定推进'
      : efficiencyGrade === 'B'
        ? '仍有空间'
        : efficiencyGrade === 'C'
          ? '需要收口'
          : '先止血';
  const normalizedSignals = Array.from(
    new Set(
      activeSignals
        .map((item) => item?.trim())
        .filter((item): item is string => Boolean(item)),
    ),
  ).slice(0, 3);

  return {
    efficiencyGrade,
    efficiencyLabel,
    efficiencySummary: successRate === null
      ? '当前还在积累首批裁决样本，先把第一条主线跑通。'
      : `最近交互命中率 ${successRate}% ，当前有 ${learningNodes} 个节点处于持续修复中。`,
    currentFocus: currentFocus?.trim() || '正在等待第一批有效学习信号。',
    activeSignals: normalizedSignals,
    metrics: [
      {
        label: '已点亮稳态节点',
        value: `${masteredNodes} 个`,
        detail: '当前知识地图里已经稳定拿分的节点数。',
        tone: 'green',
      },
      {
        label: '正在修复',
        value: `${learningNodes} 个`,
        detail: '图谱与状态向量共同指向的活跃修复区。',
        tone: 'secondary',
      },
      {
        label: '最近命中率',
        value: successRate === null ? '待积累' : `${successRate}%`,
        detail: totalInteractions ? `来自最近 ${totalInteractions} 次交互裁决。` : '还没有形成可用裁决样本。',
        tone: successRate !== null && successRate >= 60 ? 'primary' : 'neutral',
      },
      {
        label: '当前高危错题',
        value: `${activeIssueCount} 个`,
        detail: '仍处于激活状态、尚未完成回收的错题数。',
        tone: activeIssueCount > 0 ? 'primary' : 'neutral',
      },
    ],
  };
};
