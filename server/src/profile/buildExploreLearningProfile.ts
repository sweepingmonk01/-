import type {
  ExploreLearningProfile,
  ExploreLearningProfileInput,
} from './exploreLearningProfileTypes.js';

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function safeRatio(value: number, max: number) {
  return clamp01(max > 0 ? value / max : 0);
}

export function buildExploreLearningProfile(
  input: ExploreLearningProfileInput,
): ExploreLearningProfile {
  const worldRaw = input.engines.worldEngine;
  const mindRaw = input.engines.mindEngine;
  const meaningRaw = input.engines.meaningEngine;
  const gameRaw = input.engines.gameTopologyEngine;

  const totalEngineNodes =
    worldRaw + mindRaw + meaningRaw + gameRaw + input.engines.unknown;

  const evidenceDensity = safeRatio(input.taskResults, Math.max(3, input.completedNodes));
  const quality = clamp01(input.averageTaskQuality || 0);

  const worldModelIndex = clamp01(0.18 + safeRatio(worldRaw, 3) * 0.55 + quality * 0.27);
  const mindModelIndex = clamp01(0.18 + safeRatio(mindRaw, 3) * 0.55 + quality * 0.27);
  const meaningModelIndex = clamp01(0.18 + safeRatio(meaningRaw, 3) * 0.55 + quality * 0.27);
  const actionMechanismIndex = clamp01(0.15 + safeRatio(gameRaw, 3) * 0.55 + evidenceDensity * 0.3);

  const engineValues = {
    world: worldModelIndex,
    mind: mindModelIndex,
    meaning: meaningModelIndex,
    game: actionMechanismIndex,
  };

  const sorted = Object.entries(engineValues).sort((a, b) => b[1] - a[1]);
  const strongest = sorted[0];
  const weakest = [...sorted].sort((a, b) => a[1] - b[1])[0];
  const spread = strongest[1] - weakest[1];

  const dominantStrength =
    totalEngineNodes === 0
      ? 'unknown'
      : spread < 0.08
        ? 'balanced'
        : (strongest[0] as ExploreLearningProfile['dominantStrength']);

  const dominantWeakness =
    totalEngineNodes === 0
      ? 'unknown'
      : spread < 0.08
        ? 'integration'
        : (weakest[0] as ExploreLearningProfile['dominantWeakness']);

  const balanceBonus = spread < 0.12 ? 0.08 : spread < 0.2 ? 0.04 : 0;

  const activeStructuralIntelligence = clamp01(
    worldModelIndex * 0.25 +
      mindModelIndex * 0.25 +
      meaningModelIndex * 0.25 +
      actionMechanismIndex * 0.15 +
      quality * 0.1 +
      balanceBonus,
  );

  const stage = getProfileStage(
    activeStructuralIntelligence,
    input.completedNodes,
    input.taskResults,
  );
  const recommendation = getRecommendationByWeakness(dominantWeakness);

  return {
    worldModelIndex,
    mindModelIndex,
    meaningModelIndex,
    actionMechanismIndex,
    activeStructuralIntelligence,
    dominantStrength,
    dominantWeakness,
    stage,
    profileSummary: buildProfileSummary({
      stage,
      dominantStrength,
      dominantWeakness,
      activeStructuralIntelligence,
    }),
    recommendedNextFocus: recommendation.text,
    recommendedNodeKey: recommendation.nodeKey,
  };
}

function getProfileStage(
  asi: number,
  completedNodes: number,
  taskResults: number,
): ExploreLearningProfile['stage'] {
  if (completedNodes <= 0) return 'seed';
  if (asi < 0.35 || taskResults <= 1) return 'forming';
  if (asi < 0.55) return 'connecting';
  if (asi < 0.75) return 'integrating';
  return 'structural';
}

function getRecommendationByWeakness(
  weakness: ExploreLearningProfile['dominantWeakness'],
) {
  switch (weakness) {
    case 'world':
      return {
        nodeKey: 'physics.symmetry_conservation',
        text: '建议优先补强 World Engine，训练守恒、因果、对称与系统边界。',
      };
    case 'mind':
      return {
        nodeKey: 'neuroscience.cognition_consciousness',
        text: '建议优先补强 Mind Engine，训练注意、情绪、执行控制和元认知。',
      };
    case 'meaning':
      return {
        nodeKey: 'language.context',
        text: '建议优先补强 Meaning Engine，训练语境、规则和意义判断。',
      };
    case 'game':
      return {
        nodeKey: 'game.feedback_loop',
        text: '建议优先补强 Game Topology Engine，建立稳定反馈回路与成长机制。',
      };
    case 'integration':
      return {
        nodeKey: 'game.core_formula',
        text: '建议完成一个跨引擎任务，把世界模型、心智模型、意义模型转化为行动循环。',
      };
    default:
      return {
        nodeKey: 'language.rules',
        text: '建议从规则识别开始，先建立稳定的解题入口。',
      };
  }
}

function buildProfileSummary(input: {
  stage: ExploreLearningProfile['stage'];
  dominantStrength: ExploreLearningProfile['dominantStrength'];
  dominantWeakness: ExploreLearningProfile['dominantWeakness'];
  activeStructuralIntelligence: number;
}) {
  const asiText = `${Math.round(input.activeStructuralIntelligence * 100)}%`;

  const stageText: Record<ExploreLearningProfile['stage'], string> = {
    seed: '种子期：刚开始建立探索证据。',
    forming: '成形期：已经开始形成基础结构，但证据还不稳定。',
    connecting: '连接期：不同引擎之间开始产生关联。',
    integrating: '整合期：能够把多个引擎用于同一问题。',
    structural: '结构期：已经具备较稳定的跨学科结构化理解力。',
  };

  return `${stageText[input.stage]} 当前 ASI 主动结构化理解力约为 ${asiText}。优势倾向：${input.dominantStrength}；需要补强：${input.dominantWeakness}。`;
}
