export type AIErrorMistakeKey =
  | 'context_misread'
  | 'rule_mismatch'
  | 'meaning_misunderstanding'
  | 'conservation_missing'
  | 'attention_distracted'
  | 'repeated_same_mistake'
  | 'feedback_loop_broken'
  | 'unknown';

export interface AIErrorDiagnosisRequest {
  questionText?: string;
  studentAnswer?: string;
  correctAnswer?: string;
  subject?: string;
  grade?: string;
  painPoint?: string;
  rule?: string;
}

export interface AIErrorDiagnosisResult {
  mistakeKey: AIErrorMistakeKey;
  confidence: number;
  summary: string;
  fourLayerExplanation: {
    curriculum: string;
    worldEngine: string;
    mindEngine: string;
    meaningEngine: string;
    gameMechanism: string;
  };
  recommendedExploreNodes: {
    primaryNodeKey: string;
    secondaryNodeKeys: string[];
  };
  repairAction: string;
  yufengSuggestion: string;
}

export interface AIErrorDiagnosisErrorItem {
  code: 'MISSING_DIAGNOSIS_INPUT';
  message: string;
  path: string;
}
