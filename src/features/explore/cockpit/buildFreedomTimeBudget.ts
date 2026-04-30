export interface FreedomTimeBudgetInput {
  activeStructuralIntelligence: number;
  stage: 'seed' | 'forming' | 'connecting' | 'integrating' | 'structural';
  dominantWeakness: string;
  recommendedNodeKey?: string;
  historyCount: number;
}

export interface FreedomTimeBudget {
  repairMinutes: number;
  minimumRepairPath: string;
  freedomSuggestion: string;
  nextActionLabel: string;
  nextNodeKey?: string;
}

export function buildFreedomTimeBudget(
  input: FreedomTimeBudgetInput,
): FreedomTimeBudget {
  const baseMinutesByStage: Record<FreedomTimeBudgetInput['stage'], number> = {
    seed: 15,
    forming: 12,
    connecting: 10,
    integrating: 8,
    structural: 6,
  };

  const weaknessExtra = input.dominantWeakness === 'integration' ? 4 : 2;
  const historyDiscount = Math.min(3, input.historyCount);

  const repairMinutes = Math.max(
    5,
    baseMinutesByStage[input.stage] + weaknessExtra - historyDiscount,
  );

  return {
    repairMinutes,
    minimumRepairPath: input.recommendedNodeKey
      ? '完成 1 个推荐御风节点，并保存 1 条御风快照。'
      : '先完成 1 个探索节点，建立今日第一条有效学习证据。',
    freedomSuggestion:
      repairMinutes <= 8
        ? '完成最短修复后，建议进入自由探索：任选一个你感兴趣的基础科学节点。'
        : '先完成必要修复，再把剩余精力交给自由探索，不建议继续盲目刷题。',
    nextActionLabel: input.recommendedNodeKey
      ? '进入最短修复节点'
      : '进入探索地图',
    nextNodeKey: input.recommendedNodeKey,
  };
}
