import { useMemo } from 'react';
import {
  buildSortedTodayPlan,
  type TaskCardData,
  type TodayPlanInput,
} from './dailyOrchestration';

// 把 App.tsx 中之前用 IIFE 重新计算的 todayPlan 提为 React 友好的 hook：
// useMemo 缓存 + 依赖项显式声明。这是 #5 抽 useDailyOrchestration 的最后一步，
// 让首页 daily orchestration 终于成为可独立替换、可独立测试的单元。

export interface UseDailyOrchestrationResult {
  todayPlan: TaskCardData[];
  totalMinutes: number;
  totalXp: number;
  doneCount: number;
}

export const useDailyOrchestration = (input: TodayPlanInput): UseDailyOrchestrationResult => {
  return useMemo(() => {
    const todayPlan = buildSortedTodayPlan(input);
    const aggregate = todayPlan.reduce(
      (acc, item) => {
        acc.totalMinutes += item.mins;
        acc.totalXp += item.xp;
        if (item.status === 'done') acc.doneCount += 1;
        return acc;
      },
      { totalMinutes: 0, totalXp: 0, doneCount: 0 },
    );
    return { todayPlan, ...aggregate };
  }, [
    input.targetScore,
    input.topError,
    input.topSignal,
    input.preferredFocus.subject,
    input.preferredFocus.node,
    input.taskStatus,
    input.errorListLength,
    input.timeSaved,
    input.lastOutcome,
  ]);
};
