// 六层机制语义模型（Game-Topology 启发的信息架构）。
//
// 为什么需要这一层：
// 之前 Dashboard 上每张卡片各自挑颜色，导致"视觉语言每个模块不同"。
// 把六大机制（目标 / 规则 / 反馈 / 成长 / 社交 / 运营）显式化之后，
// 每张卡片都先声明 "我属于哪一层"，颜色从对应的 token 取——
// 这把"颜色一致性"问题从设计师手感转成了信息架构约束。
//
// 不要在这之外私自加颜色。任何新卡片都先回答 layer 是什么。

export type MechanismLayerKey =
  | 'goal'
  | 'rule'
  | 'feedback'
  | 'growth'
  | 'social'
  | 'ops';

export interface MechanismLayerMeta {
  key: MechanismLayerKey;
  label: string;
  shortLabel: string;
  description: string;
  // 机制时间尺度。短回路 ≈ 一次干预；长回路 ≈ 周/学期。
  loop: 'short' | 'long' | 'mixed';
  // CSS 变量名，对应 src/styles/tokens.css 中的 --vl-mech-<key>-{strong,soft,ink}。
  cssVarKey: string;
}

export const MECHANISM_LAYERS: Record<MechanismLayerKey, MechanismLayerMeta> = {
  goal: {
    key: 'goal',
    label: '目标层',
    shortLabel: '目标',
    description: '清晰的分数/章节/段位目标与剩余距离。',
    loop: 'long',
    cssVarKey: 'goal',
  },
  rule: {
    key: 'rule',
    label: '规则层',
    shortLabel: '规则',
    description: 'AI Active 内核三轴、调度策略、规则信号。',
    loop: 'short',
    cssVarKey: 'rule',
  },
  feedback: {
    key: 'feedback',
    label: '反馈层',
    shortLabel: '反馈',
    description: '一次干预的 effectScore 与 kernel 前后对比。',
    loop: 'short',
    cssVarKey: 'feedback',
  },
  growth: {
    key: 'growth',
    label: '成长层',
    shortLabel: '成长',
    description: '知识节点等级、累计 cycle、长期 mastery。',
    loop: 'long',
    cssVarKey: 'growth',
  },
  social: {
    key: 'social',
    label: '社交层',
    shortLabel: '社交',
    description: '同伴对照、协作探索、UGC 流量。当前阶段为占位。',
    loop: 'mixed',
    cssVarKey: 'social',
  },
  ops: {
    key: 'ops',
    label: '运营层',
    shortLabel: '运营',
    description: '日历、周节奏、活动事件、版本迭代。',
    loop: 'mixed',
    cssVarKey: 'ops',
  },
};

export const layerStyle = (key: MechanismLayerKey) => {
  const css = MECHANISM_LAYERS[key].cssVarKey;
  return {
    strong: `var(--vl-mech-${css}-strong)`,
    soft: `var(--vl-mech-${css}-soft)`,
    ink: `var(--vl-mech-${css}-ink)`,
  } as const;
};
