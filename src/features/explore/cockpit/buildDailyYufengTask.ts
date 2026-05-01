export interface DailyYufengTaskInput {
  repairMinutes: number;
  recommendedNodeKey?: string;
  dominantWeakness: string;
  stage: string;
  historyCount: number;
}

export interface DailyYufengTask {
  title: string;
  path: string;
  estimatedMinutes: number;
  completionStandard: string;
  afterCompletion: string;
  actionLabel: string;
  nextNodeKey?: string;
}

export function buildDailyYufengTask(
  input: DailyYufengTaskInput,
): DailyYufengTask {
  const hasNode = Boolean(input.recommendedNodeKey);

  return {
    title: '今日御风任务',
    path: hasNode
      ? '完成 1 个推荐御风节点，留下 1 条探索证据。'
      : '进入探索地图，选择 1 个基础科学节点，留下 1 条探索证据。',
    estimatedMinutes: input.repairMinutes,
    completionStandard:
      input.historyCount > 0
        ? '完成探索任务后，保存 1 次新的御风快照。'
        : '完成探索任务，并保存你的第一条御风快照。',
    afterCompletion: '完成后，把剩余精力交给自由探索。',
    actionLabel: hasNode ? '开始今日御风任务' : '进入探索地图',
    nextNodeKey: input.recommendedNodeKey,
  };
}
