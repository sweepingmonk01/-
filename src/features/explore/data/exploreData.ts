import { exploreEngines } from './exploreEngines';
import { foundationNodes } from './foundationNodes';
import { gameTopologyNodes } from './gameTopologyNodes';

export const exploreNodes = [
  ...foundationNodes,
  ...gameTopologyNodes,
];

export function getEngineByKey(engineKey: string) {
  return exploreEngines.find((engine) => engine.key === engineKey);
}

export function getNodesByEngine(engineKey: string) {
  return exploreNodes.filter((node) => node.engineKey === engineKey);
}

export function getNodeByKey(nodeKey: string) {
  return exploreNodes.find((node) => node.key === nodeKey);
}

export function getNodeByEngineAndKey(engineKey: string, nodeKey: string) {
  return exploreNodes.find(
    (node) => node.engineKey === engineKey && node.key === nodeKey,
  );
}

export { exploreEngines } from './exploreEngines';
export { upcomingGameTopologyNodes } from './gameTopologyNodes';
export type { ExploreEngine, ExploreEngineKey, ExploreNode } from './exploreTypes';
