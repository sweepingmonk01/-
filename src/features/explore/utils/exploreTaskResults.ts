import { exploreNodes } from '../data/exploreData';
import { exploreRepository } from '../repository/exploreRepository';
import { exploreStorage } from '../storage';

export type ExploreTaskQualityLevel =
  | 'empty'
  | 'basic'
  | 'good'
  | 'excellent';

export interface ExploreTaskResult {
  id: string;
  nodeKey: string;
  engineKey: string;
  taskTitle: string;
  taskType: string;
  userAnswer: string;
  reflectionText: string;
  qualityScore: number;
  qualityLevel: ExploreTaskQualityLevel;
  createdAt: string;
}

type SaveExploreTaskResultInput = {
  nodeKey: string;
  taskTitle: string;
  taskType: string;
  userAnswer: string;
  reflectionText: string;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function getExploreTaskResults(): ExploreTaskResult[] {
  return exploreStorage.getTaskResults<ExploreTaskResult>();
}

export async function getExploreTaskResultsAsync(): Promise<ExploreTaskResult[]> {
  return exploreRepository.getTaskResults<ExploreTaskResult>();
}

export function getExploreTaskResultsByNode(nodeKey: string): ExploreTaskResult[] {
  return getExploreTaskResults().filter((item) => item.nodeKey === nodeKey);
}

export async function getExploreTaskResultsByNodeAsync(
  nodeKey: string,
): Promise<ExploreTaskResult[]> {
  const results = await getExploreTaskResultsAsync();
  return results.filter((item) => item.nodeKey === nodeKey);
}

export function computeTaskQuality(
  userAnswer: string,
  reflectionText: string,
): {
  qualityScore: number;
  qualityLevel: ExploreTaskQualityLevel;
} {
  const answerLength = userAnswer.trim().length;
  const reflectionLength = reflectionText.trim().length;

  const answerScore = Math.min(0.55, answerLength / 160);
  const reflectionScore = Math.min(0.35, reflectionLength / 180);
  const keywordBonus =
    /因为|所以|规则|语境|结构|错因|修复|下次|我发现|我理解/.test(
      `${userAnswer}${reflectionText}`,
    )
      ? 0.1
      : 0;

  const qualityScore = clamp01(answerScore + reflectionScore + keywordBonus);

  let qualityLevel: ExploreTaskQualityLevel = 'empty';

  if (qualityScore >= 0.75) {
    qualityLevel = 'excellent';
  } else if (qualityScore >= 0.5) {
    qualityLevel = 'good';
  } else if (qualityScore >= 0.2) {
    qualityLevel = 'basic';
  }

  return {
    qualityScore,
    qualityLevel,
  };
}

function buildExploreTaskResult(
  input: SaveExploreTaskResultInput,
): ExploreTaskResult | null {
  const node = exploreNodes.find((item) => item.key === input.nodeKey);
  if (!node) return null;

  const quality = computeTaskQuality(
    input.userAnswer,
    input.reflectionText,
  );

  const result: ExploreTaskResult = {
    id: `${input.nodeKey}-${Date.now()}`,
    nodeKey: input.nodeKey,
    engineKey: node.engineKey,
    taskTitle: input.taskTitle,
    taskType: input.taskType,
    userAnswer: input.userAnswer,
    reflectionText: input.reflectionText,
    qualityScore: quality.qualityScore,
    qualityLevel: quality.qualityLevel,
    createdAt: new Date().toISOString(),
  };

  return result;
}

export function saveExploreTaskResult(
  input: SaveExploreTaskResultInput,
): ExploreTaskResult | null {
  const result = buildExploreTaskResult(input);
  if (!result) return null;

  exploreStorage.addTaskResult(result);
  exploreStorage.addCompletedNode(input.nodeKey);

  return result;
}

export async function saveExploreTaskResultAsync(
  input: SaveExploreTaskResultInput,
): Promise<ExploreTaskResult | null> {
  const result = buildExploreTaskResult(input);
  if (!result) return null;

  await exploreRepository.addTaskResult<ExploreTaskResult>(result);
  await exploreRepository.addCompletedNode(input.nodeKey);

  return result;
}

function computeTaskResultSummaryFromResults(results: ExploreTaskResult[]) {
  const total = results.length;
  const averageQuality =
    total > 0
      ? results.reduce((sum, item) => sum + item.qualityScore, 0) / total
      : 0;

  const excellentCount = results.filter(
    (item) => item.qualityLevel === 'excellent',
  ).length;

  const goodOrAboveCount = results.filter(
    (item) =>
      item.qualityLevel === 'good' ||
      item.qualityLevel === 'excellent',
  ).length;

  return {
    total,
    averageQuality,
    excellentCount,
    goodOrAboveCount,
    results,
  };
}

export function computeTaskResultSummary() {
  return computeTaskResultSummaryFromResults(getExploreTaskResults());
}

export async function computeTaskResultSummaryAsync() {
  const results = await getExploreTaskResultsAsync();
  return computeTaskResultSummaryFromResults(results);
}
