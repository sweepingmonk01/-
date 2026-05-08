import React from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { computeMasteryLevel, masteryLevelLabel } from '../../../shared/mastery';
import type { DashboardMasteryNode } from '../../../shared/dashboard-metrics';
import MechanismLayerBadge from './MechanismLayerBadge';
import { layerStyle } from './mechanismLayers';

interface GrowthLayerPanelProps {
  nodes?: DashboardMasteryNode[];
  // 当 nodes 为空时（新用户），渲染一段提示文案而不是空盒子。
  emptyHint?: string;
}

const tone = layerStyle('growth');

// 成长层（game-topology 第 4 节）的最小可见产物：
// 把 mastery.score 投影成 Lv.1-5 + 经验条，让"我变厉害了"从一个内部数字
// 变成学生能直接看到的可视化反馈。
//
// 显示规则：
// - 取 top 3-4 个节点（来自后端按证据强度排序的结果）。
// - 每个节点一行，显示 label / Lv.N / 经验条 / 距离下一级。
// - 节点 Lv.5 时不再显示距离（已封顶）。
// - 经验条颜色统一用 growth strong（金黄），不允许私自换色。
const GrowthLayerPanel: React.FC<GrowthLayerPanelProps> = ({
  nodes,
  emptyHint = '完成几次干预后，这里会显示你正在练成的能力树。',
}) => {
  const visibleNodes = (nodes ?? []).slice(0, 4);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: 0.05 }}
      className="cloud-glass vl-surface relative rounded-[20px] px-3 py-2"
      style={{ borderColor: tone.soft }}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5" style={{ color: tone.ink }}>
            <Sparkles size={13} />
            <p className="text-[10px] font-black uppercase tracking-[0.16em]">能力树</p>
          </div>
          {visibleNodes.length > 0 ? (
            <div
              className="rounded-full px-2 py-0.5 text-[9px] font-black"
              style={{ background: tone.soft, color: tone.ink }}
            >
              {visibleNodes.length} 项追踪
            </div>
          ) : null}
        </div>
        <MechanismLayerBadge layer="growth" />
      </div>

      {visibleNodes.length === 0 ? (
        <p className="mt-2 rounded-xl bg-white/70 px-2 py-1.5 text-[10px] leading-4 text-gray-500">
          {emptyHint}
        </p>
      ) : (
        <div className="mt-1.5 flex flex-col gap-1.5">
          {visibleNodes.map((node) => {
            const level = computeMasteryLevel(node.score);
            const isCapped = level.level === 5;
            return (
              <div
                key={node.key}
                className="rounded-xl border bg-white/85 px-2 py-1.5"
                style={{ borderColor: tone.soft }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[11px] font-black leading-tight text-[#1a1a2e]">
                    {node.label}
                  </p>
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black"
                    style={{ background: tone.soft, color: tone.ink }}
                  >
                    {masteryLevelLabel(level.level)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[rgba(0,0,0,0.06)]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${level.percentInLevel}%` }}
                    transition={{ duration: 0.6, ease: [0.32, 0.72, 0.24, 1] }}
                    className="h-full rounded-full"
                    style={{ background: tone.strong }}
                  />
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-1 text-[9px] font-bold text-gray-500">
                  <span>掌握 {node.score} · 信度 {node.confidence.toFixed(2)}</span>
                  <span>
                    {isCapped ? '已封顶' : `距下一级 ${level.toNextLevel} 分`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.section>
  );
};

export default GrowthLayerPanel;
