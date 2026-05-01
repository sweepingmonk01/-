import { computeExploreProgress } from './exploreProgress';
import { computeTaskResultSummary } from './exploreTaskResults';

export type AIActiveDimensionKey =
  | 'worldModelClarity'
  | 'mindModelStability'
  | 'meaningModelClarity'
  | 'actionMechanismStrength'
  | 'crossEngineIntegration'
  | 'mistakeRepairMomentum'
  | 'learningStability';

export interface AIActiveLearningState {
  worldModelClarity: number;
  mindModelStability: number;
  meaningModelClarity: number;
  actionMechanismStrength: number;
  crossEngineIntegration: number;
  mistakeRepairMomentum: number;
  learningStability: number;
  dominantWeakness:
    | 'world'
    | 'mind'
    | 'meaning'
    | 'game'
    | 'integration'
    | 'unknown';
  recommendedNextAction: string;
  recommendedNodeKey?: string;
}

export interface LightweightMistakeRecord {
  id?: string;
  mistakeKey?: string;
  painPoint?: string;
  rule?: string;
  questionText?: string;
  node?: string;
  diagnosedMistakes?: string[];
  isResolved?: boolean;
  createdAt?: string;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function stringifyMistake(item: LightweightMistakeRecord) {
  try {
    return JSON.stringify(item);
  } catch {
    return [
      item.mistakeKey,
      item.painPoint,
      item.rule,
      item.questionText,
      item.node,
      item.diagnosedMistakes?.join(' '),
    ].filter(Boolean).join(' ');
  }
}

export function computeAIActiveStateFromExplore(
  mistakes: LightweightMistakeRecord[] = [],
): AIActiveLearningState {
  const explore = computeExploreProgress();
  const taskSummary = computeTaskResultSummary();

  const totalMistakes = mistakes.length;
  const resolvedMistakes = mistakes.filter((item) => item.isResolved).length;
  const unresolvedRatio = totalMistakes > 0 ? 1 - resolvedMistakes / totalMistakes : 0.3;
  const taskQualityBonus = Math.min(0.15, taskSummary.averageQuality * 0.15);
  const taskEvidenceBonus = Math.min(0.1, taskSummary.total * 0.015);

  const mistakeCorpus = mistakes.map(stringifyMistake).join(' ');

  const hasContextIssues =
    mistakeCorpus.includes('context_misread') ||
    mistakeCorpus.includes('语境') ||
    mistakeCorpus.includes('阅读');

  const hasRuleIssues =
    mistakeCorpus.includes('rule_mismatch') ||
    mistakeCorpus.includes('规则') ||
    mistakeCorpus.includes('公式') ||
    mistakeCorpus.includes('运算');

  const hasRepeatedIssues =
    mistakeCorpus.includes('repeated_same_mistake') ||
    mistakeCorpus.includes('反复') ||
    mistakeCorpus.includes('同类');

  const hasAttentionIssues =
    mistakeCorpus.includes('attention_distracted') ||
    mistakeCorpus.includes('粗心') ||
    mistakeCorpus.includes('注意');

  const worldPenalty = hasRuleIssues ? 0.08 : 0;
  const mindPenalty = hasAttentionIssues || hasRepeatedIssues ? 0.1 : 0;
  const meaningPenalty = hasContextIssues ? 0.1 : 0;
  const gamePenalty = hasRepeatedIssues ? 0.1 : 0;

  const worldModelClarity = clamp01(explore.worldModelClarity - worldPenalty);
  const mindModelStability = clamp01(explore.mindModelStability - mindPenalty);
  const meaningModelClarity = clamp01(explore.meaningModelClarity - meaningPenalty);
  const actionMechanismStrength = clamp01(explore.actionMechanismStrength - gamePenalty);
  const crossEngineIntegration = clamp01(
    explore.crossEngineIntegration - Math.min(0.15, unresolvedRatio * 0.15) + taskQualityBonus,
  );

  const mistakeRepairMomentum = clamp01(
    0.2 +
      (totalMistakes > 0 ? resolvedMistakes / totalMistakes : 0.2) * 0.45 +
      (explore.totalCompleted / Math.max(1, explore.totalNodes)) * 0.25 +
      taskQualityBonus +
      taskEvidenceBonus,
  );

  const learningStability = clamp01(
    (
      mindModelStability +
      actionMechanismStrength +
      mistakeRepairMomentum +
      taskSummary.averageQuality
    ) / 4,
  );

  const values = {
    world: worldModelClarity,
    mind: mindModelStability,
    meaning: meaningModelClarity,
    game: actionMechanismStrength,
    integration: crossEngineIntegration,
  };

  const dominantWeakness = Object.entries(values).sort(
    (a, b) => a[1] - b[1],
  )[0]?.[0] as AIActiveLearningState['dominantWeakness'] | undefined;

  const recommendation = getRecommendationByWeakness(dominantWeakness ?? 'unknown');

  return {
    worldModelClarity,
    mindModelStability,
    meaningModelClarity,
    actionMechanismStrength,
    crossEngineIntegration,
    mistakeRepairMomentum,
    learningStability,
    dominantWeakness: dominantWeakness ?? 'unknown',
    recommendedNextAction: recommendation.action,
    recommendedNodeKey: recommendation.nodeKey,
  };
}

function getRecommendationByWeakness(
  weakness: AIActiveLearningState['dominantWeakness'],
) {
  switch (weakness) {
    case 'world':
      return {
        nodeKey: 'physics.symmetry_conservation',
        action: '建议进入 World Engine，优先修复守恒、平衡和因果结构。',
      };
    case 'mind':
      return {
        nodeKey: 'neuroscience.cognition_consciousness',
        action: '建议进入 Mind Engine，优先修复注意、情绪和执行控制。',
      };
    case 'meaning':
      return {
        nodeKey: 'language.context',
        action: '建议进入 Meaning Engine，优先修复语境、规则和意义判断。',
      };
    case 'game':
      return {
        nodeKey: 'game.feedback_loop',
        action: '建议进入 Game Topology Engine，优先修复反馈回路和行动机制。',
      };
    case 'integration':
      return {
        nodeKey: 'game.core_formula',
        action: '建议完成一个跨引擎任务，把理解转化为稳定行动循环。',
      };
    default:
      return {
        nodeKey: 'language.rules',
        action: '建议从规则识别开始，建立稳定的解题入口。',
      };
  }
}
