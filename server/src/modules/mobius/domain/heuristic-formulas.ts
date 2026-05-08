// 启发式公式可证伪标签注册表。
//
// 这里登记的所有公式都是 v0 工程估值，目的不是把它们变成"永久内核"，
// 而是把它们锁死在临时状态下，避免被无意识地视为已经验证的产品逻辑。
//
// 每条 tag 必须显式回答三件事：
// 1. describes：这条公式实际在算什么
// 2. replacementTrigger：什么条件下必须被替换
// 3. replacementApproach：替换的目标方法（占位即可，可在路线图里细化）
//
// 当 review PR 时，遇到改动登记表中位置的代码，应当同时检查：
//   - 是否需要更新 describes
//   - 替换条件是否被绕过
//   - 是否有新的 v0 公式被引入但未登记

export interface HeuristicFormulaTag {
  id: string;
  location: string;
  describes: string;
  replacementTrigger: string;
  replacementApproach?: string;
}

export const HEURISTIC_FORMULA_REGISTRY: Record<string, HeuristicFormulaTag> = {
  'state-update.interaction-delta': {
    id: 'state-update.interaction-delta',
    location: 'server/src/modules/student-state/application/state-update-engine.ts:transitionInteractionState',
    describes: 'success/failure 对 kernel(time/snr/emotion) 与 execution(confidence/fatigue) 的固定增量',
    replacementTrigger: '累计 N=200 cycles 后；或前后状态向量的 effectScore 离散度超过 0.4',
    replacementApproach: '基于 effectScore 的多元线性回归得到加权增量',
  },
  'state-update.foundation-delta': {
    id: 'state-update.foundation-delta',
    location: 'server/src/modules/student-state/application/state-update-engine.ts:transitionFoundationExplorationState',
    describes: '基础科学探索成功/失败的 kernel/execution 固定增量；幅度比常规 interaction 弱',
    replacementTrigger: '基础科学路径累计 N=100 cycles 后',
    replacementApproach: '同上，但单独建模，避免和常规 interaction 混淆',
  },
  'state-update.mastery-evidence': {
    id: 'state-update.mastery-evidence',
    location: 'server/src/modules/student-state/application/state-update-engine.ts:applyMasteryEvidence',
    describes: '每条 snapshot 对 mastery 的 score/confidence 增量；session-created 仅抬 confidence',
    replacementTrigger: '当 dashboard 出现"成功 N 次后 mastery 仍未饱和"的反例 ≥ 5 例',
    replacementApproach: '改为带遗忘衰减与置信度收敛的贝叶斯式更新',
  },
  'state-update.error-belief': {
    id: 'state-update.error-belief',
    location: 'server/src/modules/student-state/application/state-update-engine.ts:applyErrorBelief',
    describes: '失败累计 errorBelief.score；session-created 触发最低 35 分基线',
    replacementTrigger: '当 errorBelief 与真实重复痛点的相关系数 < 0.4 时',
    replacementApproach: '与 mastery 互对偶，引入时间衰减',
  },
  'cognitive-engine.heuristic-projection': {
    id: 'cognitive-engine.heuristic-projection',
    location: 'server/src/modules/mobius/infrastructure/heuristic-cognitive-engine.ts',
    describes: '把 LearningSignalInput 启发式映射为 CognitiveState kernel 三轴',
    replacementTrigger: '当影子调度器在 ≥ 3 周内稳定显示 cognitive-state 与 effectScore 的相关性失效时',
    replacementApproach: '基于历史 cycle 的回归式状态估计器',
  },
  'story-planner.heuristic-branching': {
    id: 'story-planner.heuristic-branching',
    location: 'server/src/modules/mobius/infrastructure/heuristic-story-planner.ts',
    describes: '基于 emotion label 与 strategy 选择故事分支与 interactionPrompt 的启发式',
    replacementTrigger: '当用户层 NPS / 完成率显示 emotion 分支与实际接受度脱钩时',
    replacementApproach: '由 LLM 编排器（受控 prompt + JSON schema）替代分支表',
  },
  'strategy.scored-default-v0': {
    id: 'strategy.scored-default-v0',
    location: 'server/src/modules/mobius/infrastructure/scored-strategy-scheduler.ts:DEFAULT_SCORED_SCHEDULER_CONFIG',
    describes: 'probe / teach / review 的 base score、teachUnlock 阈值、strategyBias',
    replacementTrigger: '累计 N=200 cycles 且影子策略 effectScore 比主策略稳定高 ≥ 0.05 后',
    replacementApproach: '把 default 替换为表现更好的影子配置；或基于回归学习权重',
  },
  'strategy.scored-balanced-v0': {
    id: 'strategy.scored-balanced-v0',
    location: 'server/src/modules/mobius/infrastructure/scored-strategy-scheduler.ts:BALANCED_SCORED_SCHEDULER_CONFIG',
    describes: '影子策略：更早触发 teach，对低噪声场景给 probe 加权',
    replacementTrigger: '同上，作为 default 的对照变体存在',
    replacementApproach: '若长期未跑赢 default，可以在 N=400 cycles 后下线',
  },
  'strategy.policy-features': {
    id: 'strategy.policy-features',
    location: 'server/src/modules/mobius/infrastructure/strategy-policy-features.ts',
    describes: '6 维 strategy feature 的 resolve 函数与 weights 矩阵',
    replacementTrigger: '当某一维度对最终选择的 marginal contribution 在 ≥ 200 cycles 内全部为 0',
    replacementApproach: '剔除该维度或重新校准权重',
  },
  'effect-score.v0-blend': {
    id: 'effect-score.v0-blend',
    location: 'server/src/modules/analytics/application/effect-score-engine.ts',
    describes: 'effectScore = 0.5*outcome + 0.3*kernelDelta + 0.2*surpriseDelta',
    replacementTrigger: 'N=200 cycles 后',
    replacementApproach: '基于 effectScore 与下一个 cycle outcome 的相关性回归调整权重',
  },
};

export const listHeuristicFormulas = (): HeuristicFormulaTag[] => (
  Object.values(HEURISTIC_FORMULA_REGISTRY)
);
