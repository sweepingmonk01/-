// 知识图谱热点投影。
//
// 把 graph-weaver-service 已经在算的 nodes/edges 转化为 dashboard 可消费的
// 紧凑列表：top N 节点 + 邻居计数 + 最强相邻 label。这是把"图谱"从
// 后端能力第一次接到 UI 的最小动作。
//
// 设计约束：
// - 不渲染完整 SVG 图谱（屏幕太小，且 v0 阶段图本身可能稀疏不连通）
// - 只渲染"哪些节点最热 + 它们和谁相连"，回答"我现在的知识聚集在哪里"
// - 输出不可变快照，便于在前端无副作用消费

interface RawNode {
  key: string;
  label: string;
  weight: number;
}

interface RawEdge {
  source: string;
  target: string;
  weight: number;
}

export interface GraphHotspotEntry {
  key: string;
  label: string;
  weight: number;
  neighborCount: number;
  // 该节点最强的 1-2 条相邻边对端 label，按 edge.weight 降序。
  topNeighborLabels: string[];
}

export interface GraphHotspotsView {
  totalNodes: number;
  totalEdges: number;
  hotspots: GraphHotspotEntry[];
}

const DEFAULT_TOP_N = 4;
const DEFAULT_TOP_NEIGHBORS = 2;

interface ComputeGraphHotspotsInput {
  nodes: RawNode[];
  edges: RawEdge[];
  limit?: number;
  topNeighbors?: number;
}

export const computeGraphHotspots = ({
  nodes,
  edges,
  limit = DEFAULT_TOP_N,
  topNeighbors = DEFAULT_TOP_NEIGHBORS,
}: ComputeGraphHotspotsInput): GraphHotspotsView => {
  if (!nodes.length) {
    return { totalNodes: 0, totalEdges: edges.length, hotspots: [] };
  }

  const labelByKey = new Map(nodes.map((node) => [node.key, node.label]));

  const neighborsByKey = new Map<string, Array<{ otherKey: string; weight: number }>>();
  for (const edge of edges) {
    if (edge.source === edge.target) continue;
    const sourceList = neighborsByKey.get(edge.source) ?? [];
    sourceList.push({ otherKey: edge.target, weight: edge.weight });
    neighborsByKey.set(edge.source, sourceList);
    const targetList = neighborsByKey.get(edge.target) ?? [];
    targetList.push({ otherKey: edge.source, weight: edge.weight });
    neighborsByKey.set(edge.target, targetList);
  }

  const hotspots = [...nodes]
    .sort((left, right) => right.weight - left.weight)
    .slice(0, limit)
    .map((node): GraphHotspotEntry => {
      const neighbors = neighborsByKey.get(node.key) ?? [];
      const topNeighborLabels = [...neighbors]
        .sort((left, right) => right.weight - left.weight)
        .slice(0, topNeighbors)
        .map((entry) => labelByKey.get(entry.otherKey) ?? entry.otherKey);
      return {
        key: node.key,
        label: node.label,
        weight: node.weight,
        neighborCount: neighbors.length,
        topNeighborLabels,
      };
    });

  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    hotspots,
  };
};
