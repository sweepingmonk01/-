// 把 mastery 节点（成长层）与 knowledge graph 节点（规则层）关联起来。
//
// 为什么需要这个：
// 现在 dashboard 上"能力树"和"知识图谱热点"是两张独立的卡，学生看到的是
// 两套词汇。这个 helper 让它们第一次互相指认——
// 当 mastery 行 "几何辅助线选择失误" 命中图谱节点 "中点" 时，
// 在能力树行上挂一个 "↔ 4 邻居" 角标，告诉学生"这条能力对应的图谱热点"。
//
// 设计约束：
// - 纯函数，无副作用，可单测
// - 仅做最朴素的双向 substring 匹配（normalize 大小写 + 去空白）
// - 不引入语义检索（v0 不值得）；后续如果 mastery key 改成 entity-based，
//   可以平替为精确 key 匹配
// - 当多个 graph 节点都匹配同一条 mastery 时，取 weight 最高的

export interface MasteryRowLite {
  label: string;
}

export interface GraphHotspotLite {
  key: string;
  label: string;
  weight: number;
  neighborCount: number;
  topNeighborLabels: string[];
}

export interface MasteryGraphLink {
  graphNodeKey: string;
  graphNodeLabel: string;
  neighborCount: number;
  topNeighborLabels: string[];
}

const normalize = (text: string): string => text.replace(/\s+/g, '').toLowerCase();

// 中文标签下，graph 实体提取经常会拆出"中点"插在"几何"和"辅助线"之间，
// 导致 mastery 的"几何辅助线"无法直接 substring 匹配 "几何中点辅助线选择失误"。
// 这里加一个 longest-common-substring 回退：只要两个 normalized 串
// 共享一段长度 ≥ MIN_OVERLAP 的子串就算命中。
const MIN_OVERLAP = 3;

const longestCommonSubstringLength = (a: string, b: string): number => {
  if (!a || !b) return 0;
  // 经典 DP，O(|a|·|b|) — 对 ≤ 40 字符的标签足够。
  const rows = a.length;
  const cols = b.length;
  const previous = new Array(cols + 1).fill(0);
  const current = new Array(cols + 1).fill(0);
  let best = 0;
  for (let i = 1; i <= rows; i += 1) {
    for (let j = 1; j <= cols; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        current[j] = previous[j - 1] + 1;
        if (current[j] > best) best = current[j];
      } else {
        current[j] = 0;
      }
    }
    for (let j = 0; j <= cols; j += 1) previous[j] = current[j];
  }
  return best;
};

interface MatchScore {
  hotspot: GraphHotspotLite;
  score: number;
}

export const linkMasteryToGraph = (
  mastery: MasteryRowLite,
  hotspots: GraphHotspotLite[],
): MasteryGraphLink | null => {
  if (!mastery.label || hotspots.length === 0) return null;
  const masteryNorm = normalize(mastery.label);
  if (!masteryNorm) return null;

  // 命中分数：完全相等 100；单向 substring 80；最长公共子串 ≥3 时 = 子串长度 × 10。
  // 这样保证完全匹配 > substring > LCS-fallback，且 LCS 长子串胜过短子串。
  const candidates: MatchScore[] = [];
  for (const hotspot of hotspots) {
    const nodeNorm = normalize(hotspot.label);
    if (!nodeNorm) continue;

    let score = 0;
    if (masteryNorm === nodeNorm) {
      score = 100;
    } else if (masteryNorm.includes(nodeNorm) || nodeNorm.includes(masteryNorm)) {
      score = 80;
    } else {
      const lcs = longestCommonSubstringLength(masteryNorm, nodeNorm);
      if (lcs >= MIN_OVERLAP) score = lcs * 10;
    }
    if (score > 0) candidates.push({ hotspot, score });
  }

  if (candidates.length === 0) return null;

  // 主排序：score 降序；次排序：图节点 weight 降序，确保多个并列时取更"热"的。
  candidates.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return right.hotspot.weight - left.hotspot.weight;
  });

  const best = candidates[0].hotspot;
  return {
    graphNodeKey: best.key,
    graphNodeLabel: best.label,
    neighborCount: best.neighborCount,
    topNeighborLabels: best.topNeighborLabels,
  };
};

export const linkAllMasteryToGraph = <T extends MasteryRowLite>(
  masteryNodes: T[],
  hotspots: GraphHotspotLite[],
): Array<T & { graphLink?: MasteryGraphLink }> => (
  masteryNodes.map((node) => {
    const link = linkMasteryToGraph(node, hotspots);
    return link ? { ...node, graphLink: link } : node;
  })
);
