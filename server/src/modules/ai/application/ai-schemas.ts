import { z } from 'zod';

const normalizeText = (value: string, maxLength: number) => value.trim().replace(/\s+/g, ' ').slice(0, maxLength);

const normalizedString = (maxLength: number, label: string) =>
  z.string().transform((value, ctx) => {
    const normalized = normalizeText(value, maxLength);

    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label} is required.`,
      });
      return z.NEVER;
    }

    return normalized;
  });

const optionalNormalizedString = (maxLength: number) =>
  z
    .string()
    .transform((value) => normalizeText(value, maxLength))
    .optional()
    .transform((value) => (value ? value : undefined));

const normalizeStringList = (items: string[], itemMaxLength: number, maxItems: number) => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of items) {
    const next = normalizeText(item, itemMaxLength);
    if (!next || seen.has(next)) continue;
    seen.add(next);
    normalized.push(next);
    if (normalized.length >= maxItems) break;
  }

  return normalized;
};

const normalizedStringList = (label: string, itemMaxLength: number, maxItems: number) =>
  z.array(z.string()).transform((items, ctx) => {
    const normalized = normalizeStringList(items, itemMaxLength, maxItems);
    if (!normalized.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label} must contain at least one item.`,
      });
      return z.NEVER;
    }

    return normalized;
  });

const imageMimeTypeSchema = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.string().regex(/^image\/[a-zA-Z0-9.+-]+$/, 'mimeType must be a valid image mime type.'));

export const analyzeQuestionImageRequestSchema = z.object({
  imageBase64: normalizedString(6_000_000, 'imageBase64'),
  mimeType: imageMimeTypeSchema,
});

export const generateCloneQuestionRequestSchema = z.object({
  painPoint: normalizedString(240, 'painPoint'),
  rule: normalizedString(240, 'rule'),
  questionText: normalizedString(4_000, 'questionText'),
});

export const generateTheaterScriptRequestSchema = z.object({
  painPoint: normalizedString(240, 'painPoint'),
  rule: normalizedString(240, 'rule'),
});

export const strategicContextSchema = z.object({
  recentPainPoints: z.array(z.string()).optional().default([]).transform((items) => normalizeStringList(items, 240, 12)),
  activeRules: z.array(z.string()).optional().default([]).transform((items) => normalizeStringList(items, 240, 12)),
  activeErrorSummaries: z.array(z.string()).optional().default([]).transform((items) => normalizeStringList(items, 320, 12)),
  weakTopicAlerts: z.array(z.string()).optional().default([]).transform((items) => normalizeStringList(items, 240, 12)),
  graphHotspots: z.array(z.string()).optional().default([]).transform((items) => normalizeStringList(items, 240, 8)),
  graphNeighborSignals: z.array(z.string()).optional().default([]).transform((items) => normalizeStringList(items, 240, 8)),
  interactionFailureCount: z.number().optional().default(0).transform((value) => Math.max(0, Math.round(value))),
  interactionSuccessCount: z.number().optional().default(0).transform((value) => Math.max(0, Math.round(value))),
});

export const dehydrateHomeworkRequestSchema = z.object({
  imageBase64: normalizedString(6_000_000, 'imageBase64'),
  mimeType: imageMimeTypeSchema,
  targetScore: z.number().finite().transform((value) => Math.round(value)).pipe(z.number().int().min(1).max(150)),
  studentId: optionalNormalizedString(128),
  strategicContext: strategicContextSchema.optional(),
});

const aiQuestionDataBaseSchema = z.object({
  painPoint: normalizedString(240, 'painPoint'),
  rule: normalizedString(240, 'rule'),
  questionText: normalizedString(4_000, 'questionText'),
  options: z.array(z.string()),
  correctAnswer: normalizedString(320, 'correctAnswer'),
});

export const aiQuestionDataSchema = aiQuestionDataBaseSchema.transform((value, ctx) => {
  const options = normalizeStringList(value.options, 320, 4);
  if (options.length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'options must contain at least two unique entries.',
    });
    return z.NEVER;
  }

  if (!options.includes(value.correctAnswer)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'correctAnswer must match one of the options.',
    });
    return z.NEVER;
  }

  return {
    painPoint: value.painPoint,
    rule: value.rule,
    questionText: value.questionText,
    options,
    correctAnswer: value.correctAnswer,
  };
});

