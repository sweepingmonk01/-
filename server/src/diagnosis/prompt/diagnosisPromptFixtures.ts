import type {
  DiagnosisPromptInput,
  ParsedDiagnosisModelOutput,
} from './diagnosisPromptTypes.js';

export const diagnosisPromptInputFixture: DiagnosisPromptInput = {
  request: {
    questionText: '阅读题没有结合上下文，误选了表面意思。',
    studentAnswer: 'B',
    correctAnswer: 'C',
    subject: 'en',
    grade: '四年级',
    painPoint: '语境判断失败',
    rule: '先看上下文，再判断主旨',
  },
  context: {
    learningProfile: {
      worldModelIndex: 0.4,
      mindModelIndex: 0.42,
      meaningModelIndex: 0.35,
      actionMechanismIndex: 0.28,
      activeStructuralIntelligence: 0.45,
      dominantWeakness: 'meaning',
      stage: 'forming',
    },
    availableExploreNodes: [
      {
        nodeKey: 'language.context',
        engineKey: 'language',
        label: '语境判断',
        summary: '把词句放回上下文中判断意义。',
      },
      {
        nodeKey: 'game.feedback_loop',
        engineKey: 'game',
        label: '反馈回路',
        summary: '用反馈检查答案是否解释题目目标。',
      },
    ],
  },
};

export const diagnosisPromptOutputFixture: ParsedDiagnosisModelOutput = {
  mistakeKey: 'context_misread',
  confidence: 0.86,
  summary: '这道题主要错在没有结合上下文判断语义。',
  fourLayerExplanation: {
    curriculum: '阅读题需要结合上下文，而不是只看单句表面意思。',
    worldEngine: '信息需要放回整体结构中判断，局部句子不能脱离上下文。',
    mindEngine: '注意力被表面词吸引，缺少回看上下文的步骤。',
    meaningEngine: '意义来自语境关系，而不是孤立词义。',
    gameMechanism: '修复方式是建立“先定位语境，再判断选项”的反馈回路。',
  },
  recommendedExploreNodes: {
    primaryNodeKey: 'language.context',
    secondaryNodeKeys: ['language.meaning', 'game.feedback_loop'],
  },
  repairAction: '重读题目前后两句，标出决定答案的语境线索。',
  yufengSuggestion: '先完成 language.context 节点，提交一条探索证据，再保存御风快照。',
};
