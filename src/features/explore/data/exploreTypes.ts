export type ExploreLayer = 'foundation-science' | 'mechanism-science';

export type ExploreEngineKey =
  | 'world-engine'
  | 'mind-engine'
  | 'meaning-engine'
  | 'game-topology-engine';

export type FoundationScienceDomain = 'physics' | 'neuroscience' | 'language_game';

export type GameMechanismDomain = 'game_topology';

export type ExploreNodeScale = 'global' | 'module' | 'concept' | 'mechanism' | 'task';

export type InteractiveTaskType = 'drag' | 'sort' | 'match' | 'label' | 'choose' | 'explain';

export type CrossEngineRelation =
  | 'analogy'
  | 'explains'
  | 'supports'
  | 'constrains'
  | 'maps-to'
  | 'transforms'
  | 'activates'
  | 'repairs'
  | 'drives-action';

export interface ExploreEngine {
  key: ExploreEngineKey;
  layer: ExploreLayer;
  title: string;
  englishTitle: string;
  subtitle: string;
  oneSentence: string;
  description: string;
  icon: string;
  accentColor: string;
  gradient: string;
  route: string;
  coreQuestion: string;
  keywords: string[];
}

export interface ExploreNode {
  key: string;
  engineKey: ExploreEngineKey;
  domain: FoundationScienceDomain | GameMechanismDomain;
  layer: ExploreLayer;
  scale: ExploreNodeScale;
  label: string;
  shortLabel: string;
  coreQuestion: string;
  summary: string;
  intuition: string;
  mechanism: string;
  formal?: string;
  relatedCurriculumNodes: string[];
  relatedMistakePatterns: string[];
  crossEngineLinks: {
    targetKey: string;
    targetEngine: ExploreEngineKey;
    relation: CrossEngineRelation;
    description: string;
    isTeachable: boolean;
  }[];
  mediaPromptSeed: {
    visualMetaphor: string;
    gptImageStyle: string;
    seedanceStoryboard: string[];
    interactiveTaskType: InteractiveTaskType;
  };
  explorationTasks: {
    taskType: InteractiveTaskType;
    taskTitle: string;
    taskDescription: string;
    expectedInsight: string;
    estimatedMinutes: number;
  }[];
}
