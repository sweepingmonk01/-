import type { Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import type { EventLogger } from '../../analytics/application/event-logger.js';
import { assertStudentOwnership, resolveStudentScope } from '../../auth/presentation/request-auth.js';
import { DeepSeekCoachService } from '../application/deepseek-coach-service.js';
import { GraphWeaverService } from '../application/graph-weaver-service.js';
import { SocraticDiagnosticService } from '../application/socratic-diagnostic-service.js';
import { StrategicPlannerService } from '../application/strategic-planner-service.js';
import {
  createDemoAnalyzeQuestionImageResult,
  createDemoDehydrateHomeworkResult,
} from '../application/demo-ai-fallback-service.js';
import {
  analyzeQuestionImageRequestSchema,
  createSocraticThreadRequestSchema,
  dehydrateHomeworkRequestSchema,
  formatSchemaError,
  generateCloneQuestionRequestSchema,
  generateTheaterScriptRequestSchema,
  replySocraticThreadRequestSchema,
} from '../application/ai-schemas.js';
import type {
  AnalyzeQuestionImageInput,
  DehydrateHomeworkInput,
  GenerateCloneQuestionInput,
  GenerateTheaterScriptInput,
} from '../domain/types.js';

export class AIController {
  constructor(
    private readonly coachService: DeepSeekCoachService | null,
    private readonly eventLogger: EventLogger,
    private readonly strategicPlannerService: StrategicPlannerService | null,
    private readonly socraticDiagnosticService: SocraticDiagnosticService | null,
    private readonly graphWeaverService: GraphWeaverService | null,
  ) {}

  private parseRequestBody<T>(schema: ZodTypeAny, req: Request, res: Response, label: string): T | null {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: formatSchemaError(label, parsed.error),
      });
      return null;
    }

    return parsed.data as T;
  }

  private isDemoFallbackRequest(req: Request) {
    return req.authContext?.authMode === 'demo' && !this.coachService;
  }

  analyzeQuestionImage = async (req: Request, res: Response) => {
    const input = this.parseRequestBody<AnalyzeQuestionImageInput>(
      analyzeQuestionImageRequestSchema,
      req,
      res,
      'Invalid analyze-question-image payload',
    );
    if (!input) return;

    if (!this.coachService) {
      if (!this.isDemoFallbackRequest(req)) {
        res.status(503).json({ error: 'DeepSeek service is not configured.' });
        return;
      }

      const result = createDemoAnalyzeQuestionImageResult(input);
      await this.eventLogger.track({
        name: 'ai.analyze_question_image.demo_fallback',
        payload: {
          mimeType: input.mimeType,
        },
      });
      res.json(result);
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
    if (!this.coachService) {
      res.status(503).json({ error: 'DeepSeek service is not configured.' });
      return;
    }
    const input = this.parseRequestBody<GenerateCloneQuestionInput>(
      generateCloneQuestionRequestSchema,
      req,
      res,
      'Invalid clone-question payload',
    );
    if (!input) return;

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
    if (!this.coachService) {
      res.status(503).json({ error: 'DeepSeek service is not configured.' });
      return;
    }
    const input = this.parseRequestBody<GenerateTheaterScriptInput>(
      generateTheaterScriptRequestSchema,
      req,
      res,
      'Invalid theater-script payload',
    );
    if (!input) return;

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
    const input = this.parseRequestBody<DehydrateHomeworkInput>(
      dehydrateHomeworkRequestSchema,
      req,
      res,
      'Invalid dehydrate-homework payload',
    );
    if (!input) return;
    const scopedStudentId = resolveStudentScope(req, res, {
      source: 'body',
      required: false,
      fallbackToCurrentUser: true,
    });
    if (input.studentId && !scopedStudentId) return;
    if (!this.coachService) {
      if (!this.isDemoFallbackRequest(req)) {
        res.status(503).json({ error: 'DeepSeek service is not configured.' });
        return;
      }

      const result = createDemoDehydrateHomeworkResult({
        imageBase64: input.imageBase64,
        mimeType: input.mimeType,
        targetScore: input.targetScore,
        studentId: scopedStudentId ?? input.studentId,
        strategicContext: input.strategicContext,
      });
      await this.eventLogger.track({
        name: 'ai.dehydrate_homework.demo_fallback',
        payload: {
          mimeType: input.mimeType,
          targetScore: input.targetScore,
          studentId: scopedStudentId ?? input.studentId,
        },
      });
      res.json(result);
      return;
    }

    const result = scopedStudentId && this.strategicPlannerService
      ? await this.strategicPlannerService.planHomework({
          studentId: scopedStudentId,
          imageBase64: input.imageBase64,
          mimeType: input.mimeType,
          targetScore: input.targetScore,
        })
      : await this.coachService.dehydrateHomework({
          imageBase64: input.imageBase64,
          mimeType: input.mimeType,
          targetScore: input.targetScore,
          studentId: scopedStudentId ?? undefined,
        });
    await this.eventLogger.track({
      name: 'ai.dehydrate_homework.completed',
      payload: {
        mimeType: input.mimeType,
        targetScore: input.targetScore,
        studentId: scopedStudentId ?? input.studentId,
      },
    });
    res.json(result);
  };

  getKnowledgeGraph = async (req: Request, res: Response) => {
    const studentId = resolveStudentScope(req, res, { source: 'params' });
    if (!studentId) return;
    if (!this.graphWeaverService) {
      res.status(503).json({ error: 'Knowledge graph service is not configured.' });
      return;
    }

    const graph = await this.graphWeaverService.getGraph(studentId);
    res.json(graph);
  };

  createSocraticThread = async (req: Request, res: Response) => {
    if (!this.socraticDiagnosticService) {
      res.status(503).json({ error: 'Socratic diagnostic service is not configured.' });
      return;
    }
    const input = this.parseRequestBody<{
      studentId?: string;
      cycleId?: string;
      jobId?: string;
      painPoint: string;
      rule?: string;
      rationale?: string[];
      failureNarration?: string;
    }>(createSocraticThreadRequestSchema, req, res, 'Invalid socratic-thread payload');
    if (!input) return;

    const studentId = resolveStudentScope(req, res, {
      source: 'body',
      fallbackToCurrentUser: true,
    });
    if (!studentId) return;

    const thread = await this.socraticDiagnosticService.createFailureThread({
      studentId,
      cycleId: input.cycleId,
      jobId: input.jobId,
      painPoint: input.painPoint,
      rule: input.rule,
      rationale: input.rationale,
      failureNarration: input.failureNarration,
    });

    await this.eventLogger.track({
      name: 'ai.socratic_thread.created',
      payload: {
        studentId,
        cycleId: input.cycleId,
        jobId: input.jobId,
      },
    });

    res.status(201).json(thread);
  };

  getSocraticThread = async (req: Request, res: Response) => {
    if (!this.socraticDiagnosticService) {
      res.status(503).json({ error: 'Socratic diagnostic service is not configured.' });
      return;
    }

    const thread = await this.socraticDiagnosticService.getThread(req.params.threadId);
    if (!thread) {
      res.status(404).json({ error: 'Socratic thread not found.' });
      return;
    }
    if (!assertStudentOwnership(req, res, thread.studentId)) return;

    res.json(thread);
  };

  replySocraticThread = async (req: Request, res: Response) => {
    if (!this.socraticDiagnosticService) {
      res.status(503).json({ error: 'Socratic diagnostic service is not configured.' });
      return;
    }

    const input = this.parseRequestBody<{ content: string }>(
      replySocraticThreadRequestSchema,
      req,
      res,
      'Invalid socratic reply payload',
    );
    if (!input) return;

    const existingThread = await this.socraticDiagnosticService.getThread(req.params.threadId);
    if (!existingThread) {
      res.status(404).json({ error: 'Socratic thread not found.' });
      return;
    }
    if (!assertStudentOwnership(req, res, existingThread.studentId)) return;

    const thread = await this.socraticDiagnosticService.reply(req.params.threadId, input.content);
    if (!thread) {
      res.status(404).json({ error: 'Socratic thread not found.' });
      return;
    }

    await this.eventLogger.track({
      name: 'ai.socratic_thread.replied',
      payload: {
        threadId: req.params.threadId,
      },
    });

    res.json(thread);
  };
}
