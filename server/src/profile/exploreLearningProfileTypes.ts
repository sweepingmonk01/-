export interface ExploreLearningProfileInput {
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

export interface ExploreLearningProfile {
  worldModelIndex: number;
  mindModelIndex: number;
  meaningModelIndex: number;
  actionMechanismIndex: number;
  activeStructuralIntelligence: number;

  dominantStrength:
    | 'world'
    | 'mind'
    | 'meaning'
    | 'game'
    | 'balanced'
    | 'unknown';

  dominantWeakness:
    | 'world'
    | 'mind'
    | 'meaning'
    | 'game'
    | 'integration'
    | 'unknown';

  stage:
    | 'seed'
    | 'forming'
    | 'connecting'
    | 'integrating'
    | 'structural';

  profileSummary: string;
  recommendedNextFocus: string;
  recommendedNodeKey?: string;
}
