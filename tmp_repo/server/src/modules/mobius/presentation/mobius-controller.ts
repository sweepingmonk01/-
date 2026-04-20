import type { Request, Response } from 'express';
import type { EventLogger } from '../../analytics/application/event-logger.js';
import { MobiusOrchestrator } from '../application/mobius-orchestrator.js';
import type { InteractionOutcome, InteractionSubmission, StudentContext } from '../domain/types.js';

export class MobiusController {
  constructor(
    private readonly orchestrator: MobiusOrchestrator,
    private readonly eventLogger: EventLogger,
  ) {}

  architecture = (_req: Request, res: Response) => {
    res.json({
      name: 'Mobius backend skeleton',
      modules: [
        'cognitive-engine',
        'story-planner',
        'video-generation-client',
        'media-job-repository',
        'mobius-orchestrator',
      ],
      status: 'skeleton-ready',
    });
  };

  createSession = async (req: Request, res: Response) => {
    const context = req.body as StudentContext;

    if (!context?.studentId || !context?.painPoint || !context?.rule) {
      res.status(400).json({
        error: 'studentId, painPoint, and rule are required.',
      });
      return;
    }

    const plan = await this.orchestrator.buildSession(context);
    await this.eventLogger.track({
      name: 'mobius.session.created',
      payload: {
        studentId: context.studentId,
        grade: context.grade,
        targetScore: context.targetScore,
        painPoint: context.painPoint,
        mediaJobId: plan.video.jobId,
        provider: plan.video.provider,
      },
    });
    res.status(201).json(plan);
  };

  getMediaJob = async (req: Request, res: Response) => {
    const job = await this.orchestrator.getMediaJob(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: 'Media job not found.' });
      return;
    }
    res.json(job);
  };

  listMediaJobs = async (req: Request, res: Response) => {
    const studentId = req.query.studentId;
    if (typeof studentId !== 'string' || !studentId) {
      res.status(400).json({ error: 'studentId query parameter is required.' });
      return;
    }
    const jobs = await this.orchestrator.listMediaJobs(studentId);
    res.json({ items: jobs });
  };

  refreshMediaJob = async (req: Request, res: Response) => {
    const job = await this.orchestrator.refreshMediaJob(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: 'Media job not found.' });
      return;
    }
    res.json(job);
  };

  resolveInteraction = async (req: Request, res: Response) => {
    const { outcome, actionType, submission } = req.body as {
      outcome?: InteractionOutcome;
      actionType?: string;
      submission?: InteractionSubmission;
    };

    let resolution = null;

    if (submission) {
      resolution = await this.orchestrator.adjudicateInteraction(req.params.jobId, { submission, actionType });
    } else {
      if (outcome !== 'success' && outcome !== 'failure') {
        res.status(400).json({ error: 'Provide either submission or outcome, and outcome must be success or failure.' });
        return;
      }
      resolution = await this.orchestrator.resolveInteraction(req.params.jobId, { outcome, actionType });
    }

    if (!resolution) {
      res.status(404).json({ error: 'Media job not found.' });
      return;
    }

    await this.eventLogger.track({
      name: 'mobius.interaction.resolved',
      payload: {
        jobId: req.params.jobId,
        outcome: resolution.outcome,
        actionType,
        hasSubmission: Boolean(submission),
        branchJobId: resolution.video?.jobId,
      },
    });
    res.json(resolution);
  };
}
