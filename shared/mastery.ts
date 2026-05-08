// Mastery 等级映射。
//
// 把 0-100 的 mastery.score 投影成 5 级 + 经验条，让"我变厉害了"从
// 一个内部数字变成学生能直接看到的可视化反馈。这是 game-topology
// 第 4 节"成长层"对应的最小可见产物。
//
// 设计约束：
// - 每级 20 分，5 级覆盖 0-100。
// - 进度条比例 = (score - levelMin) / 20。
// - confidence 单独显示为 0..1 小数，不和 level 混淆。
// - 如果未来 mastery 公式回归升级（heuristic-formulas.ts: state-update.mastery-evidence），
//   只需要替换 score 来源，等级映射保持稳定。

export const MASTERY_LEVEL_COUNT = 5;
export const MASTERY_LEVEL_RANGE = 20;

export interface MasteryLevelView {
  level: number;
  // 当前等级内的进度，[0, 100]。
  percentInLevel: number;
  // 总分，便于 tooltip / 调试。
  score: number;
  // 距离下一级还差多少分，封顶时为 0。
  toNextLevel: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const computeMasteryLevel = (score: number): MasteryLevelView => {
  const safe = clamp(Math.round(score), 0, 100);
  // 80-100 都归为 Lv.5；其余每 20 分一级，从 1 起。
  const level = safe >= 80 ? MASTERY_LEVEL_COUNT : Math.floor(safe / MASTERY_LEVEL_RANGE) + 1;
  const levelMin = (level - 1) * MASTERY_LEVEL_RANGE;
  const intoLevel = safe - levelMin;
  const percentInLevel = level === MASTERY_LEVEL_COUNT
    ? Math.round(((safe - 80) / 20) * 100)
    : Math.round((intoLevel / MASTERY_LEVEL_RANGE) * 100);
  const toNextLevel = level === MASTERY_LEVEL_COUNT
    ? 0
    : Math.max(0, levelMin + MASTERY_LEVEL_RANGE - safe);

  return {
    level,
    percentInLevel: clamp(percentInLevel, 0, 100),
    score: safe,
    toNextLevel,
  };
};

export const masteryLevelLabel = (level: number): string => `Lv.${level}`;
