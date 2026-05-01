import type { StudentStateVector } from '../../student-state/domain/types.js';

export interface AnalyzeQuestionImageInput {
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

export interface GenerateCloneQuestionInput {
  painPoint: string;
  rule: string;
  questionText: string;
}

export interface GenerateTheaterScriptInput {
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

export interface DehydrateHomeworkInput {
  imageBase64: string;
  mimeType: string;
  targetScore: number;
  studentId?: string;
  strategicContext?: {
    recentPainPoints: string[];
    activeRules: string[];
    activeErrorSummaries: string[];
    weakTopicAlerts: string[];
    graphHotspots?: string[];
    graphNeighborSignals?: string[];
    interactionFailureCount: number;
    interactionSuccessCount: number;
  };
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

export interface HypothesisSummary {
  source: 'heuristic-v1';
  generatedAt: string;
  candidates: HypothesisCandidate[];
  selectedHypothesis?: HypothesisCandidate;
  selectedProbeAction?: ProbeAction;
  selectedIntervention?: HypothesisIntervention;
  lastUpdate?: HypothesisUpdateResult;
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

export interface GenerateSocraticTurnInput {
  painPoint: string;
  rule?: string;
  rationale?: string[];
  messages: SocraticMessage[];
  studentStateVector?: Pick<StudentStateVector, 'version' | 'cognitive' | 'sessionContext' | 'recentPainPoints' | 'activeRules'>;
  hypothesisSummary?: HypothesisSummary;
  graphDecisionContext?: KnowledgeGraphDecisionContext;
}

export interface KnowledgeGraphEntityExtractionInput {
  studentId: string;
  painPoint: string;
  rule: string;
  questionText?: string;
}

export interface KnowledgeGraphEntityExtraction {
  entities: string[];
}

export type AgentJobType = 'graph-weave-error-record' | 'socratic-opening-turn';
export type AgentJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface GraphWeaveJobPayload {
  studentId: string;
  errorRecord: {
    id: string;
    painPoint: string;
    rule: string;
    questionText: string;
    options: string[];
    status: 'active' | 'resolved';
    createdAt: string;
    updatedAt: string;
  };
}

export interface SocraticOpeningTurnJobPayload {
  threadId: string;
  studentId: string;
  painPoint: string;
  rule?: string;
  rationale?: string[];
  failureNarration?: string;
}

export type AgentJobPayload = GraphWeaveJobPayload | SocraticOpeningTurnJobPayload;

export interface AgentJobRecord<TPayload extends AgentJobPayload = AgentJobPayload> {
  id: string;
  jobType: AgentJobType;
  studentId: string;
  status: AgentJobStatus;
  idempotencyKey: string;
  attempts: number;
  maxAttempts: number;
  payload: TPayload;
  lastError?: string;
  availableAt: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
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
