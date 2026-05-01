import type { AIErrorDiagnosisResult } from './aiDiagnosisTypes';

export interface YufengTaskDraftFromDiagnosis {
  title: string;
  mistakeKey: string;
  primaryNodeKey: string;
  secondaryNodeKeys: string[];
  estimatedMinutes: number;
  repairAction: string;
  yufengSuggestion: string;
  completionStandard: string;
  afterCompletion: string;
  actionLabel: string;
}

export function buildYufengTaskDraftFromDiagnosis(
  diagnosis: AIErrorDiagnosisResult,
): YufengTaskDraftFromDiagnosis {
  const confidenceAdjustment = diagnosis.confidence < 0.6
    ? 4
    : diagnosis.confidence < 0.8
      ? 2
      : 0;
  const estimatedMinutes = Math.min(18, Math.max(8, 10 + confidenceAdjustment));

  return {
    title: '御风任务草案',
    mistakeKey: diagnosis.mistakeKey,
    primaryNodeKey: diagnosis.recommendedExploreNodes.primaryNodeKey,
    secondaryNodeKeys: diagnosis.recommendedExploreNodes.secondaryNodeKeys,
    estimatedMinutes,
    repairAction: diagnosis.repairAction,
    yufengSuggestion: diagnosis.yufengSuggestion,
    completionStandard: '完成推荐探索节点，提交 1 条探索证据，并保存 1 条御风快照。',
    afterCompletion: '完成后进入自由探索，不继续盲目刷题。',
    actionLabel: '查看草案推荐节点',
  };
}
