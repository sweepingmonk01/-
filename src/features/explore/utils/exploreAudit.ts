import { exploreEngines } from '../data/exploreEngines';
import { exploreNodes } from '../data/exploreData';
import { exploreRepository } from '../repository/exploreRepository';
import { getExploreSyncQueue } from '../repository/exploreSyncQueue';
import { exploreStorage } from '../storage';
import { getExploreMediaTasks } from './exploreMediaTasks';
import { getCompletedExploreNodeKeys } from './exploreProgress';
import { getExploreTaskResults } from './exploreTaskResults';

export interface ExploreAuditResult {
  engineCount: number;
  nodeCount: number;
  completedNodeCount: number;
  taskResultCount: number;
  mediaTaskCount: number;
  syncQueueCount: number;

  missingTasks: string[];
  missingMediaSeeds: string[];
  invalidCrossLinks: {
    sourceKey: string;
    targetKey: string;
  }[];

  localStorageSnapshot: {
    completedNodes: string[];
    taskResults: unknown[];
    mediaTasks: unknown[];
  };

  healthScore: number;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function buildExploreAuditResult(input: {
  completedNodes: string[];
  taskResults: unknown[];
  mediaTasks: unknown[];
  syncQueueCount: number;
}): ExploreAuditResult {
  const missingTasks = exploreNodes
    .filter((node) => !node.explorationTasks || node.explorationTasks.length === 0)
    .map((node) => node.key);

  const missingMediaSeeds = exploreNodes
    .filter(
      (node) =>
        !node.mediaPromptSeed ||
        !node.mediaPromptSeed.visualMetaphor ||
        !node.mediaPromptSeed.gptImageStyle,
    )
    .map((node) => node.key);

  const validNodeKeys = new Set(exploreNodes.map((node) => node.key));

  const invalidCrossLinks = exploreNodes.flatMap((node) =>
    node.crossEngineLinks
      .filter((link) => !validNodeKeys.has(link.targetKey))
      .map((link) => ({
        sourceKey: node.key,
        targetKey: link.targetKey,
      })),
  );

  const totalIssues =
    missingTasks.length + missingMediaSeeds.length + invalidCrossLinks.length;

  const healthScore = clamp01(1 - totalIssues / Math.max(1, exploreNodes.length));

  return {
    engineCount: exploreEngines.length,
    nodeCount: exploreNodes.length,
    completedNodeCount: input.completedNodes.length,
    taskResultCount: input.taskResults.length,
    mediaTaskCount: input.mediaTasks.length,
    syncQueueCount: input.syncQueueCount,

    missingTasks,
    missingMediaSeeds,
    invalidCrossLinks,

    localStorageSnapshot: {
      completedNodes: input.completedNodes,
      taskResults: input.taskResults,
      mediaTasks: input.mediaTasks,
    },

    healthScore,
  };
}

export function runExploreAudit(): ExploreAuditResult {
  return buildExploreAuditResult({
    completedNodes: getCompletedExploreNodeKeys(),
    taskResults: getExploreTaskResults(),
    mediaTasks: getExploreMediaTasks(),
    syncQueueCount: getExploreSyncQueue().length,
  });
}

export async function runExploreAuditAsync(): Promise<ExploreAuditResult> {
  const snapshot = await exploreRepository.exportSnapshot();
  return buildExploreAuditResult({
    ...snapshot,
    syncQueueCount: getExploreSyncQueue().length,
  });
}

export function exportExploreLocalData() {
  const audit = runExploreAudit();

  const payload = {
    exportedAt: new Date().toISOString(),
    version: 'explore-local-closed-loop-v0.1',
    audit,
  };

  return JSON.stringify(payload, null, 2);
}

export async function exportExploreLocalDataAsync(): Promise<string> {
  const audit = await runExploreAuditAsync();

  const payload = {
    exportedAt: new Date().toISOString(),
    version: 'explore-local-closed-loop-v0.1',
    audit,
  };

  return JSON.stringify(payload, null, 2);
}

export function clearExploreLocalData() {
  exploreStorage.clearAll();
}

export async function clearExploreLocalDataAsync(): Promise<void> {
  await exploreRepository.clearAll();
}
