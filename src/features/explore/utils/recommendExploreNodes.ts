import { mistakeExploreMap, type MistakePatternKey } from '../data/mistakeExploreMap';
import { exploreNodes, type ExploreNode } from '../data/exploreData';

export interface ExploreNodeRecommendation {
  mapping: (typeof mistakeExploreMap)[number] | null;
  primaryNode: ExploreNode | null;
  secondaryNodes: ExploreNode[];
}

export interface MistakeSignalInput {
  mistakeKey?: string | null;
  mistakeCategory?: string | null;
  diagnosedMistakes?: Array<{ key?: string; label?: string; category?: string } | string> | null;
  subject?: string | null;
  node?: string | null;
  painPoint?: string | null;
  rule?: string | null;
  questionText?: string | null;
  summary?: string | null;
}

const isMistakePatternKey = (value: string): value is MistakePatternKey => (
  mistakeExploreMap.some((item) => item.mistakeKey === value)
);

const compactSignal = (value: unknown) => (
  typeof value === 'string' ? value.trim().toLowerCase() : ''
);

export function inferMistakePatternKey(input: MistakeSignalInput): MistakePatternKey {
  const explicitKey = compactSignal(input.mistakeKey);
  if (explicitKey && isMistakePatternKey(explicitKey)) return explicitKey;

  const diagnosedText = (input.diagnosedMistakes ?? [])
    .map((item) => (typeof item === 'string' ? item : [item.key, item.label, item.category].filter(Boolean).join(' ')))
    .join(' ');
  const corpus = [
    input.mistakeCategory,
    input.subject,
    input.node,
    input.painPoint,
    input.rule,
    input.questionText,
    input.summary,
    diagnosedText,
  ]
    .map(compactSignal)
    .filter(Boolean)
    .join(' ');

  if (!corpus) return 'unknown';

  if (/反复|重复|同类|习惯|固定错误|again|repeat/.test(corpus)) return 'repeated_same_mistake';
  if (/反馈|不知道.*为什么|只知道错|修复|闭环|feedback/.test(corpus)) return 'feedback_loop_broken';
  if (/守恒|等量|平衡|配平|总量|不变|conservation|equation|等式/.test(corpus)) return 'conservation_missing';
  if (/主旨|意图|深层|观点|立意|meaning|misunderstanding|以偏概全|字面/.test(corpus)) return 'meaning_misunderstanding';
  if (/语境|上下文|场景|材料|作者|人物|时间|地点|context|阅读/.test(corpus)) return 'context_misread';
  if (/规则|公式|题型|语法|运算|条件|rule|mismatch|recall|套错/.test(corpus)) return 'rule_mismatch';
  if (/注意|干扰|焦虑|粗心|审题|careless|distract|遗漏|漏看/.test(corpus)) return 'attention_distracted';
  if (/记忆|条件多|步骤|超载|working memory|overload|执行|步骤遗漏/.test(corpus)) return 'working_memory_overload';

  return 'unknown';
}

export function recommendExploreNodes(mistakeKey: MistakePatternKey): ExploreNodeRecommendation {
  const mapping =
    mistakeExploreMap.find((item) => item.mistakeKey === mistakeKey) ??
    mistakeExploreMap.find((item) => item.mistakeKey === 'unknown') ??
    null;

  if (!mapping) {
    return {
      mapping: null,
      primaryNode: null,
      secondaryNodes: [],
    };
  }

  const primaryNode = exploreNodes.find((node) => node.key === mapping.primaryNodeKey) ?? null;
  const secondaryNodes = mapping.secondaryNodeKeys
    .map((key) => exploreNodes.find((node) => node.key === key))
    .filter((node): node is ExploreNode => Boolean(node));

  return {
    mapping,
    primaryNode,
    secondaryNodes,
  };
}

export function recommendExploreNodesForMistake(input: MistakeSignalInput): ExploreNodeRecommendation & {
  mistakeKey: MistakePatternKey;
} {
  const mistakeKey = inferMistakePatternKey(input);
  return {
    mistakeKey,
    ...recommendExploreNodes(mistakeKey),
  };
}
