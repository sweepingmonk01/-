import { buildMobiusHeaders } from './mobius-auth';
import type { CognitiveState, CompatibleCognitiveState } from '../../shared/cognitive-state';

export type { CognitiveState, CompatibleCognitiveState } from '../../shared/cognitive-state';

export interface MobiusSessionRequest {
  studentId: string;
  targetScore?: number;
  grade?: string;
  painPoint: string;
  rule: string;
  questionText?: string;
  diagnosedMistakes?: DiagnosedMistakePattern[];
  knowledgeAction?: KnowledgeAction;
  timeSavedMinutes?: number;
  previousState?: CompatibleCognitiveState;
  learningSignals?: {
    responseTimeMs?: number;
    attempts?: number;
    scrollBurstCount?: number;
    correctStreak?: number;
    wrongStreak?: number;
    timeSavedMinutes?: number;
  };
}

export type MistakeCategory =
  | 'concept-confusion'
  | 'rule-recall'
  | 'strategy-selection'
  | 'careless-execution'
  | 'language-mapping';

export type KnowledgeActionType = 'select' | 'draw' | 'drag' | 'speak' | 'sequence';
export type InteractionConfidence = 'low' | 'medium' | 'high';

export interface DiagnosedMistakePattern {
  id: string;
  category: MistakeCategory;
  label: string;
  description: string;
  evidence: string[];
  coachingHint: string;
}

export interface KnowledgeAction {
  id: string;
  label: string;
  actionType: KnowledgeActionType;
  instruction: string;
  successCriteria: string[];
  failureSignals: string[];
}

export interface ErrorRecord {
  painPoint: string;
  rule: string;
  questionText?: string;
  subject?: 'zh' | 'ma' | 'en';
  grade?: string;
  diagnosedMistakes: DiagnosedMistakePattern[];
  knowledgeAction: KnowledgeAction;
}

export type StrategyKind = 'probe' | 'teach' | 'review';

export type StrategyFeatureKey =
  | 'painPointRecurrence'
  | 'timePressure'
  | 'noisePressure'
  | 'emotionRisk'
  | 'masteryGap'
  | 'recentFailurePressure'
  | 'recentSuccessRecovery';

export interface StrategyScoreFeature {
  label: string;
  value: number;
  weight: number;
  contribution: number;
}

export type StrategyScoreBreakdown = Record<StrategyFeatureKey, StrategyScoreFeature>;

export interface StrategyCandidate {
  strategy: StrategyKind;
  baseScore: number;
  score: number;
  scoreBreakdown: StrategyScoreBreakdown;
  rationale: string;
}

export interface StrategyDecision {
  candidates: StrategyCandidate[];
  selectedStrategy: StrategyKind;
}

export interface InteractionSubmission {
  actionId?: string;
  actionType?: KnowledgeActionType;
  completed?: boolean;
  confidence?: InteractionConfidence;
  selfCheck?: 'aligned' | 'partial' | 'guess';
  note?: string;
}

export interface AnalyzeQuestionImageRequest {
  imageBase64: string;
  mimeType: string;
}

export interface AIQuestionData {
  painPoint: string;
  rule: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
}

export interface GenerateCloneQuestionRequest {
  painPoint: string;
  rule: string;
  questionText: string;
}

export interface GenerateTheaterScriptRequest {
  painPoint: string;
  rule: string;
}

export interface TheaterScript {
  sceneIntro: string;
  emotion: string;
  interactionPrompt: string;
  successScene: string;
  failureScene: string;
}

export interface DehydrateHomeworkRequest {
  imageBase64: string;
  mimeType: string;
  targetScore: number;
  studentId?: string;
}

export type HomeworkVisualSignalKind = 'image-format' | 'page-shape' | 'detail-density' | 'capture-risk';
export type HomeworkVisualSignalSeverity = 'info' | 'watch' | 'risk';

export interface HomeworkVisualSignal {
  kind: HomeworkVisualSignalKind;
  label: string;
  severity: HomeworkVisualSignalSeverity;
  confidence: number;
  evidence: string[];
}

