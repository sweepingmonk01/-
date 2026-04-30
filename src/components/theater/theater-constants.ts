export const SELECT_ACTION_OPTIONS = [
  { id: 'rule-first', label: '先触发规则动作', result: 'aligned' as const },
  { id: 'partial-rule', label: '想到一点规则，但步骤不稳', result: 'partial' as const },
  { id: 'guess-first', label: '先猜答案再补理由', result: 'guess' as const },
];

export const SEQUENCE_ACTION_STEPS = ['识别关键条件', '触发核心规则', '确认最终答案'];

export const DRAW_ACTION_CHECKPOINTS = ['锁定关键点', '连接正确路径', '复核动作结果'];
