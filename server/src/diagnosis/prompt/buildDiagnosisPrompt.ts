import type {
  DiagnosisPromptBundle,
  DiagnosisPromptInput,
} from './diagnosisPromptTypes.js';

const MAX_INPUT_CHARS = 6000;
const MAX_FIELD_CHARS = 1200;

function truncateText(value: string | undefined, max = MAX_FIELD_CHARS) {
  if (!value) return '';
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function sanitize(value: string | undefined) {
  return truncateText(value)
    .replace(/\b\d{11}\b/g, '[REDACTED_PHONE]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]');
}

export function buildDiagnosisPrompt(
  input: DiagnosisPromptInput,
): DiagnosisPromptBundle {
  const { request } = input;

  const systemPrompt = [
    'You are an AI error diagnosis engine for a learner-sovereign education product.',
    'Your job is to diagnose the structure of a mistake, not judge the learner.',
    'Return JSON only.',
    'Do not include moral judgment, ranking, surveillance language, or parental/teacher reporting language.',
    'Focus on mistake structure, repair action, and next exploration node.',
  ].join('\n');

  const developerPrompt = [
    'Classify the mistake into exactly one mistakeKey.',
    'Allowed mistakeKey values:',
    '- context_misread',
    '- rule_mismatch',
    '- meaning_misunderstanding',
    '- conservation_missing',
    '- attention_distracted',
    '- repeated_same_mistake',
    '- feedback_loop_broken',
    '- unknown',
    '',
    'Return a confidence between 0 and 1.',
    'Recommend one primary exploration node and zero or more secondary nodes.',
    'Generate a repairAction and yufengSuggestion.',
    'Do not mention supervision, ranking, or external monitoring.',
  ].join('\n');

  const userPrompt = [
    'Diagnose this learning mistake.',
    '',
    `Subject: ${sanitize(request.subject)}`,
    `Grade: ${sanitize(request.grade)}`,
    '',
    `Question text: ${sanitize(request.questionText)}`,
    `Student answer: ${sanitize(request.studentAnswer)}`,
    `Correct answer: ${sanitize(request.correctAnswer)}`,
    `Pain point: ${sanitize(request.painPoint)}`,
    `Rule: ${sanitize(request.rule)}`,
    '',
    `Learning profile: ${JSON.stringify(input.context?.learningProfile ?? {})}`,
    '',
    `Available explore nodes: ${JSON.stringify(input.context?.availableExploreNodes ?? [])}`,
  ].join('\n').slice(0, MAX_INPUT_CHARS);

  return {
    systemPrompt,
    developerPrompt,
    userPrompt,
    outputSchema: {
      type: 'object',
      required: [
        'mistakeKey',
        'confidence',
        'summary',
        'fourLayerExplanation',
        'recommendedExploreNodes',
        'repairAction',
        'yufengSuggestion',
      ],
      properties: {
        mistakeKey: {
          type: 'string',
          enum: [
            'context_misread',
            'rule_mismatch',
            'meaning_misunderstanding',
            'conservation_missing',
            'attention_distracted',
            'repeated_same_mistake',
            'feedback_loop_broken',
            'unknown',
          ],
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
        },
        summary: {
          type: 'string',
        },
        fourLayerExplanation: {
          type: 'object',
        },
        recommendedExploreNodes: {
          type: 'object',
        },
        repairAction: {
          type: 'string',
        },
        yufengSuggestion: {
          type: 'string',
        },
      },
    },
    privacyNotes: [
      'Phone numbers and email-like strings are redacted.',
      'The prompt should not include learner identity unless explicitly needed.',
      'The output must avoid surveillance, ranking, and external reporting language.',
    ],
    costGuard: {
      maxInputChars: MAX_INPUT_CHARS,
      maxOutputTokens: 900,
      requireJsonOnly: true,
    },
  };
}
