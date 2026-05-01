import type { ParsedDiagnosisModelOutput } from './diagnosisPromptTypes.js';

const mistakeKeys = new Set([
  'context_misread',
  'rule_mismatch',
  'meaning_misunderstanding',
  'conservation_missing',
  'attention_distracted',
  'repeated_same_mistake',
  'feedback_loop_broken',
  'unknown',
]);

const fourLayerExplanationKeys = [
  'curriculum',
  'worldEngine',
  'mindEngine',
  'meaningEngine',
  'gameMechanism',
] as const;

export interface DiagnosisPromptValidationResult {
  ok: boolean;
  errors: Array<{
    code: string;
    message: string;
    path?: string;
  }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateParsedDiagnosisModelOutput(
  output: unknown,
): DiagnosisPromptValidationResult {
  const errors: DiagnosisPromptValidationResult['errors'] = [];

  if (!isRecord(output)) {
    return {
      ok: false,
      errors: [
        {
          code: 'INVALID_MODEL_OUTPUT',
          message: 'Model output must be an object.',
          path: 'output',
        },
      ],
    };
  }

  const data = output as Partial<ParsedDiagnosisModelOutput>;

  if (!data.mistakeKey || !mistakeKeys.has(data.mistakeKey)) {
    errors.push({
      code: 'INVALID_MISTAKE_KEY',
      message: 'mistakeKey is missing or invalid.',
      path: 'mistakeKey',
    });
  }

  if (
    typeof data.confidence !== 'number' ||
    data.confidence < 0 ||
    data.confidence > 1
  ) {
    errors.push({
      code: 'INVALID_CONFIDENCE',
      message: 'confidence must be a number between 0 and 1.',
      path: 'confidence',
    });
  }

  if (!isNonEmptyString(data.summary)) {
    errors.push({
      code: 'MISSING_SUMMARY',
      message: 'summary is required.',
      path: 'summary',
    });
  }

  if (!isRecord(data.fourLayerExplanation)) {
    errors.push({
      code: 'MISSING_FOUR_LAYER_EXPLANATION',
      message: 'fourLayerExplanation is required.',
      path: 'fourLayerExplanation',
    });
  } else {
    for (const key of fourLayerExplanationKeys) {
      if (!isNonEmptyString(data.fourLayerExplanation[key])) {
        errors.push({
          code: 'MISSING_FOUR_LAYER_EXPLANATION',
          message: `fourLayerExplanation.${key} is required.`,
          path: `fourLayerExplanation.${key}`,
        });
      }
    }
  }

  if (!isNonEmptyString(data.recommendedExploreNodes?.primaryNodeKey)) {
    errors.push({
      code: 'MISSING_PRIMARY_NODE',
      message: 'recommendedExploreNodes.primaryNodeKey is required.',
      path: 'recommendedExploreNodes.primaryNodeKey',
    });
  }

  if (!Array.isArray(data.recommendedExploreNodes?.secondaryNodeKeys)) {
    errors.push({
      code: 'INVALID_SECONDARY_NODES',
      message: 'recommendedExploreNodes.secondaryNodeKeys must be an array.',
      path: 'recommendedExploreNodes.secondaryNodeKeys',
    });
  }

  if (!isNonEmptyString(data.repairAction)) {
    errors.push({
      code: 'MISSING_REPAIR_ACTION',
      message: 'repairAction is required.',
      path: 'repairAction',
    });
  }

  if (!isNonEmptyString(data.yufengSuggestion)) {
    errors.push({
      code: 'MISSING_YUFENG_SUGGESTION',
      message: 'yufengSuggestion is required.',
      path: 'yufengSuggestion',
    });
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