export interface StrategicQuestionPlan {
  questionLabel: string;
  topic: string;
  action: 'attack' | 'review' | 'skip';
  estimatedMinutes: number;
  roiScore: number;
  rationale: string;
  extractedKnowledgePoint: string;
}

export interface StrategicPlannerResult {
  commanderBriefing: string;
  immediateOrder: string;
  focusKnowledgePoints: string[];
  weakTopicAlerts: string[];
  attackQuestions: string[];
  reviewQuestions: string[];
  skipQuestions: string[];
  questionPlans: StrategicQuestionPlan[];
  visualSignals?: HomeworkVisualSignal[];
}

export interface DehydrateResult {
  total: number;
  trashEasy: number;
  dropHard: number;
  mustDo: number;
  reasoning: string;
  mustDoIndices: string;
  strategicPlan?: StrategicPlannerResult;
}

export interface SocraticMessage {
  role: 'system' | 'assistant' | 'user';
  content: string;
  createdAt: string;
}

export interface ProbeAction {
  id: string;
  type: 'ask-first-step' | 'ask-rule-recall' | 'ask-cue-detection' | 'ask-self-monitor';
  prompt: string;
  successSignal: string;
}

export interface HypothesisCandidate {
  id: string;
  kind: 'rule-not-triggered' | 'cue-missed' | 'strategy-confusion' | 'guessing-with-low-monitoring' | 'knowledge-fragile';
  label: string;
  summary: string;
  confidence: number;
  evidence: string[];
  probeActions: ProbeAction[];
}

export interface HypothesisConfidenceUpdate {
  hypothesisId: string;
  label: string;
  previousConfidence: number;
  nextConfidence: number;
  delta: number;
  reasons: string[];
}

export interface HypothesisIntervention {
  id: string;
  hypothesisId: string;
  type: 'probe' | 'teach' | 'review';
  prompt: string;
  rationale: string;
}

export interface HypothesisUpdateResult {
  source: 'heuristic-v1';
  updatedAt: string;
  updates: HypothesisConfidenceUpdate[];
  selectedHypothesis?: HypothesisCandidate;
  selectedProbeAction?: ProbeAction;
  selectedIntervention?: HypothesisIntervention;
}

export interface HypothesisSummary {
  source: 'heuristic-v1';
  generatedAt: string;
  candidates: HypothesisCandidate[];
  selectedHypothesis?: HypothesisCandidate;
  selectedProbeAction?: ProbeAction;
  selectedIntervention?: HypothesisIntervention;
  lastUpdate?: HypothesisUpdateResult;
}

