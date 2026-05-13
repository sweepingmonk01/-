// 目标层（game-topology 第 4 节"目标层"）的叙事化升级。
//
// 之前 dashboard 的目标层只有 "目标分 110 / 进度 73%" 一根条形，
// 学生看不到自己处于"哪一段路"。这里把目标进度投影成 8 个东方探索风格
// 的章节里程碑（起航 / 入山 / 渡河 / 越岭 / 登顶 / 望远 / 凯旋 / 御风），
// 让"我现在在地图哪里"成为可视的空间感受。
//
// 设计约束：
// - 章节名是固定的叙事骨架（8 个），不依赖学科/题型
// - 进度按 estimatedScore / targetScore 的比例切 8 段
// - 当前章节内的子进度也算出来，便于在 UI 上画半填充态
// - 比例 ≥ 1（达成或超过目标）时锁定在最后一章并显示已完成

export const JOURNEY_CHAPTER_NAMES = [
  '起航',
  '入山',
  '渡河',
  '越岭',
  '登顶',
  '望远',
  '凯旋',
  '御风',
] as const;

export const JOURNEY_CHAPTER_COUNT = JOURNEY_CHAPTER_NAMES.length;

export type JourneyChapterStatus = 'past' | 'current' | 'future';

export interface JourneyChapter {
  index: number;
  name: string;
  status: JourneyChapterStatus;
  // 该章节内的子进度，[0, 100]。past=100，future=0，current 按比例计算。
  progressInChapter: number;
}

export interface JourneyMapInput {
  estimatedScore: number;
  targetScore: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const computeJourneyMap = ({
  estimatedScore,
  targetScore,
}: JourneyMapInput): JourneyChapter[] => {
  const safeTarget = targetScore > 0 ? targetScore : 100;
  const ratio = clamp01(estimatedScore / safeTarget);
  const overallChapterPosition = ratio * JOURNEY_CHAPTER_COUNT; // 0..8

  // 当 ratio === 1（满分达成）时把当前章节钉在最后一章。
  const currentIndex = Math.min(
    JOURNEY_CHAPTER_COUNT - 1,
    Math.floor(overallChapterPosition),
  );
  const reachedFinal = ratio >= 1;

  return JOURNEY_CHAPTER_NAMES.map((name, index): JourneyChapter => {
    if (index < currentIndex) {
      return { index, name, status: 'past', progressInChapter: 100 };
    }
    if (index === currentIndex) {
      const sub = reachedFinal
        ? 100
        : Math.round((overallChapterPosition - currentIndex) * 100);
      return { index, name, status: 'current', progressInChapter: sub };
    }
    return { index, name, status: 'future', progressInChapter: 0 };
  });
};

export const findCurrentChapter = (chapters: JourneyChapter[]): JourneyChapter | undefined => (
  chapters.find((chapter) => chapter.status === 'current')
);