const emotionValues = ['calm', 'focused', 'encouraging', 'protective', 'urgent'] as const;

export const theaterScriptSchema = z.object({
  sceneIntro: normalizedString(600, 'sceneIntro'),
  emotion: z.string().transform((value) => {
    const normalized = normalizeText(value, 32).toLowerCase();
    return emotionValues.includes(normalized as (typeof emotionValues)[number]) ? normalized : 'focused';
  }),
  interactionPrompt: normalizedString(320, 'interactionPrompt'),
  successScene: normalizedString(600, 'successScene'),
  failureScene: normalizedString(600, 'failureScene'),
});

const questionPlanSchema = z.object({
  questionLabel: normalizedString(64, 'questionLabel'),
  topic: normalizedString(160, 'topic'),
  action: z.enum(['attack', 'review', 'skip']),
  estimatedMinutes: z.number().finite().transform((value) => Math.max(1, Math.min(180, Math.round(value)))),
  roiScore: z.number().finite().transform((value) => Math.max(0, Math.min(100, Math.round(value)))),
  rationale: normalizedString(320, 'rationale'),
  extractedKnowledgePoint: normalizedString(200, 'extractedKnowledgePoint'),
});

export const dehydrateResultSchema = z.object({
  total: z.number().finite().transform((value) => Math.max(0, Math.round(value))),
  trashEasy: z.number().finite().transform((value) => Math.max(0, Math.round(value))),
  dropHard: z.number().finite().transform((value) => Math.max(0, Math.round(value))),
  mustDo: z.number().finite().transform((value) => Math.max(0, Math.round(value))),
  mustDoIndices: normalizedString(200, 'mustDoIndices'),
  reasoning: normalizedString(600, 'reasoning'),
  strategicPlan: z
    .object({
      commanderBriefing: normalizedString(600, 'commanderBriefing'),
      immediateOrder: normalizedString(320, 'immediateOrder'),
      focusKnowledgePoints: normalizedStringList('focusKnowledgePoints', 160, 8),
      weakTopicAlerts: z.array(z.string()).optional().default([]).transform((items) => normalizeStringList(items, 240, 8)),
      attackQuestions: z.array(z.string()).optional().default([]).transform((items) => normalizeStringList(items, 64, 12)),
      reviewQuestions: z.array(z.string()).optional().default([]).transform((items) => normalizeStringList(items, 64, 12)),
      skipQuestions: z.array(z.string()).optional().default([]).transform((items) => normalizeStringList(items, 64, 12)),
      questionPlans: z.array(questionPlanSchema).optional().default([]).transform((items) => items.slice(0, 24)),
    })
    .optional(),
}).superRefine((value, ctx) => {
  if (value.mustDo > value.total) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'mustDo cannot exceed total.',
      path: ['mustDo'],
    });
  }

  if (value.trashEasy + value.dropHard + value.mustDo > value.total) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'dehydrate counts exceed total question count.',
    });
  }
});

export const createSocraticThreadRequestSchema = z.object({
  studentId: optionalNormalizedString(128),
  cycleId: optionalNormalizedString(128),
  jobId: optionalNormalizedString(128),
  painPoint: normalizedString(240, 'painPoint'),
  rule: optionalNormalizedString(240),
  rationale: z.array(z.string()).optional().default([]).transform((items) => normalizeStringList(items, 240, 6)),
  failureNarration: optionalNormalizedString(600),
});

export const replySocraticThreadRequestSchema = z.object({
  content: normalizedString(220, 'content'),
});

export const knowledgeGraphEntityExtractionSchema = z.object({
  entities: normalizedStringList('entities', 120, 6),
});

export const socraticTurnSchema = z.string().transform((value, ctx) => {
  const normalized = normalizeText(value, 220);
  if (!normalized) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Socratic turn response was empty.',
    });
    return z.NEVER;
  }

  return normalized;
});

export const formatSchemaError = (prefix: string, error: z.ZodError) => {
  const detail = error.issues[0]?.message ?? 'Invalid payload.';
  return `${prefix}: ${detail}`;
};
