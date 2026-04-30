import type { ExploreLearningProfile } from '../../explore/profile/exploreLearningProfileTypes';

export const AI_ERROR_DIAGNOSIS_SCHEMA_VERSION = 'ai-error-diagnosis-v0.1' as const;

export const AI_ERROR_DIAGNOSIS_MISTAKE_KEYS = [
  'context_misread',
  'rule_mismatch',
  'meaning_misunderstanding',
  'conservation_missing',
  'attention_distracted',
  'repeated_same_mistake',
  'feedback_loop_broken',
  'unknown',
] as const;

export type AIErrorDiagnosisSchemaVersion = typeof AI_ERROR_DIAGNOSIS_SCHEMA_VERSION;

export type AIErrorDiagnosisMistakeKey =
  (typeof AI_ERROR_DIAGNOSIS_MISTAKE_KEYS)[number];

export type AIErrorDiagnosisSubject =
  | 'zh'
  | 'ma'
  | 'en'
  | 'physics'
  | 'chemistry'
  | 'biology'
  | 'history'
  | 'geography'
  | 'unknown';

export interface AIErrorDiagnosisInput {
  questionText?: string;
  ocrText?: string;
  studentAnswer?: string;
  correctAnswer?: string;
  explanationText?: string;
  painPoint?: string;
  rule?: string;
  subject: AIErrorDiagnosisSubject;
  grade?: string;
}

export interface AIErrorDiagnosisRequest {
  schemaVersion: AIErrorDiagnosisSchemaVersion;
  errorInput: AIErrorDiagnosisInput;
  learningProfile?: ExploreLearningProfile;
  clientMeta: {
    appVersion: string;
    source: 'web' | 'server' | 'test';
    requestedAt?: string;
  };
}

export interface AIErrorDiagnosisResult {
  mistakeKey: AIErrorDiagnosisMistakeKey;
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

export type AIErrorDiagnosisErrorCode =
  | 'INVALID_SCHEMA_VERSION'
  | 'MISSING_CLIENT_META'
  | 'MISSING_DIAGNOSIS_INPUT'
  | 'MISSING_ERROR_INPUT'
  | 'MISSING_ERROR_CONTENT'
  | 'INVALID_SUBJECT'
  | 'HTTP_DIAGNOSIS_FAILED'
  | 'INVALID_DIAGNOSIS_RESPONSE'
  | 'INVALID_MISTAKE_KEY'
  | 'INVALID_CONFIDENCE'
  | 'MISSING_SUMMARY'
  | 'MISSING_FOUR_LAYER_EXPLANATION'
  | 'MISSING_RECOMMENDED_NODE'
  | 'INVALID_SECONDARY_NODES'
  | 'MISSING_REPAIR_ACTION'
  | 'MISSING_YUFENG_SUGGESTION';

export interface AIErrorDiagnosisErrorItem {
  code: AIErrorDiagnosisErrorCode;
  message: string;
  path?: string;
}

export interface AIErrorDiagnosisApiResponse {
  ok: boolean;
  diagnosedAt: string;
  result?: AIErrorDiagnosisResult;
  errors?: AIErrorDiagnosisErrorItem[];
  message?: string;
}

export type AIErrorDiagnosisResponse = AIErrorDiagnosisApiResponse;