export interface SocraticThread {
  id: string;
  studentId: string;
  status: 'active' | 'completed';
  title: string;
  agentLabel: string;
  cycleId?: string;
  jobId?: string;
  painPoint?: string;
  rule?: string;
  rationale?: string[];
  hypothesisSummary?: HypothesisSummary;
  messages: SocraticMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeGraphNode {
  key: string;
  label: string;
  weight: number;
  lastSeenAt: string;
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  weight: number;
  lastSeenAt: string;
}

export interface KnowledgeGraphSnapshot {
  studentId: string;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  updatedAt?: string;
}

export interface KnowledgeGraphDecisionNode {
  key: string;
  label: string;
  weight: number;
  relationWeight?: number;
  anchorKey?: string;
  anchorLabel?: string;
}

export interface KnowledgeGraphDecisionContext {
  topHotspots: KnowledgeGraphDecisionNode[];
  matchedHotspots: KnowledgeGraphDecisionNode[];
  neighborRecommendations: KnowledgeGraphDecisionNode[];
  summary: string[];
}

export interface GeneratedKnowledgeMapAsset {
  id: string;
  studentId: string;
  kind: 'knowledge-map-bg' | 'node-card' | 'video-first-frame' | 'theater-video';
  provider: 'openai' | 'seedance2' | 'stub';
  sourceHash: string;
  promptJson: {
    nodeKey?: string;
    nodeLabel?: string;
    relatedConcepts?: string[];
    relatedErrors?: string[];
    [key: string]: unknown;
  };
  status: 'queued' | 'processing' | 'ready' | 'failed';
  urlOrBlobRef?: string;
  mimeType?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MobiusContentResolveRequest {
  studentId?: string;
  subject?: 'zh' | 'ma' | 'en';
  grade?: string;
  painPoint: string;
  rule?: string;
  questionText?: string;
}

export interface MobiusContentResolveResponse {
  input: MobiusContentResolveRequest;
  errorRecord: ErrorRecord;
  matchedKnowledgePoints: Array<{
    knowledgePoint: {
      id: string;
      reference: {
        subject: 'zh' | 'ma' | 'en';
        grade: string;
        version: string;
        term?: '上' | '下' | '全';
      };
      chapter: string;
      section: string;
      title: string;
      masteryGoal: string;
      keywords: string[];
      commonMistakes: string[];
      prerequisiteIds: string[];
    };
    score: number;
    reasons: string[];
  }>;
  recommendedFoundationNodes: Array<{
    node: FoundationKnowledgeNode;
    score: number;
    reasons: string[];
    edges: FoundationKnowledgeEdge[];
  }>;
  graphDecisionContext?: KnowledgeGraphDecisionContext;
  relatedQuestions: Array<{
    question: {
      id: string;
      subject: 'zh' | 'ma' | 'en';
      grade: string;
      region: string;
      source: 'final-exam' | 'unit-test' | 'mock';
      year: number;
      term?: '上' | '下';
      questionType: string;
      stem: string;
      answerSummary: string;
      score: number;
      difficulty: 'foundation' | 'standard' | 'stretch';
      knowledgePointIds: string[];
      tags: string[];
    };
    overlapKnowledgePointIds: string[];
    rationale: string;
  }>;
  recommendedStorySeed: {
    painPoint: string;
    rule: string;
    questionText: string;
    recommendedKnowledgePointId?: string;
    evidence: string[];
    diagnosedMistakes: DiagnosedMistakePattern[];
    knowledgeAction: KnowledgeAction;
  };
}

export type FoundationScienceDomain = 'physics' | 'neuroscience';
export type FoundationKnowledgeScale = 'global' | 'module' | 'concept' | 'mechanism' | 'task';
export type KnowledgeEdgeKind =
  | 'prerequisite'
  | 'explains'
  | 'analogy'
  | 'contrasts'
  | 'applies-to'
  | 'supports-cognition'
  | 'maps-to-curriculum'
  | 'maps-to-mistake';

export interface FoundationKnowledgeNode {
  key: string;
  label: string;
  domain: FoundationScienceDomain;
  domainLayer: 'foundation-science';
  scale: FoundationKnowledgeScale;
  summary: string;
  coreQuestion: string;
  prerequisites: string[];
  relatedCurriculumNodes: string[];
  relatedMistakePatterns: string[];
  keywords: string[];
  mediaPromptSeed: {
    visualMetaphor: string;
    gptImageStyle: string;
    seedanceStoryboard: string[];
  };
}

export interface FoundationKnowledgeEdge {
  source: string;
  target: string;
  kind: KnowledgeEdgeKind;
  rationale: string;
}

export interface MobiusSessionResponse {
  cycleId: string;
  sessionId: string;
  studentId: string;
  createdAt: string;
  cognitiveState: CognitiveState;
  errorProfile: ErrorRecord;
  strategyDecision: StrategyDecision;
  story: {
    sceneIntro: string;
    emotion: string;
    interactionPrompt: string;
    successScene: string;
    failureScene: string;
    visualStyle: string;
    knowledgeAction?: KnowledgeAction;
    strategyDecision: StrategyDecision;
  };
  video: {
    kind: 'video';
    status: 'queued' | 'processing' | 'ready' | 'failed';
    jobId?: string;
    playbackUrl?: string;
    providerJobId?: string;
    provider: 'seedance' | 'stub' | 'seedance-http';
    branchOutcome?: 'success' | 'failure';
  };
  nextActions: string[];
}

export interface MobiusStudentStateSummaryResponse {
  studentId: string;
  latestSnapshotAt?: string;
  totalSnapshots: number;
  totalSessions: number;
  interactionStats: {
    successCount: number;
    failureCount: number;
    lastOutcome?: 'success' | 'failure';
  };
  currentCognitiveState?: CognitiveState;
  recentPainPoints: string[];
  activeRules: string[];
  mistakeCategoryCounts: Partial<Record<MistakeCategory, number>>;
  recommendedSessionDefaults?: {
    grade?: string;
    targetScore?: number;
    painPoint: string;
    rule: string;
    previousState: CognitiveState;
    knowledgeActionId?: string;
    knowledgeActionType?: KnowledgeActionType;
  };
}

export interface MobiusMediaJobResponse {
  id: string;
  studentId: string;
  createdAt: string;
  updatedAt: string;
  provider: 'seedance' | 'stub' | 'seedance-http';
  providerJobId?: string;
  status: 'queued' | 'processing' | 'ready' | 'failed';
  playbackUrl?: string;
  errorMessage?: string;
}

export interface MobiusInteractionResolutionResponse {
  cycleId?: string;
  outcome: 'success' | 'failure';
  title: string;
  narration: string;
  coachMessage: string;
  nextActions: string[];
  strategyDecision: StrategyDecision;
  diagnosticThread?: SocraticThread;
  adjudication?: {
    outcome: 'success' | 'failure';
    rationale: string[];
  };
  video?: {
    kind: 'video';
    status: 'queued' | 'processing' | 'ready' | 'failed';
    jobId?: string;
    playbackUrl?: string;
    providerJobId?: string;
    provider: 'seedance' | 'stub' | 'seedance-http';
    branchOutcome?: 'success' | 'failure';
  };
}

const MOBIUS_API_BASE_URL = process.env.MOBIUS_API_BASE_URL || '';

export const resolveMobiusContent = async (
  payload: MobiusContentResolveRequest,
): Promise<MobiusContentResolveResponse> => {
  const response = await fetch(`${MOBIUS_API_BASE_URL}/api/mobius/content/resolve`, {
    method: 'POST',
    headers: await buildMobiusHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Mobius content resolve failed with status ${response.status}`);
  }

  return response.json() as Promise<MobiusContentResolveResponse>;
};

export const listFoundationKnowledgeNodes = async (
  query: { domain?: FoundationScienceDomain; keyword?: string } = {},
): Promise<{ items: FoundationKnowledgeNode[] }> => {
  const params = new URLSearchParams();
  if (query.domain) params.set('domain', query.domain);
  if (query.keyword) params.set('keyword', query.keyword);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${MOBIUS_API_BASE_URL}/api/mobius/content/foundation-science/nodes${suffix}`, {
    headers: await buildMobiusHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Foundation knowledge nodes request failed with status ${response.status}`);
  }

  return response.json() as Promise<{ items: FoundationKnowledgeNode[] }>;
};

export const listFoundationKnowledgeEdges = async (
  query: { domain?: FoundationScienceDomain; keyword?: string } = {},
): Promise<{ items: FoundationKnowledgeEdge[] }> => {
  const params = new URLSearchParams();
  if (query.domain) params.set('domain', query.domain);
  if (query.keyword) params.set('keyword', query.keyword);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${MOBIUS_API_BASE_URL}/api/mobius/content/foundation-science/edges${suffix}`, {
    headers: await buildMobiusHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Foundation knowledge edges request failed with status ${response.status}`);
  }

  return response.json() as Promise<{ items: FoundationKnowledgeEdge[] }>;
};

export const getFoundationKnowledgeNode = async (
  nodeKey: string,
): Promise<{ item: FoundationKnowledgeNode }> => {
  const response = await fetch(
    `${MOBIUS_API_BASE_URL}/api/mobius/content/foundation-science/nodes/${encodeURIComponent(nodeKey)}`,
    {
      headers: await buildMobiusHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error(`Foundation knowledge node request failed with status ${response.status}`);
  }

  return response.json() as Promise<{ item: FoundationKnowledgeNode }>;
};

export const analyzeQuestionImage = async (
  payload: AnalyzeQuestionImageRequest,
): Promise<AIQuestionData> => {
  const response = await fetch(`${MOBIUS_API_BASE_URL}/api/mobius/ai/analyze-question-image`, {
    method: 'POST',
    headers: await buildMobiusHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Analyze question image failed with status ${response.status}`);
  }

  return response.json() as Promise<AIQuestionData>;
};

export const generateCloneQuestion = async (
  payload: GenerateCloneQuestionRequest,
): Promise<AIQuestionData> => {
  const response = await fetch(`${MOBIUS_API_BASE_URL}/api/mobius/ai/clone-question`, {
    method: 'POST',
    headers: await buildMobiusHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Clone question failed with status ${response.status}`);
  }

  return response.json() as Promise<AIQuestionData>;
};

export const generateTheaterScript = async (
  payload: GenerateTheaterScriptRequest,
): Promise<TheaterScript> => {
  const response = await fetch(`${MOBIUS_API_BASE_URL}/api/mobius/ai/theater-script`, {
    method: 'POST',
    headers: await buildMobiusHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Generate theater script failed with status ${response.status}`);
  }

  return response.json() as Promise<TheaterScript>;
};

export const dehydrateHomework = async (
  payload: DehydrateHomeworkRequest,
): Promise<DehydrateResult> => {
  const response = await fetch(`${MOBIUS_API_BASE_URL}/api/mobius/ai/dehydrate-homework`, {
    method: 'POST',
    headers: await buildMobiusHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Dehydrate homework failed with status ${response.status}`);
  }

  return response.json() as Promise<DehydrateResult>;
};

export const createMobiusSession = async (
  payload: MobiusSessionRequest,
): Promise<MobiusSessionResponse> => {
  const response = await fetch(`${MOBIUS_API_BASE_URL}/api/mobius/sessions`, {
    method: 'POST',
    headers: await buildMobiusHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Mobius session request failed with status ${response.status}`);
  }

  return response.json() as Promise<MobiusSessionResponse>;
};

export const getMobiusStudentStateSummary = async (
  studentId: string,
): Promise<MobiusStudentStateSummaryResponse> => {
  const response = await fetch(`${MOBIUS_API_BASE_URL}/api/mobius/students/${studentId}/state-summary`, {
    headers: await buildMobiusHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Mobius state summary request failed with status ${response.status}`);
  }

  return response.json() as Promise<MobiusStudentStateSummaryResponse>;
};

export const refreshMobiusMediaJob = async (
  jobId: string,
): Promise<MobiusMediaJobResponse> => {
  const response = await fetch(`${MOBIUS_API_BASE_URL}/api/mobius/media-jobs/${jobId}/refresh`, {
    method: 'POST',
    headers: await buildMobiusHeaders({
      'Content-Type': 'application/json',
    }),
  });

  if (!response.ok) {
    throw new Error(`Mobius media job refresh failed with status ${response.status}`);
  }

  return response.json() as Promise<MobiusMediaJobResponse>;
};

export const resolveMobiusInteraction = async (
  jobId: string,
  payload: { outcome?: 'success' | 'failure'; actionType?: string; submission?: InteractionSubmission },
): Promise<MobiusInteractionResolutionResponse> => {
  const response = await fetch(`${MOBIUS_API_BASE_URL}/api/mobius/media-jobs/${jobId}/interactions`, {
    method: 'POST',
    headers: await buildMobiusHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Mobius interaction resolve failed with status ${response.status}`);
  }

  return response.json() as Promise<MobiusInteractionResolutionResponse>;
};

export const replySocraticThread = async (
  threadId: string,
  payload: { content: string },
): Promise<SocraticThread> => {
  const response = await fetch(`${MOBIUS_API_BASE_URL}/api/mobius/ai/socratic-diagnostic/threads/${threadId}/messages`, {
    method: 'POST',
    headers: await buildMobiusHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Socratic thread reply failed with status ${response.status}`);
  }

  return response.json() as Promise<SocraticThread>;
};

export const getKnowledgeGraph = async (
  studentId: string,
): Promise<KnowledgeGraphSnapshot> => {
  const response = await fetch(`${MOBIUS_API_BASE_URL}/api/mobius/students/${studentId}/knowledge-graph`, {
    headers: await buildMobiusHeaders(),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const payload = await response.json() as { error?: string };
      detail = payload.error ? `: ${payload.error}` : '';
    } catch {
      detail = '';
    }
    throw new Error(`Knowledge graph request failed with status ${response.status}${detail}`);
  }

  return response.json() as Promise<KnowledgeGraphSnapshot>;
};

export const listKnowledgeMapAssets = async (
  studentId: string,
): Promise<GeneratedKnowledgeMapAsset[]> => {
  const response = await fetch(`${MOBIUS_API_BASE_URL}/api/mobius/students/${studentId}/knowledge-map/assets`, {
    headers: await buildMobiusHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Knowledge map assets request failed with status ${response.status}`);
  }

  const payload = await response.json() as { items: GeneratedKnowledgeMapAsset[] };
  return payload.items;
};

export const generateKnowledgeMapAsset = async (
  studentId: string,
  payload: {
    kind: 'knowledge-map-bg' | 'node-card' | 'video-first-frame';
    nodeKey?: string;
    subject?: string;
    relatedErrors?: string[];
    force?: boolean;
  },
): Promise<GeneratedKnowledgeMapAsset> => {
  const response = await fetch(`${MOBIUS_API_BASE_URL}/api/mobius/students/${studentId}/knowledge-map/assets`, {
    method: 'POST',
    headers: await buildMobiusHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Knowledge map asset generation failed with status ${response.status}`);
  }

  return response.json() as Promise<GeneratedKnowledgeMapAsset>;
};

export const createKnowledgeNodeVideo = async (
  studentId: string,
  nodeKey: string,
  payload: {
    nodeLabel: string;
    domain?: FoundationScienceDomain;
    coreQuestion?: string;
    curriculumNode?: string;
    storyboardSeed?: string[];
    relatedConcepts?: string[];
    relatedErrors?: string[];
    firstFrameAssetId?: string;
    firstFrameUrl?: string;
  },
): Promise<MobiusMediaJobResponse> => {
  const response = await fetch(`${MOBIUS_API_BASE_URL}/api/mobius/students/${studentId}/knowledge-map/nodes/${encodeURIComponent(nodeKey)}/video`, {
    method: 'POST',
    headers: await buildMobiusHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Knowledge node video request failed with status ${response.status}`);
  }

  return response.json() as Promise<MobiusMediaJobResponse>;
};

export interface FoundationExplorationResponse {
  cycleId: string;
  studentId: string;
  nodeKey: string;
  outcome: 'success' | 'failure';
  cognitiveState: CognitiveState;
  stateVectorVersion?: string;
  nextActions: string[];
}

export const recordFoundationExploration = async (
  studentId: string,
  payload: {
    nodeKey: string;
    nodeLabel: string;
    domain: FoundationScienceDomain;
    coreQuestion: string;
    taskId: string;
    taskLabel: string;
    actionType: KnowledgeActionType;
    outcome: 'success' | 'failure';
    note?: string;
  },
): Promise<FoundationExplorationResponse> => {
  const response = await fetch(`${MOBIUS_API_BASE_URL}/api/mobius/students/${studentId}/foundation-science/explorations`, {
    method: 'POST',
    headers: await buildMobiusHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Foundation exploration record failed with status ${response.status}`);
  }

  return response.json() as Promise<FoundationExplorationResponse>;
};
