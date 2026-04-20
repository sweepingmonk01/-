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
  previousState?: {
    focus?: number;
    frustration?: number;
    joy?: number;
    confidence?: number;
    fatigue?: number;
  };
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
}

export interface DehydrateResult {
  total: number;
  trashEasy: number;
  dropHard: number;
  mustDo: number;
  reasoning: string;
  mustDoIndices: string;
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

export interface MobiusSessionResponse {
  sessionId: string;
  studentId: string;
  createdAt: string;
  cognitiveState: {
    focus: number;
    frustration: number;
    joy: number;
    confidence: number;
    fatigue: number;
  };
  errorProfile: ErrorRecord;
  story: {
    sceneIntro: string;
    emotion: string;
    interactionPrompt: string;
    successScene: string;
    failureScene: string;
    visualStyle: string;
    knowledgeAction?: KnowledgeAction;
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
  currentCognitiveState?: {
    focus: number;
    frustration: number;
    joy: number;
    confidence: number;
    fatigue: number;
  };
  recentPainPoints: string[];
  activeRules: string[];
  mistakeCategoryCounts: Partial<Record<MistakeCategory, number>>;
  recommendedSessionDefaults?: {
    grade?: string;
    targetScore?: number;
    painPoint: string;
    rule: string;
    previousState: {
      focus: number;
      frustration: number;
      joy: number;
      confidence: number;
      fatigue: number;
    };
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
  outcome: 'success' | 'failure';
  title: string;
  narration: string;
  coachMessage: string;
  nextActions: string[];
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
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Mobius content resolve failed with status ${response.status}`);
  }

  return response.json() as Promise<MobiusContentResolveResponse>;
};

export const analyzeQuestionImage = async (
  payload: AnalyzeQuestionImageRequest,
): Promise<AIQuestionData> => {
  const response = await fetch(`${MOBIUS_API_BASE_URL}/api/mobius/ai/analyze-question-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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
    headers: {
      'Content-Type': 'application/json',
    },
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
    headers: {
      'Content-Type': 'application/json',
    },
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
    headers: {
      'Content-Type': 'application/json',
    },
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
    headers: {
      'Content-Type': 'application/json',
    },
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
  const response = await fetch(`${MOBIUS_API_BASE_URL}/api/mobius/students/${studentId}/state-summary`);

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
    headers: {
      'Content-Type': 'application/json',
    },
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
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Mobius interaction resolve failed with status ${response.status}`);
  }

  return response.json() as Promise<MobiusInteractionResolutionResponse>;
};
