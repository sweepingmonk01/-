import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Network } from 'lucide-react';
import { computeMasteryLevel, masteryLevelLabel } from '../../../shared/mastery';
import { computeGraphHotspots } from '../../../shared/graph-hotspots';
import { linkAllMasteryToGraph } from '../../../shared/mastery-graph-link';
import type { DashboardMasteryNode } from '../../../shared/dashboard-metrics';
import MechanismLayerBadge from './MechanismLayerBadge';
import { layerStyle } from './mechanismLayers';

interface GraphSnapshotLite {
  nodes: Array<{ key: string; label: string; weight: number }>;
  edges: Array<{ source: string; target: string; weight: number }>;
}

interface GrowthLayerPanelProps {
  nodes?: DashboardMasteryNode[];
  // 当 nodes 为空时（新用户），渲染一段提示文案而不是空盒子。
  emptyHint?: string;
  // 若提供，会把 mastery 行与图谱节点做朴素 substring 匹配，命中时
  // 在该行显示"↔ N 邻居"角标，让规则层与成长层在视觉上互相指认。
  graphSnapshot?: GraphSnapshotLite | null;
}

const tone = layerStyle('growth');
const ruleTone = layerStyle('rule');

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
  graphSnapshot,
}) => {
  const visibleNodes = (nodes ?? []).slice(0, 4);

  // 同步把 graphSnapshot 投影成 hotspots，再让 mastery 行去匹配。
  // 不在父组件提前算是为了让 GrowthLayerPanel 能独立消费 graphSnapshot
  // 的原始结构（与 KnowledgeGraphHotspotsPanel 解耦）。
  const enrichedNodes = useMemo(() => {
    if (!graphSnapshot || visibleNodes.length === 0) return visibleNodes;
    const view = computeGraphHotspots({
      nodes: graphSnapshot.nodes,
      edges: graphSnapshot.edges,
      // 取更宽的池来提升 mastery 命中率（不只是 dashboard 上展示的 top 4）。
      limit: 20,
    });
    return linkAllMasteryToGraph(visibleNodes, view.hotspots);
  }, [graphSnapshot, visibleNodes]);

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
          {enrichedNodes.map((node) => {
            const level = computeMasteryLevel(node.score);
            const isCapped = level.level === 5;
            const link = (node as { graphLink?: { graphNodeLabel: string; neighborCount: number } }).graphLink;
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
                  <div className="flex shrink-0 items-center gap-1">
                    {link ? (
                      <span
                        className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-black"
                        style={{ background: ruleTone.soft, color: ruleTone.ink }}
                        title={`图谱节点：${link.graphNodeLabel}`}
                      >
                        <Network size={9} />
                        ↔ {link.neighborCount}
                      </span>
                    ) : null}
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-black"
                      style={{ background: tone.soft, color: tone.ink }}
                    >
                      {masteryLevelLabel(level.level)}
                    </span>
                  </div>
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
