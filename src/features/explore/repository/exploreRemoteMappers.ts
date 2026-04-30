import { exploreNodes } from '../data/exploreData';
import type { ExploreMediaTask } from '../utils/exploreMediaTasks';
import type { ExploreTaskResult } from '../utils/exploreTaskResults';
import type {
  ExploreUserScope,
  RemoteExploreCompletedNode,
  RemoteExploreMediaTask,
  RemoteExploreTaskResult,
} from './exploreRemoteTypes';

function nowIso() {
  return new Date().toISOString();
}

function createLocalRemoteId(prefix: string, localId: string) {
  return `${prefix}-${localId}`;
}

export function mapTaskResultToRemote(
  result: ExploreTaskResult,
  userScope: ExploreUserScope,
): RemoteExploreTaskResult {
  const timestamp = nowIso();

  return {
    ...result,
    id: createLocalRemoteId('task', result.id),
    localId: result.id,
    remoteId: undefined,
    userScope,
    syncStatus: 'pending-sync',
    updatedAt: timestamp,
  };
}

export function mapMediaTaskToRemote(
  task: ExploreMediaTask,
  userScope: ExploreUserScope,
): RemoteExploreMediaTask {
  const timestamp = nowIso();

  return {
    ...task,
    id: createLocalRemoteId('media', task.id),
    localId: task.id,
    remoteId: undefined,
    userScope,
    syncStatus: 'pending-sync',
    updatedAt: timestamp,
  };
}

export function mapCompletedNodeToRemote(input: {
  nodeKey: string;
  userScope: ExploreUserScope;
  source:
    | 'quick-mark'
    | 'task-result'
    | 'mistake-recommendation'
    | 'manual';
  evidenceId?: string;
}): RemoteExploreCompletedNode {
  const node = exploreNodes.find((item) => item.key === input.nodeKey);
  const timestamp = nowIso();

  return {
    id: createLocalRemoteId('completed', input.nodeKey),
    nodeKey: input.nodeKey,
    engineKey: node?.engineKey ?? 'unknown',
    userScope: input.userScope,
    source: input.source,
    evidenceId: input.evidenceId,
    syncStatus: 'pending-sync',
    completedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
