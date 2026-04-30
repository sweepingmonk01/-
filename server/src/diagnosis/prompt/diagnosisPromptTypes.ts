import type {
  AIErrorDiagnosisRequest,
  AIErrorDiagnosisResult,
} from '../errorDiagnosisTypes.js';

export interface DiagnosisPromptInput {
  request: AIErrorDiagnosisRequest;
  context?: {
    learningProfile?: {
      worldModelIndex?: number;
      mindModelIndex?: number;
      meaningModelIndex?: number;
      actionMechanismIndex?: number;
      activeStructuralIntelligence?: number;
      dominantWeakness?: string;
      stage?: string;
    };
    availableExploreNodes?: Array<{
      nodeKey: string;
      engineKey: string;
      label: string;
      summary?: string;
    }>;
  };
}

export interface DiagnosisPromptBundle {
  systemPrompt: string;
  developerPrompt: string;
  userPrompt: string;
  outputSchema: DiagnosisOutputSchema;
  privacyNotes: string[];
  costGuard: {
    maxInputChars: number;
    maxOutputTokens: number;
    requireJsonOnly: boolean;
  };
}

export interface DiagnosisOutputSchema {
  type: 'object';
  required: string[];
  properties: Record<string, unknown>;
}

export interface ParsedDiagnosisModelOutput {
  mistakeKey: AIErrorDiagnosisResult['mistakeKey'];
  confidence: number;
  summary: string;
  fourLayerExplanation: AIErrorDiagnosisResult['fourLayerExplanation'];
  recommendedExploreNodes: AIErrorDiagnosisResult['recommendedExploreNodes'];
  repairAction: string;
  yufengSuggestion: string;
}
