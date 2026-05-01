export interface ExploreSyncAcceptedCounts {
  completedNodes: number;
  taskResults: number;
  mediaTasks: number;
}

export interface SaveExploreSyncSnapshotInput {
  snapshot: Record<string, unknown>;
  clientMeta: Record<string, unknown>;
}

export interface ExploreSyncSaveResult {
  remoteBatchId: string;
  syncedAt: string;
  acceptedCounts: ExploreSyncAcceptedCounts;
}

export interface ExploreScopeFilter {
  userId?: string;
  studentId?: string;
  deviceId?: string;
  sessionId?: string;
}

export interface ExploreRemoteSnapshotPayload {
  userScope: ExploreScopeFilter;
  completedNodes: Record<string, unknown>[];
  taskResults: Record<string, unknown>[];
  mediaTasks: Record<string, unknown>[];
  exportedAt: string;
  schemaVersion: 'explore-remote-v0.1';
}

export interface ExploreSnapshotReadResult {
  snapshot: ExploreRemoteSnapshotPayload;
  counts: ExploreSyncAcceptedCounts;
}

export interface ExploreProgressReadResult {
  completedNodes: number;
  taskResults: number;
  mediaTasks: number;
  engines: {
    worldEngine: number;
    mindEngine: number;
    meaningEngine: number;
    gameTopologyEngine: number;
    unknown: number;
  };
  averageTaskQuality: number;
  latestSyncedAt?: string;
}

export interface ExploreSyncBatchSummary {
  id: string;
  userId?: string;
  studentId?: string;
  acceptedCompletedNodes: number;
  acceptedTaskResults: number;
  acceptedMediaTasks: number;
  createdAt: string;
}

export interface ExploreLearningProfileSnapshotInput {
  userScope: ExploreScopeFilter;
  progress: unknown;
  profile: {
    worldModelIndex: number;
    mindModelIndex: number;
    meaningModelIndex: number;
    actionMechanismIndex: number;
    activeStructuralIntelligence: number;
    dominantStrength: string;
    dominantWeakness: string;
    stage: string;
    profileSummary: string;
    recommendedNextFocus: string;
    recommendedNodeKey?: string;
  };
  generatedAt: string;
  source?: 'manual' | 'auto' | 'debug';
  createdBy?: 'learner' | 'system' | 'debug';
}

export interface ExploreLearningProfileHistoryInput extends ExploreScopeFilter {
  limit?: number;
}

export interface ExploreLearningProfileHistoryItem {
  id: string;
  worldModelIndex: number;
  mindModelIndex: number;
  meaningModelIndex: number;
  actionMechanismIndex: number;
  activeStructuralIntelligence: number;
  dominantStrength: string;
  dominantWeakness: string;
  stage: string;
  recommendedNodeKey?: string;
  generatedAt: string;
  source: string;
  createdBy: string;
}

export interface ExploreSyncBatchListInput extends ExploreScopeFilter {
  limit?: number;
}

export interface ExploreSyncStore {
  save(input: SaveExploreSyncSnapshotInput): ExploreSyncSaveResult;
  getSnapshot(input: ExploreScopeFilter): ExploreSnapshotReadResult;
  getProgress(input: ExploreScopeFilter): ExploreProgressReadResult;
  listBatches(input?: ExploreSyncBatchListInput): ExploreSyncBatchSummary[];
  saveProfileSnapshot(input: ExploreLearningProfileSnapshotInput): ExploreLearningProfileHistoryItem;
  getProfileHistory(input: ExploreLearningProfileHistoryInput): ExploreLearningProfileHistoryItem[];
}
