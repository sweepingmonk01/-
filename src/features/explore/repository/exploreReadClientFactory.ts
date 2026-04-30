import { httpExploreReadClient } from './httpExploreReadClient';

export type ExploreReadClientMode = 'http';

export function getDefaultExploreReadClient() {
  return httpExploreReadClient;
}
