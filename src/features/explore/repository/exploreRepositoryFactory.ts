import { localExploreRepository } from './localExploreRepository';
import { remoteExploreRepositoryStub } from './remoteExploreRepositoryStub';
import type { ExploreRepository } from './exploreRepositoryTypes';

export type ExploreRepositoryMode = 'local' | 'remote-stub';

export function createExploreRepository(
  mode: ExploreRepositoryMode = 'local',
): ExploreRepository {
  if (mode === 'remote-stub') {
    return remoteExploreRepositoryStub;
  }

  return localExploreRepository;
}
