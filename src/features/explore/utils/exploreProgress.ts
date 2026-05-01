import { exploreNodes } from '../data/exploreData';
import { exploreRepository } from '../repository/exploreRepository';
import { exploreStorage } from '../storage';

export type ExploreEngineProgress = {
  completed: number;
  total: number;
  progress: number;
};

export type ExploreProgressSummary = {
  completedNodeKeys: string[];
  totalCompleted: number;
  totalNodes: number;
  world: ExploreEngineProgress;
  mind: ExploreEngineProgress;
  meaning: ExploreEngineProgress;
  game: ExploreEngineProgress;
  worldModelClarity: number;
  mindModelStability: number;
  meaningModelClarity: number;
  actionMechanismStrength: number;
  crossEngineIntegration: number;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function getCompletedExploreNodeKeys(): string[] {
  return exploreStorage.getCompletedNodes();
}

export async function getCompletedExploreNodeKeysAsync(): Promise<string[]> {
  return exploreRepository.getCompletedNodes();
}

function getEngineProgress(completedNodeKeys: string[], engineKey: string): ExploreEngineProgress {
  const total = exploreNodes.filter((node) => node.engineKey === engineKey).length;
  const completed = completedNodeKeys.filter((key) => {
    const node = exploreNodes.find((item) => item.key === key);
    return node?.engineKey === engineKey;
  }).length;

  return {
    completed,
    total,
    progress: total > 0 ? completed / total : 0,
  };
}

export function computeExploreProgressFromCompletedKeys(
  completedNodeKeys: string[],
): ExploreProgressSummary {
  const world = getEngineProgress(completedNodeKeys, 'world-engine');
  const mind = getEngineProgress(completedNodeKeys, 'mind-engine');
  const meaning = getEngineProgress(completedNodeKeys, 'meaning-engine');
  const game = getEngineProgress(completedNodeKeys, 'game-topology-engine');

  const foundationProgress = (world.progress + mind.progress + meaning.progress) / 3;
  const activeEngineCount = [world, mind, meaning, game].filter((item) => item.completed > 0).length;
  const balanceBonus =
    activeEngineCount >= 4
      ? 0.2
      : activeEngineCount === 3
        ? 0.15
        : activeEngineCount === 2
          ? 0.08
          : activeEngineCount === 1
            ? 0.03
            : 0;

  return {
    completedNodeKeys,
    totalCompleted: completedNodeKeys.length,
    totalNodes: exploreNodes.length,
    world,
    mind,
    meaning,
    game,
    worldModelClarity: clamp01(0.2 + world.progress * 0.7 + balanceBonus),
    mindModelStability: clamp01(0.2 + mind.progress * 0.7 + balanceBonus),
    meaningModelClarity: clamp01(0.2 + meaning.progress * 0.7 + balanceBonus),
    actionMechanismStrength: clamp01(0.15 + game.progress * 0.75 + balanceBonus),
    crossEngineIntegration: clamp01(
      0.15 + foundationProgress * 0.55 + game.progress * 0.2 + balanceBonus,
    ),
  };
}

export function computeExploreProgress(): ExploreProgressSummary {
  const completedNodeKeys = getCompletedExploreNodeKeys();
  return computeExploreProgressFromCompletedKeys(completedNodeKeys);
}

export async function computeExploreProgressAsync(): Promise<ExploreProgressSummary> {
  const completedNodeKeys = await getCompletedExploreNodeKeysAsync();
  return computeExploreProgressFromCompletedKeys(completedNodeKeys);
}
