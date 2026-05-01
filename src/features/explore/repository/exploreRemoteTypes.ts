import type { ExploreMediaTask } from '../utils/exploreMediaTasks';
import type { ExploreTaskResult } from '../utils/exploreTaskResults';

export interface ExploreUserScope {
  userId?: string;
  studentId?: string;
  deviceId?: string;
  sessionId?: string;
}

export type ExploreSyncStatus =
  | 'local-only'
  | 'pending-sync'
  | 'synced'
  | 'sync-failed';

export interface RemoteExploreCompletedNode {
  id: string;
  nodeKey: string;
  engineKey: string;
  userScope: ExploreUserScope;
  source:
    | 'quick-mark'
    | 'task-result'
    | 'mistake-recommendation'
    | 'manual';
  evidenceId?: string;
  syncStatus: ExploreSyncStatus;
  completedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface RemoteExploreTaskResult
  extends Omit<ExploreTaskResult, 'id'> {
  id: string;
  userScope: ExploreUserScope;
  syncStatus: ExploreSyncStatus;
  localId?: string;
  remoteId?: string;
  updatedAt: string;
}

export interface RemoteExploreMediaTask
  extends Omit<ExploreMediaTask, 'id'> {
  id: string;
  userScope: ExploreUserScope;
  syncStatus: ExploreSyncStatus;
  localId?: string;
  remoteId?: string;
  updatedAt: string;
}

export type ExploreTransferOutcome = 'success' | 'failure';

export interface ExploreTransferRubric {
  structureIdentified: boolean;
  mappingApplied: boolean;
  actionMechanismNamed: boolean;
  resultExplained: boolean;
}

export interface ExploreTransferStructure {
  key: string;
  label: string;
  description: string;
  engineKey: string;
  repairNodeKey: string;
  evidenceSummary: string;
}

export interface ExploreTransferTargetTask {
  id: string;
  domain: string;
  prompt: string;
  expectedStructureCue: string;
}

export interface RemoteExploreTransferAttempt {
  id: string;
  userScope: ExploreUserScope;
  sourceNodeKey: string;
  sourceEvidenceId?: string;
  extractedStructure: ExploreTransferStructure;
  targetDomain: string;
  targetTask: ExploreTransferTargetTask;
  userApplication: string;
  outcome: ExploreTransferOutcome;
  rubricScore: number;
  rubric: ExploreTransferRubric;
  stateBefore: unknown;
  stateAfter: unknown;
  recommendedRepairNodeKey?: string;
  syncStatus?: ExploreSyncStatus;
  createdAt: string;
}

export interface ExploreRemoteSnapshot {
  userScope: ExploreUserScope;
  completedNodes: RemoteExploreCompletedNode[];
  taskResults: RemoteExploreTaskResult[];
  mediaTasks: RemoteExploreMediaTask[];
  transferAttempts: RemoteExploreTransferAttempt[];
  exportedAt: string;
  schemaVersion: 'explore-remote-v0.1';
}
