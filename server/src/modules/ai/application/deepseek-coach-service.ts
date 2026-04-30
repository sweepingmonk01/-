import type { ZodType } from 'zod';
import {
  aiQuestionDataSchema,
  dehydrateResultSchema,
  knowledgeGraphEntityExtractionSchema,
  socraticTurnSchema,
  theaterScriptSchema,
} from './ai-schemas.js';
import type {
  AIQuestionData,
  AnalyzeQuestionImageInput,
  DehydrateHomeworkInput,
  DehydrateResult,
  GenerateCloneQuestionInput,
  GenerateSocraticTurnInput,
  KnowledgeGraphEntityExtraction,
  KnowledgeGraphEntityExtractionInput,
  GenerateTheaterScriptInput,
  TheaterScript,
} from '../domain/types.js';

type DeepSeekMessageContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    >;

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: DeepSeekMessageContent;
}

interface DeepSeekCoachServiceOptions {
  apiKey: string;
  baseUrl?: string;
  flashModel?: string;
  proModel?: string;
  reasoningEffort?: 'low' | 'medium' | 'high';
  thinkingEnabled?: boolean;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  fetchImpl?: typeof fetch;
}

interface ChatCompletionOptions {
  messages: DeepSeekMessage[];
  json?: boolean;
  modelTier?: 'flash' | 'pro';
}

interface DeepSeekChatResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
}

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 1;
const DEFAULT_RETRY_BASE_DELAY_MS = 350;
const RETRYABLE_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

const imageDataUrl = (input: Pick<AnalyzeQuestionImageInput, 'imageBase64' | 'mimeType'>) =>
  `data:${input.mimeType};base64,${input.imageBase64}`;

export class DeepSeekProviderError extends Error {
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(message: string, options: { statusCode?: number; retryable?: boolean } = {}) {
    super(message);
    this.name = 'DeepSeekProviderError';
    this.statusCode = options.statusCode ?? 502;
    this.retryable = options.retryable ?? false;
  }
}

