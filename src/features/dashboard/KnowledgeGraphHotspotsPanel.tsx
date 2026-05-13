import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Network } from 'lucide-react';
import { computeGraphHotspots } from '../../../shared/graph-hotspots';
import MechanismLayerBadge from './MechanismLayerBadge';
import { layerStyle } from './mechanismLayers';

interface GraphSnapshotLite {
  nodes: Array<{ key: string; label: string; weight: number }>;
  edges: Array<{ source: string; target: string; weight: number }>;
}

interface KnowledgeGraphHotspotsPanelProps {
  snapshot?: GraphSnapshotLite | null;
  // 当 graph 为空时（新用户）的友好提示。
  emptyHint?: string;
}

const tone = layerStyle('rule');

// 把 graph-weaver-service 算出的 nodes/edges 第一次接到 UI。
// 视觉规则：归属规则层（青蓝），列出 top 4 节点的权重条 + 邻居计数 +
// 最强相邻 label 1-2 个。不画完整的力导向图（v0 阶段图谱可能稀疏，
// 完整渲染没有信息密度优势）。
const KnowledgeGraphHotspotsPanel: React.FC<KnowledgeGraphHotspotsPanelProps> = ({
  snapshot,
  emptyHint = '完成几次干预后，知识图谱会开始连成网。',
}) => {
  const view = useMemo(() => {
    if (!snapshot) return null;
    return computeGraphHotspots({ nodes: snapshot.nodes, edges: snapshot.edges, limit: 4 });
  }, [snapshot]);

  if (!view || view.totalNodes === 0) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, delay: 0.06 }}
        className="cloud-glass vl-surface relative rounded-[20px] px-3 py-2"
        style={{ borderColor: tone.soft }}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5" style={{ color: tone.ink }}>
              <Network size={13} />
              <p className="text-[10px] font-black uppercase tracking-[0.16em]">知识图谱热点</p>
            </div>
          </div>
          <MechanismLayerBadge layer="rule" subtitle="网络" />
        </div>
        <p className="mt-2 rounded-xl bg-white/70 px-2 py-1.5 text-[10px] leading-4 text-gray-500">
          {emptyHint}
        </p>
      </motion.section>
    );
  }

  const maxWeight = Math.max(...view.hotspots.map((h) => h.weight), 1);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: 0.06 }}
      className="cloud-glass vl-surface relative rounded-[20px] px-3 py-2"
      style={{ borderColor: tone.soft }}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5" style={{ color: tone.ink }}>
            <Network size={13} />
            <p className="text-[10px] font-black uppercase tracking-[0.16em]">知识图谱热点</p>
          </div>
          <div
            className="rounded-full px-2 py-0.5 text-[9px] font-black"
            style={{ background: tone.soft, color: tone.ink }}
          >
            {view.totalNodes} 节点 · {view.totalEdges} 边
          </div>
        </div>
        <MechanismLayerBadge layer="rule" subtitle="网络" />
      </div>

      <div className="mt-1.5 flex flex-col gap-1.5">
        {view.hotspots.map((hotspot) => {
          const widthPercent = Math.max(8, Math.round((hotspot.weight / maxWeight) * 100));
          return (
            <div
              key={hotspot.key}
              className="rounded-xl border bg-white/85 px-2 py-1.5"
              style={{ borderColor: tone.soft }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[11px] font-black leading-tight text-[#1a1a2e]">
                  {hotspot.label}
                </p>
                <span
                  className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black"
                  style={{ background: tone.soft, color: tone.ink }}
                >
                  权重 {hotspot.weight}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[rgba(0,0,0,0.06)]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${widthPercent}%` }}
                  transition={{ duration: 0.6, ease: [0.32, 0.72, 0.24, 1] }}
                  className="h-full rounded-full"
                  style={{ background: tone.strong }}
                />
              </div>
              <div className="mt-1 flex items-center gap-1 text-[9px] font-bold text-gray-500">
                <span>↔ {hotspot.neighborCount} 个相邻</span>
                {hotspot.topNeighborLabels.length > 0 ? (
                  <>
                    <span className="text-gray-300">·</span>
                    <div className="flex items-center gap-1 truncate">
                      {hotspot.topNeighborLabels.map((label, index) => (
                        <span
                          key={`${hotspot.key}-${index}-${label}`}
                          className="rounded-full px-1.5 py-0.5"
                          style={{ background: tone.soft, color: tone.ink }}
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
};

export default KnowledgeGraphHotspotsPanel;
