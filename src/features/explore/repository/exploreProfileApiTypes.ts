import type { ExploreLearningProfile } from '../profile/exploreLearningProfileTypes';
import type { ExploreProgressApiResponse } from './exploreRemoteReadTypes';

export interface ExploreProfileApiResponse {
  ok: boolean;
  profile: ExploreLearningProfile;
  progress: ExploreProgressApiResponse['progress'];
  generatedAt: string;
  message?: string;
}

export interface ExploreProfileHistoryItem {
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
  source?: string;
  createdBy?: string;
}

export interface ExploreProfileHistoryApiResponse {
  ok: boolean;
  snapshots: ExploreProfileHistoryItem[];
  message?: string;
}

export interface SaveExploreProfileSnapshotApiResponse {
  ok: boolean;
  profile: ExploreLearningProfile;
  progress: unknown;
  generatedAt: string;
  snapshotSaved: boolean;
  message?: string;
}
