import type { ExploreMediaTask } from '../utils/exploreMediaTasks';
import type { ExploreTaskResult } from '../utils/exploreTaskResults';
import type {
  ExploreRemoteSnapshot,
  ExploreUserScope,
} from './exploreRemoteTypes';
import {
  mapCompletedNodeToRemote,
  mapMediaTaskToRemote,
  mapTaskResultToRemote,
} from './exploreRemoteMappers';

export interface BuildExploreSyncPayloadInput {
  userScope: ExploreUserScope;
  completedNodeKeys: string[];
  taskResults: ExploreTaskResult[];
  mediaTasks: ExploreMediaTask[];
}

export function buildExploreRemoteSnapshot(
  input: BuildExploreSyncPayloadInput,
): ExploreRemoteSnapshot {
  return {
    userScope: input.userScope,
    completedNodes: input.completedNodeKeys.map((nodeKey) =>
      mapCompletedNodeToRemote({
        nodeKey,
        userScope: input.userScope,
        source: 'manual',
      }),
    ),
    taskResults: input.taskResults.map((result) =>
      mapTaskResultToRemote(result, input.userScope),
    ),
    mediaTasks: input.mediaTasks.map((task) =>
      mapMediaTaskToRemote(task, input.userScope),
    ),
    exportedAt: new Date().toISOString(),
    schemaVersion: 'explore-remote-v0.1',
  };
}
