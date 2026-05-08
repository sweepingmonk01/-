import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Compass, Flag } from 'lucide-react';
import {
  computeJourneyMap,
  findCurrentChapter,
  type JourneyChapter,
} from '../../../shared/journey-chapters';
import MechanismLayerBadge from './MechanismLayerBadge';
import { layerStyle } from './mechanismLayers';

interface JourneyMapPanelProps {
  estimatedScore: number;
  targetScore: number;
}

const tone = layerStyle('goal');

// 目标层叙事化升级：8 章节东方探索地图（起航/入山/渡河/越岭/登顶/望远/凯旋/御风）。
// 每个章节渲染成一个里程点，状态映射成视觉：
// - past：实心金黄圆点 + 折线连接段填满
// - current：双圈高亮 + 折线段按子进度填充
// - future：空心淡色圆点 + 折线段为虚线
//
// 这一层的目的是把"目标进度"从一根冷条形升级为"我在第几章"的空间感受，
// 对应 game-topology 第 6 节"清晰目标 + 深度成长"。
const JourneyMapPanel: React.FC<JourneyMapPanelProps> = ({
  estimatedScore,
  targetScore,
}) => {
  const chapters = useMemo(
    () => computeJourneyMap({ estimatedScore, targetScore }),
    [estimatedScore, targetScore],
  );
  const current = findCurrentChapter(chapters);
  const currentIndex = current ? current.index : 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36 }}
      className="cloud-glass vl-surface relative rounded-[20px] px-3 py-2"
      style={{ borderColor: tone.soft }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5" style={{ color: tone.ink }}>
          <Compass size={13} />
          <p className="text-[10px] font-black uppercase tracking-[0.16em]">远征地图</p>
        </div>
        <div className="flex items-center gap-1.5">
          <MechanismLayerBadge layer="goal" subtitle="长回路" />
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-black"
            style={{ background: tone.soft, color: tone.ink }}
          >
            目标 {targetScore} 分
          </span>
        </div>
      </div>

      <div className="mt-2 flex items-center">
        {chapters.map((chapter, index) => {
          const isLast = index === chapters.length - 1;
          return (
            <ChapterMilestone
              key={chapter.index}
              chapter={chapter}
              currentIndex={currentIndex}
              isLast={isLast}
            />
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 rounded-xl px-2 py-1.5"
        style={{ background: tone.soft }}
      >
        <div className="flex items-center gap-1.5" style={{ color: tone.ink }}>
          <Flag size={11} />
          <span className="text-[10px] font-black tracking-[0.06em]">
            当前章节：{current?.name ?? '起航'}
          </span>
        </div>
        <span className="text-[10px] font-bold" style={{ color: tone.ink }}>
          章内 {current?.progressInChapter ?? 0}%
        </span>
      </div>
    </motion.section>
  );
};

const ChapterMilestone: React.FC<{
  chapter: JourneyChapter;
  currentIndex: number;
  isLast: boolean;
}> = ({ chapter, currentIndex, isLast }) => {
  const isCurrent = chapter.status === 'current';
  const isPast = chapter.status === 'past';
  const isFuture = chapter.status === 'future';
  const dotSize = isCurrent ? 14 : 10;
  const dotColor = isPast || isCurrent ? tone.strong : 'rgba(0,0,0,0.18)';
  const dotBackground = isCurrent ? '#fff' : dotColor;
  const dotBorderWidth = isCurrent ? 3 : 0;
  const dotShadow = isCurrent ? `0 0 0 4px ${tone.soft}` : 'none';

  return (
    <div className="flex flex-1 flex-col items-center" style={{ minWidth: 0 }}>
      <div className="flex w-full items-center">
        {/* 左半连线（首章不画） */}
        {chapter.index === 0 ? (
          <div className="h-px flex-1" />
        ) : (
          <div className="h-px flex-1"
            style={{
              background: chapter.index <= currentIndex ? tone.strong : 'rgba(0,0,0,0.12)',
            }}
          />
        )}
        <div
          className="rounded-full"
          style={{
            width: dotSize,
            height: dotSize,
            background: dotBackground,
            border: `${dotBorderWidth}px solid ${tone.strong}`,
            boxShadow: dotShadow,
          }}
        />
        {/* 右半连线（末章不画） */}
        {isLast ? (
          <div className="h-px flex-1" />
        ) : (
          <div className="h-px flex-1"
            style={{
              background: chapter.index < currentIndex ? tone.strong : 'rgba(0,0,0,0.12)',
            }}
          />
        )}
      </div>
      <span
        className="mt-1 text-[8px] font-black tracking-[0.06em]"
        style={{
          color: isCurrent ? tone.ink : isPast ? tone.ink : 'rgba(0,0,0,0.4)',
          opacity: isFuture ? 0.6 : 1,
        }}
      >
        {chapter.name}
      </span>
    </div>
  );
};

export default JourneyMapPanel;
