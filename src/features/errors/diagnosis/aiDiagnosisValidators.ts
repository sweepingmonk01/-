import {
  AI_ERROR_DIAGNOSIS_MISTAKE_KEYS,
  AI_ERROR_DIAGNOSIS_SCHEMA_VERSION,
  type AIErrorDiagnosisApiResponse,
  type AIErrorDiagnosisErrorItem,
  type AIErrorDiagnosisMistakeKey,
  type AIErrorDiagnosisRequest,
  type AIErrorDiagnosisResult,
  type AIErrorDiagnosisSubject,
} from './aiDiagnosisTypes';

export interface AIErrorDiagnosisValidationResult {
  ok: boolean;
  errors: AIErrorDiagnosisErrorItem[];
}

const validSubjects: AIErrorDiagnosisSubject[] = [
  'zh',
  'ma',
  'en',
  'physics',
  'chemistry',
  'biology',
  'history',
  'geography',
  'unknown',
];

const requiredExplanationKeys: Array<keyof AIErrorDiagnosisResult['fourLayerExplanation']> = [
  'curriculum',
  'worldEngine',
  'mindEngine',
  'meaningEngine',
  'gameMechanism',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isMistakeKey(value: unknown): value is AIErrorDiagnosisMistakeKey {
  return (
    typeof value === 'string' &&
    AI_ERROR_DIAGNOSIS_MISTAKE_KEYS.includes(value as AIErrorDiagnosisMistakeKey)
  );
}

export function validateAIErrorDiagnosisRequest(
  request: AIErrorDiagnosisRequest,
): AIErrorDiagnosisValidationResult {
  const errors: AIErrorDiagnosisErrorItem[] = [];

  if (!isRecord(request)) {
    return {
      ok: false,
      errors: [
        {
          code: 'MISSING_ERROR_INPUT',
          message: 'Diagnosis request is required.',
          path: 'request',
        },
      ],
    };
  }

  if (request.schemaVersion !== AI_ERROR_DIAGNOSIS_SCHEMA_VERSION) {
    errors.push({
      code: 'INVALID_SCHEMA_VERSION',
      message: `Expected schemaVersion ${AI_ERROR_DIAGNOSIS_SCHEMA_VERSION}.`,
      path: 'schemaVersion',
    });
  }

  if (!isRecord(request.clientMeta)) {
    errors.push({
      code: 'MISSING_CLIENT_META',
      message: 'clientMeta is required.',
      path: 'clientMeta',
    });
  }

  if (!isRecord(request.errorInput)) {
    errors.push({
      code: 'MISSING_ERROR_INPUT',
      message: 'errorInput is required.',
      path: 'errorInput',
    });

    return {
      ok: false,
      errors,
    };
  }

  const hasContent = [
    request.errorInput.questionText,
    request.errorInput.ocrText,
    request.errorInput.studentAnswer,
    request.errorInput.explanationText,
  ].some(isNonEmptyString);

  if (!hasContent) {
    errors.push({
      code: 'MISSING_ERROR_CONTENT',
      message: 'Provide questionText, ocrText, studentAnswer, or explanationText.',
      path: 'errorInput',
    });
  }

  if (!validSubjects.includes(request.errorInput.subject)) {
    errors.push({
      code: 'INVALID_SUBJECT',
      message: 'errorInput.subject is not supported by the v0.1 contract.',
      path: 'errorInput.subject',
    });
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function validateAIErrorDiagnosisResult(
  result: AIErrorDiagnosisResult,
): AIErrorDiagnosisValidationResult {
  const errors: AIErrorDiagnosisErrorItem[] = [];

  if (!isRecord(result)) {
    return {
      ok: false,
      errors: [
        {
          code: 'INVALID_MISTAKE_KEY',
          message: 'Diagnosis result is required.',
          path: 'result',
        },
      ],
    };
  }

  if (!isMistakeKey(result.mistakeKey)) {
    errors.push({
      code: 'INVALID_MISTAKE_KEY',
      message: 'result.mistakeKey is not supported by the v0.1 contract.',
      path: 'result.mistakeKey',
    });
  }

  if (!Number.isFinite(result.confidence) || result.confidence < 0 || result.confidence > 1) {
    errors.push({
      code: 'INVALID_CONFIDENCE',
      message: 'result.confidence must be a number between 0 and 1.',
      path: 'result.confidence',
    });
  }

  if (!isNonEmptyString(result.summary)) {
    errors.push({
      code: 'MISSING_SUMMARY',
      message: 'result.summary is required.',
      path: 'result.summary',
    });
  }

  if (!isRecord(result.fourLayerExplanation)) {
    errors.push({
      code: 'MISSING_FOUR_LAYER_EXPLANATION',
      message: 'result.fourLayerExplanation is required.',
      path: 'result.fourLayerExplanation',
    });
  } else {
    for (const key of requiredExplanationKeys) {
      if (!isNonEmptyString(result.fourLayerExplanation[key])) {
        errors.push({
          code: 'MISSING_FOUR_LAYER_EXPLANATION',
          message: `result.fourLayerExplanation.${key} is required.`,
          path: `result.fourLayerExplanation.${key}`,
        });
      }
    }
  }

  if (!isNonEmptyString(result.recommendedExploreNodes?.primaryNodeKey)) {
    errors.push({
      code: 'MISSING_RECOMMENDED_NODE',
      message: 'result.recommendedExploreNodes.primaryNodeKey is required.',
      path: 'result.recommendedExploreNodes.primaryNodeKey',
    });
  }

  if (!Array.isArray(result.recommendedExploreNodes?.secondaryNodeKeys)) {
    errors.push({
      code: 'INVALID_SECONDARY_NODES',
      message: 'result.recommendedExploreNodes.secondaryNodeKeys must be an array.',
      path: 'result.recommendedExploreNodes.secondaryNodeKeys',
    });
  }

  if (!isNonEmptyString(result.repairAction)) {
    errors.push({
      code: 'MISSING_REPAIR_ACTION',
      message: 'result.repairAction is required.',
      path: 'result.repairAction',
    });
  }

  if (!isNonEmptyString(result.yufengSuggestion)) {
    errors.push({
      code: 'MISSING_YUFENG_SUGGESTION',
      message: 'result.yufengSuggestion is required.',
      path: 'result.yufengSuggestion',
    });
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function validateAIErrorDiagnosisApiResponse(
  response: AIErrorDiagnosisApiResponse,
): AIErrorDiagnosisValidationResult {
  const errors: AIErrorDiagnosisErrorItem[] = [];

  if (!isRecord(response)) {
    return {
      ok: false,
      errors: [
        {
          code: 'MISSING_ERROR_INPUT',
          message: 'Diagnosis response is required.',
          path: 'response',
        },
      ],
    };
  }

  if (!isNonEmptyString(response.diagnosedAt)) {
    errors.push({
      code: 'MISSING_ERROR_CONTENT',
      message: 'response.diagnosedAt is required.',
      path: 'diagnosedAt',
    });
  }

  if (response.ok) {
    const resultValidation = validateAIErrorDiagnosisResult(
      response.result as AIErrorDiagnosisResult,
    );

    return {
      ok: errors.length === 0 && resultValidation.ok,
      errors: [...errors, ...resultValidation.errors],
    };
  }

  if (!Array.isArray(response.errors) || response.errors.length === 0) {
    errors.push({
      code: 'MISSING_ERROR_CONTENT',
      message: 'Failure responses must include at least one error item.',
      path: 'errors',
    });
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export const validateAIErrorDiagnosisResponse = validateAIErrorDiagnosisApiResponse;
