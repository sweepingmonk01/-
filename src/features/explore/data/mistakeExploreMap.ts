export type MistakePatternKey =
  | 'careless_reading'
  | 'context_misread'
  | 'rule_mismatch'
  | 'working_memory_overload'
  | 'meaning_misunderstanding'
  | 'conservation_missing'
  | 'feedback_loop_broken'
  | 'repeated_same_mistake'
  | 'attention_distracted'
  | 'unknown';

export interface MistakeExploreMapping {
  mistakeKey: MistakePatternKey;
  title: string;
  description: string;
  primaryNodeKey: string;
  secondaryNodeKeys: string[];
  repairAction: string;
}

export const mistakeExploreMap: MistakeExploreMapping[] = [
  {
    mistakeKey: 'careless_reading',
    title: '审题粗心',
    description: '学生没有稳定提取题干中的限制条件、关键词或问题目标。',
    primaryNodeKey: 'neuroscience.cognition_consciousness',
    secondaryNodeKeys: ['language.context', 'game.state_space'],
    repairAction: '先圈出题目真正问什么，再标记每个条件是否已经使用。',
  },
  {
    mistakeKey: 'context_misread',
    title: '语境判断失败',
    description: '学生脱离上下文理解题目、句子或材料。',
    primaryNodeKey: 'language.context',
    secondaryNodeKeys: [
      'neuroscience.cognition_consciousness',
      'game.feedback_loop',
    ],
    repairAction: '先圈出人物、时间、场景、目的，再重新判断题意。',
  },
  {
    mistakeKey: 'rule_mismatch',
    title: '规则识别错误',
    description: '学生没有识别这道题应该使用哪套规则。',
    primaryNodeKey: 'language.rules',
    secondaryNodeKeys: [
      'physics.symmetry_conservation',
      'game.rule_layer',
    ],
    repairAction: '先判断题型和规则，再开始计算或作答。',
  },
  {
    mistakeKey: 'working_memory_overload',
    title: '工作记忆超载',
    description: '题目条件较多，学生在处理过程中遗漏条件。',
    primaryNodeKey: 'neuroscience.cognition_consciousness',
    secondaryNodeKeys: [
      'language.rules',
      'game.state_space',
    ],
    repairAction: '把题干条件拆成列表，逐项标记已使用和未使用。',
  },
  {
    mistakeKey: 'meaning_misunderstanding',
    title: '意义层理解错误',
    description: '学生只理解了字面信息，没有抓住主旨、意图或深层意义。',
    primaryNodeKey: 'language.meaning',
    secondaryNodeKeys: [
      'physics.thermo_stat',
      'game.growth_layer',
    ],
    repairAction: '区分“发生了什么”和“真正想表达什么”。',
  },
  {
    mistakeKey: 'conservation_missing',
    title: '守恒关系缺失',
    description: '学生没有识别总量、平衡、等式或约束关系。',
    primaryNodeKey: 'physics.symmetry_conservation',
    secondaryNodeKeys: [
      'language.rules',
      'game.rule_layer',
    ],
    repairAction: '先找出题目中不变的量，再建立等量关系。',
  },
  {
    mistakeKey: 'feedback_loop_broken',
    title: '反馈回路断裂',
    description: '学生知道错了，但没有理解为什么错，也没有形成修复动作。',
    primaryNodeKey: 'game.feedback_loop',
    secondaryNodeKeys: [
      'neuroscience.learning_memory',
      'language.rules',
    ],
    repairAction: '把错题改写成“错因 + 修复动作 + 同类题训练”。',
  },
  {
    mistakeKey: 'repeated_same_mistake',
    title: '同类错误反复出现',
    description: '学生反复犯同一类错误，说明错误回路被强化。',
    primaryNodeKey: 'neuroscience.circuit',
    secondaryNodeKeys: [
      'game.core_formula',
      'game.feedback_loop',
    ],
    repairAction: '重排学习回路：目标 -> 行动 -> 反馈 -> 修复 -> 成长。',
  },
  {
    mistakeKey: 'attention_distracted',
    title: '注意力被干扰项吸引',
    description: '学生被表面信息、干扰选项或无关细节带偏。',
    primaryNodeKey: 'neuroscience.cognition_consciousness',
    secondaryNodeKeys: [
      'language.context',
      'game.state_space',
    ],
    repairAction: '先圈出决定答案的关键信号，再排除干扰信息。',
  },
  {
    mistakeKey: 'unknown',
    title: '错因待澄清',
    description: '当前错题还没有足够诊断信息，先进入反馈回路建立可修复结构。',
    primaryNodeKey: 'game.feedback_loop',
    secondaryNodeKeys: [
      'language.rules',
      'neuroscience.cognition_consciousness',
    ],
    repairAction: '先补全“错在哪里、为什么错、下一步怎么修复”。',
  },
];
