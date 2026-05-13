import React from 'react';
import { motion } from 'motion/react';
import { CalendarDays } from 'lucide-react';
import type { WeeklyRhythm } from '../../../shared/weekly-rhythm';
import MechanismLayerBadge from './MechanismLayerBadge';
import { layerStyle } from './mechanismLayers';

interface OpsLayerCalendarProps {
  rhythm?: WeeklyRhythm;
}

const tone = layerStyle('ops');

// 运营层最小化日历卡。明确反 LiveOps 反模式：
// - 没有日推送，没有赛季活动
// - 没有"连续登录奖励"或限时压力
// - 只回答两个事实：今天是周几 / 本周完成了多少
//
// 视觉：7 个小方块（一/二/三/四/五/六/日），今日高亮为 ops 紫电色，
// 已完成日子按 cycle 数染深，未来日子保持低饱和。
const OpsLayerCalendar: React.FC<OpsLayerCalendarProps> = ({ rhythm }) => {
  if (!rhythm) {
    return null;
  }

  const progressPercent = rhythm.weekTarget > 0
    ? Math.min(100, Math.round((rhythm.weekTotal / rhythm.weekTarget) * 100))
    : 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: 0.08 }}
      className="cloud-glass vl-surface relative rounded-[20px] px-3 py-2"
      style={{ borderColor: tone.soft }}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5" style={{ color: tone.ink }}>
            <CalendarDays size={13} />
            <p className="text-[10px] font-black uppercase tracking-[0.16em]">本周节奏</p>
          </div>
          <div
            className="rounded-full px-2 py-0.5 text-[9px] font-black"
            style={{ background: tone.soft, color: tone.ink }}
          >
            {rhythm.weekTotal} / {rhythm.weekTarget} cycle
          </div>
        </div>
        <MechanismLayerBadge layer="ops" subtitle="长回路" />
      </div>

      <div className="mt-1.5 grid grid-cols-7 gap-1">
        {rhythm.days.map((day) => {
          const intensity = day.completedCycles >= 3
            ? 1
            : day.completedCycles > 0
            ? 0.7
            : 0;
          const isFuture = day.isFuture && !day.isToday;
          const background = day.isToday
            ? tone.strong
            : intensity > 0
            ? `color-mix(in srgb, ${tone.strong} ${Math.round(intensity * 60)}%, white)`
            : isFuture
            ? 'rgba(0,0,0,0.04)'
            : 'rgba(0,0,0,0.06)';
          const textColor = day.isToday
            ? '#ffffff'
            : intensity > 0
            ? tone.ink
            : 'rgba(0,0,0,0.45)';

          return (
            <motion.div
              key={day.dateISO}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.28 }}
              className="flex flex-col items-center justify-center rounded-md py-1 text-center"
              style={{
                background,
                color: textColor,
                opacity: isFuture ? 0.55 : 1,
                boxShadow: day.isToday ? `0 4px 10px ${tone.soft}` : 'none',
              }}
            >
              <span className="text-[8px] font-bold uppercase tracking-[0.12em]">
                {day.dayLabel}
              </span>
              <span className="text-[12px] font-black leading-none">
                {day.completedCycles > 0 ? day.completedCycles : isFuture ? '·' : '0'}
              </span>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[10px] font-bold text-gray-500">
        <span>
          {rhythm.streakDays > 0 ? `连续 ${rhythm.streakDays} 天有 cycle` : '今天还没开始'}
        </span>
        <span>
          周节奏 {progressPercent}%
        </span>
      </div>
    </motion.section>
  );
};

export default OpsLayerCalendar;
