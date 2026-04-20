import { GoogleGenAI, Type } from '@google/genai';
import type {
  AIQuestionData,
  AnalyzeQuestionImageInput,
  DehydrateHomeworkInput,
  DehydrateResult,
  GenerateCloneQuestionInput,
  GenerateTheaterScriptInput,
  TheaterScript,
} from '../domain/types.js';

interface GeminiCoachServiceOptions {
  apiKey: string;
  model?: string;
}

export class GeminiCoachService {
  private readonly ai: GoogleGenAI;
  private readonly model: string;

  constructor(options: GeminiCoachServiceOptions) {
    this.ai = new GoogleGenAI({ apiKey: options.apiKey });
    this.model = options.model || 'gemini-3.1-pro-preview';
  }

  async analyzeQuestionImage(input: AnalyzeQuestionImageInput): Promise<AIQuestionData> {
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: [
        { inlineData: { data: input.imageBase64, mimeType: input.mimeType } },
        { text: 'You are an expert tutor. I am uploading a screenshot or photo of an exam question. Analyze it. DO NOT USE MARKDOWN IN YOUR TEXT STRING OUTPUT. ONLY USE PLAIN TEXT.' },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            painPoint: { type: Type.STRING, description: "What core concept is being tested and where do students usually fail? (e.g. '完形填空逻辑连词搭配混淆' or '二次函数极值点判断')" },
            rule: { type: Type.STRING, description: "A punchy, one-sentence rule or mnemonic to solve it. (e.g. '遇中点，连中线。构造平行四边形或中位线定理。')" },
            questionText: { type: Type.STRING, description: 'Extract the exact question text. Ignore extraneous UI elements.' },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Extract EXACTLY 4 options. If the original question has fewer or none, you MUST create 4 plausible educational options to test this understanding.',
            },
            correctAnswer: { type: Type.STRING, description: 'The correct option text exactly matching one of the generated options.' },
          },
          required: ['painPoint', 'rule', 'questionText', 'options', 'correctAnswer'],
        },
      },
    });

    return this.parseJsonResponse<AIQuestionData>(response.text);
  }

  async generateCloneQuestion(input: GenerateCloneQuestionInput): Promise<AIQuestionData> {
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: `I have a student struggling with the concept "${input.painPoint}". The rule they need to remember is "${input.rule}". The original question was "${input.questionText}". Generate a NEW, unique similar question testing the exact same rule, but with different numbers, words, or contexts. Output plain JSON.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            painPoint: { type: Type.STRING },
            rule: { type: Type.STRING },
            questionText: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctAnswer: { type: Type.STRING },
          },
          required: ['painPoint', 'rule', 'questionText', 'options', 'correctAnswer'],
        },
      },
    });

    return this.parseJsonResponse<AIQuestionData>(response.text);
  }

  async generateTheaterScript(input: GenerateTheaterScriptInput): Promise<TheaterScript> {
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: `I need a short Manga/Interactive theater script for a student struggling with "${input.painPoint}". The core rule to learn is "${input.rule}". Output in JSON with 'sceneIntro' (setup the dramatic situation), 'emotion' (the AI sprite's emotion based on the scenario: focused, urging, protective), 'interactionPrompt' (what the student needs to drag/draw/select to save the scene), 'successScene' (what happens if correct), and 'failureScene' (what happens if wrong). Make it Cyberpunk or Sci-fi action.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sceneIntro: { type: Type.STRING },
            emotion: { type: Type.STRING },
            interactionPrompt: { type: Type.STRING },
            successScene: { type: Type.STRING },
            failureScene: { type: Type.STRING },
          },
          required: ['sceneIntro', 'emotion', 'interactionPrompt', 'successScene', 'failureScene'],
        },
      },
    });

    return this.parseJsonResponse<TheaterScript>(response.text);
  }

  async dehydrateHomework(input: DehydrateHomeworkInput): Promise<DehydrateResult> {
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: [
        { inlineData: { data: input.imageBase64, mimeType: input.mimeType } },
        {
          text: `Analyze this entire page of school homework. The student's target score is ${input.targetScore}/150 (They want maximum efficiency, not perfection). Count all the questions. Then categorize them with extreme prejudice:
                     1. Trash/Too Easy (They already know this, waste of time).
                     2. Drop/Too Hard (Beyond their target score ROI, skip it).
                     3. Must Do (The sweet spot for score growth).
                     Output strictly in the required JSON schema.`,
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            total: { type: Type.NUMBER },
            trashEasy: { type: Type.NUMBER, description: 'Count of useless repetitive easy questions' },
            dropHard: { type: Type.NUMBER, description: 'Count of ultra hard questions beyond target score' },
            mustDo: { type: Type.NUMBER, description: 'Count of questions worth doing' },
            mustDoIndices: { type: Type.STRING, description: "e.g. 'Q4, Q7, Q12'" },
            reasoning: { type: Type.STRING, description: 'A highly confident, rebellious one-sentence reason why the rest is trash.' },
          },
          required: ['total', 'trashEasy', 'dropHard', 'mustDo', 'mustDoIndices', 'reasoning'],
        },
      },
    });

    return this.parseJsonResponse<DehydrateResult>(response.text);
  }

  private parseJsonResponse<T>(text: string | undefined): T {
    if (!text) {
      throw new Error('Gemini returned an empty response.');
    }

    return JSON.parse(text.trim()) as T;
  }
}