export class DeepSeekCoachService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly flashModel: string;
  private readonly proModel: string;
  private readonly reasoningEffort: 'low' | 'medium' | 'high';
  private readonly thinkingEnabled: boolean;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: DeepSeekCoachServiceOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = stripTrailingSlash(options.baseUrl || 'https://api.deepseek.com');
    this.flashModel = options.flashModel || 'deepseek-v4-flash';
    this.proModel = options.proModel || 'deepseek-v4-pro';
    this.reasoningEffort = options.reasoningEffort || 'high';
    this.thinkingEnabled = options.thinkingEnabled ?? true;
    this.timeoutMs = Math.max(1000, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    this.maxRetries = Math.max(0, Math.min(3, options.maxRetries ?? DEFAULT_MAX_RETRIES));
    this.retryBaseDelayMs = Math.max(50, options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async analyzeQuestionImage(input: AnalyzeQuestionImageInput): Promise<AIQuestionData> {
    const text = await this.createChatCompletion({
      json: true,
      modelTier: 'pro',
      messages: [
        {
          role: 'system',
          content: [
            'You are an expert tutor. Analyze the uploaded exam-question screenshot or photo.',
            'Return JSON only. Do not use Markdown.',
            'The JSON must contain: painPoint, rule, questionText, options, correctAnswer.',
            'options must contain exactly 4 plausible educational options. correctAnswer must exactly match one option.',
          ].join(' '),
        },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageDataUrl(input) } },
            { type: 'text', text: 'Analyze this exam question image and return the required JSON object.' },
          ],
        },
      ],
    });

    return this.parseJsonResponse(text, aiQuestionDataSchema);
  }

  async generateCloneQuestion(input: GenerateCloneQuestionInput): Promise<AIQuestionData> {
    const text = await this.createChatCompletion({
      json: true,
      modelTier: 'flash',
      messages: [
        {
          role: 'system',
          content: 'Generate tutoring content as strict JSON only. Required keys: painPoint, rule, questionText, options, correctAnswer.',
        },
        {
          role: 'user',
          content: `I have a student struggling with the concept "${input.painPoint}". The rule they need to remember is "${input.rule}". The original question was "${input.questionText}". Generate a NEW, unique similar question testing the exact same rule, but with different numbers, words, or contexts. Return exactly 4 options and set correctAnswer to one exact option string.`,
        },
      ],
    });

    return this.parseJsonResponse(text, aiQuestionDataSchema);
  }

  async generateTheaterScript(input: GenerateTheaterScriptInput): Promise<TheaterScript> {
    const text = await this.createChatCompletion({
      json: true,
      modelTier: 'flash',
      messages: [
        {
          role: 'system',
          content: 'Return strict JSON only. Required keys: sceneIntro, emotion, interactionPrompt, successScene, failureScene.',
        },
        {
          role: 'user',
          content: `I need a short Manga/Interactive theater script for a student struggling with "${input.painPoint}". The core rule to learn is "${input.rule}". Use a cyberpunk or sci-fi action tone. emotion must be one of calm, focused, encouraging, protective, urgent.`,
        },
      ],
    });

    return this.parseJsonResponse(text, theaterScriptSchema) as TheaterScript;
  }

  async dehydrateHomework(input: DehydrateHomeworkInput): Promise<DehydrateResult> {
    const text = await this.createChatCompletion({
      json: true,
      modelTier: 'pro',
      messages: [
        {
          role: 'system',
          content: [
            'You are the ROI strategic planner for school homework.',
            'Analyze the whole uploaded page and return strict JSON only.',
            'Required top-level keys: total, trashEasy, dropHard, mustDo, mustDoIndices, reasoning, strategicPlan.',
            'strategicPlan keys: commanderBriefing, immediateOrder, focusKnowledgePoints, weakTopicAlerts, attackQuestions, reviewQuestions, skipQuestions, questionPlans.',
            'Each questionPlans item needs questionLabel, topic, action, estimatedMinutes, roiScore, rationale, extractedKnowledgePoint.',
          ].join(' '),
        },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageDataUrl(input) } },
            {
              type: 'text',
              text: `Analyze this entire page of school homework. The student's target score is ${input.targetScore}/150. They want maximum efficiency, not perfection. Count all questions and categorize them as Trash/Too Easy, Drop/Too Hard, or Must Do. Student weak-topic context: ${JSON.stringify(input.strategicContext ?? {
                recentPainPoints: [],
                activeRules: [],
                activeErrorSummaries: [],
                weakTopicAlerts: [],
                interactionFailureCount: 0,
                interactionSuccessCount: 0,
              })}.`,
            },
          ],
        },
      ],
    });

    return this.parseJsonResponse(text, dehydrateResultSchema) as DehydrateResult;
  }

  async strategicPlanHomework(input: DehydrateHomeworkInput): Promise<DehydrateResult> {
    return this.dehydrateHomework(input);
  }

  async generateSocraticTurn(input: GenerateSocraticTurnInput): Promise<string> {
    const text = await this.createChatCompletion({
      modelTier: 'flash',
      messages: [
        {
          role: 'system',
          content: 'You are a severe but committed cyber tutor running a Socratic diagnostic loop. Return one concise assistant message in Chinese. Do not reveal the full answer.',
        },
        {
          role: 'user',
          content: `The student's pain point is "${input.painPoint}". The rule they should have triggered is "${input.rule ?? 'unknown'}". Known rationale from the previous failure: ${JSON.stringify(input.rationale ?? [])}.
Current state vector context: ${JSON.stringify(input.studentStateVector ?? null)}.
Structured hypothesis context: ${JSON.stringify(input.hypothesisSummary ?? null)}.
Conversation so far: ${JSON.stringify(input.messages)}.
Prefer the highest-confidence hypothesis and its probe action. Ask a sharp follow-up question that narrows the student's exact cognitive break. If enough evidence has surfaced, ask them to restate the correct first step in one sentence.`,
        },
      ],
    });

    return socraticTurnSchema.parse(text || '你的选择触发了系统警报。告诉我：你刚才第一步到底看漏了什么？');
  }

  async extractKnowledgeGraphEntities(input: KnowledgeGraphEntityExtractionInput): Promise<KnowledgeGraphEntityExtraction> {
    const text = await this.createChatCompletion({
      json: true,
      modelTier: 'flash',
      messages: [
        {
          role: 'system',
          content: 'Extract compact learning entities from a student error. Return strict JSON only with key entities, an array of 3 to 6 strings.',
        },
        {
          role: 'user',
          content: `painPoint: ${input.painPoint}
rule: ${input.rule}
questionText: ${input.questionText ?? ''}`,
        },
      ],
    });

    return this.parseJsonResponse(text, knowledgeGraphEntityExtractionSchema) as KnowledgeGraphEntityExtraction;
  }

  private async createChatCompletion(options: ChatCompletionOptions): Promise<string> {
    const model = options.modelTier === 'pro' ? this.proModel : this.flashModel;
    const thinkingEnabled = options.modelTier === 'pro' && this.thinkingEnabled;
    const requestBody = JSON.stringify({
      model,
      messages: options.messages,
      ...(options.json ? { response_format: { type: 'json_object' } } : {}),
      ...(thinkingEnabled ? { thinking: { type: 'enabled' }, reasoning_effort: this.reasoningEffort } : {}),
      stream: false,
    });
    let lastError: DeepSeekProviderError | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const response = await this.fetchWithTimeout(requestBody);
        const payload = (await response.json().catch(() => null)) as DeepSeekChatResponse | null;

        if (!response.ok) {
          const retryable = RETRYABLE_STATUS_CODES.has(response.status);
          throw new DeepSeekProviderError(
            `DeepSeek request failed with status ${response.status}: ${this.safeProviderMessage(payload?.error?.message ?? response.statusText)}`,
            { statusCode: response.status === 429 ? 429 : 502, retryable },
          );
        }

        const content = payload?.choices?.[0]?.message?.content;
        if (!content) {
          throw new DeepSeekProviderError('DeepSeek returned an empty response.', { statusCode: 502, retryable: true });
        }

        return content;
      } catch (error) {
        lastError = this.normalizeError(error);
        if (!lastError.retryable || attempt >= this.maxRetries) break;
        await this.sleep(this.retryBaseDelayMs * (attempt + 1));
      }
    }

    throw lastError ?? new DeepSeekProviderError('DeepSeek request failed.', { statusCode: 502, retryable: true });
  }

  private async fetchWithTimeout(body: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalizeError(error: unknown): DeepSeekProviderError {
    if (error instanceof DeepSeekProviderError) return error;
    if (error instanceof Error && error.name === 'AbortError') {
      return new DeepSeekProviderError('DeepSeek request timed out.', { statusCode: 504, retryable: true });
    }

    return new DeepSeekProviderError('DeepSeek request failed before a response was received.', {
      statusCode: 502,
      retryable: true,
    });
  }

  private safeProviderMessage(message: string): string {
    return message.replace(/sk-[a-zA-Z0-9_-]+/g, 'sk-***').slice(0, 240);
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private parseJsonResponse<T>(text: string, schema: ZodType<T>): T {
    const jsonText = this.stripJsonFence(text);
    return schema.parse(JSON.parse(jsonText)) as T;
  }

  private stripJsonFence(text: string): string {
    const trimmed = text.trim();
    const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
    return fenced?.[1]?.trim() ?? trimmed;
  }
}
