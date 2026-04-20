import type { Request, Response } from 'express';
import type { EventLogger } from '../../analytics/application/event-logger.js';
import { GeminiCoachService } from '../application/gemini-coach-service.js';
import type {
  AnalyzeQuestionImageInput,
  DehydrateHomeworkInput,
  GenerateCloneQuestionInput,
  GenerateTheaterScriptInput,
} from '../domain/types.js';

export class AIController {
  constructor(
    private readonly coachService: GeminiCoachService | null,
    private readonly eventLogger: EventLogger,
  ) {}

  analyzeQuestionImage = async (req: Request, res: Response) => {
    const input = req.body as Partial<AnalyzeQuestionImageInput>;
    if (!this.coachService) {
      res.status(503).json({ error: 'Gemini service is not configured.' });
      return;
    }
    if (!input.imageBase64 || !input.mimeType) {
      res.status(400).json({ error: 'imageBase64 and mimeType are required.' });
      return;
    }

    const result = await this.coachService.analyzeQuestionImage({
      imageBase64: input.imageBase64,
      mimeType: input.mimeType,
    });
    await this.eventLogger.track({
      name: 'ai.analyze_question_image.completed',
      payload: {
        mimeType: input.mimeType,
      },
    });
    res.json(result);
  };

  generateCloneQuestion = async (req: Request, res: Response) => {
    const input = req.body as Partial<GenerateCloneQuestionInput>;
    if (!this.coachService) {
      res.status(503).json({ error: 'Gemini service is not configured.' });
      return;
    }
    if (!input.painPoint || !input.rule || !input.questionText) {
      res.status(400).json({ error: 'painPoint, rule, and questionText are required.' });
      return;
    }

    const result = await this.coachService.generateCloneQuestion({
      painPoint: input.painPoint,
      rule: input.rule,
      questionText: input.questionText,
    });
    await this.eventLogger.track({
      name: 'ai.clone_question.completed',
      payload: {
        painPoint: input.painPoint,
      },
    });
    res.json(result);
  };

  generateTheaterScript = async (req: Request, res: Response) => {
    const input = req.body as Partial<GenerateTheaterScriptInput>;
    if (!this.coachService) {
      res.status(503).json({ error: 'Gemini service is not configured.' });
      return;
    }
    if (!input.painPoint || !input.rule) {
      res.status(400).json({ error: 'painPoint and rule are required.' });
      return;
    }

    const result = await this.coachService.generateTheaterScript({
      painPoint: input.painPoint,
      rule: input.rule,
    });
    await this.eventLogger.track({
      name: 'ai.theater_script.completed',
      payload: {
        painPoint: input.painPoint,
      },
    });
    res.json(result);
  };

  dehydrateHomework = async (req: Request, res: Response) => {
    const input = req.body as Partial<DehydrateHomeworkInput>;
    if (!this.coachService) {
      res.status(503).json({ error: 'Gemini service is not configured.' });
      return;
    }
    if (!input.imageBase64 || !input.mimeType || typeof input.targetScore !== 'number') {
      res.status(400).json({ error: 'imageBase64, mimeType, and numeric targetScore are required.' });
      return;
    }

    const result = await this.coachService.dehydrateHomework({
      imageBase64: input.imageBase64,
      mimeType: input.mimeType,
      targetScore: input.targetScore,
    });
    await this.eventLogger.track({
      name: 'ai.dehydrate_homework.completed',
      payload: {
        mimeType: input.mimeType,
        targetScore: input.targetScore,
      },
    });
    res.json(result);
  };
}
