import type { Request, Response } from 'express';
import type { EventLogger } from '../../analytics/application/event-logger.js';
import { assertStudentOwnership, resolveStudentScope } from '../../auth/presentation/request-auth.js';
import { SocraticDiagnosticService } from '../../ai/application/socratic-diagnostic-service.js';
import { KnowledgeMapAssetService } from '../../ai/application/knowledge-map-asset-service.js';
import { MobiusOrchestrator } from '../application/mobius-orchestrator.js';
import type { InteractionOutcome, InteractionSubmission, StudentContext } from '../domain/types.js';

export class MobiusController {
  constructor(
    private readonly orchestrator: MobiusOrchestrator,
    private readonly eventLogger: EventLogger,
    private readonly socraticDiagnosticService: SocraticDiagnosticService | null,
    private readonly knowledgeMapAssets: KnowledgeMapAssetService,
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
    const studentId = resolveStudentScope(req, res, {
      source: 'body',
      fallbackToCurrentUser: true,
    });
    if (!studentId) return;

    const context = {
      ...(req.body as StudentContext),
      studentId,
    } as StudentContext;

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
        selectedStrategy: plan.strategyDecision.selectedStrategy,
        strategyCandidates: plan.strategyDecision.candidates,
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
    if (!assertStudentOwnership(req, res, job.studentId)) return;
    res.json(job);
  };

  listMediaJobs = async (req: Request, res: Response) => {
    const studentId = resolveStudentScope(req, res, {
      source: 'query',
      fallbackToCurrentUser: true,
    });
    if (!studentId) return;
    const jobs = await this.orchestrator.listMediaJobs(studentId);
    res.json({ items: jobs });
  };

  listKnowledgeMapAssets = async (req: Request, res: Response) => {
    if (!assertStudentOwnership(req, res, req.params.studentId)) return;
    const items = await this.knowledgeMapAssets.listAssets(req.params.studentId);
    res.json({ items });
  };

  generateKnowledgeMapAsset = async (req: Request, res: Response) => {
    if (!assertStudentOwnership(req, res, req.params.studentId)) return;
    const { kind, nodeKey, subject, relatedErrors, force } = req.body as {
      kind?: 'knowledge-map-bg' | 'node-card' | 'video-first-frame';
      nodeKey?: string;
      subject?: string;
      relatedErrors?: string[];
      force?: boolean;
    };
    if (kind !== 'knowledge-map-bg' && kind !== 'node-card' && kind !== 'video-first-frame') {
      res.status(400).json({ error: 'kind must be knowledge-map-bg, node-card, or video-first-frame.' });
      return;
    }

    const asset = await this.knowledgeMapAssets.generateAsset({
      studentId: req.params.studentId,
      kind,
      nodeKey,
      subject,
      relatedErrors,
      force,
    });

    await this.eventLogger.track({
      name: 'knowledge_map.asset.generated',
      payload: {
        studentId: req.params.studentId,
        assetId: asset.id,
        kind: asset.kind,
        provider: asset.provider,
        status: asset.status,
        cached: !force,
      },
    });
    res.status(201).json(asset);
  };

  createKnowledgeNodeVideo = async (req: Request, res: Response) => {
    if (!assertStudentOwnership(req, res, req.params.studentId)) return;
    const { nodeLabel, domain, coreQuestion, curriculumNode, storyboardSeed, relatedConcepts, relatedErrors, firstFrameAssetId, firstFrameUrl } = req.body as {
      nodeLabel?: string;
      domain?: 'physics' | 'neuroscience';
      coreQuestion?: string;
      curriculumNode?: string;
      storyboardSeed?: string[];
      relatedConcepts?: string[];
      relatedErrors?: string[];
      firstFrameAssetId?: string;
      firstFrameUrl?: string;
    };
    if (!req.params.nodeKey || !nodeLabel) {
      res.status(400).json({ error: 'nodeKey and nodeLabel are required.' });
      return;
    }

    const firstFrame = firstFrameUrl
      ? null
      : firstFrameAssetId
      ? (await this.knowledgeMapAssets.listAssets(req.params.studentId)).find((asset) => asset.id === firstFrameAssetId)
      : await this.knowledgeMapAssets.ensureNodeFirstFrame({
          studentId: req.params.studentId,
          nodeKey: req.params.nodeKey,
          relatedErrors,
        });
    const job = await this.orchestrator.createKnowledgeNodeVideo({
      studentId: req.params.studentId,
      nodeKey: req.params.nodeKey,
      nodeLabel,
      domain,
      coreQuestion,
      curriculumNode,
      storyboardSeed,
      relatedConcepts,
      relatedErrors,
      firstFrameUrl: firstFrameUrl ?? (firstFrame?.status === 'ready' ? firstFrame.urlOrBlobRef : undefined),
    });

    await this.eventLogger.track({
      name: 'knowledge_map.node_video.created',
      payload: {
        studentId: req.params.studentId,
        nodeKey: req.params.nodeKey,
        mediaJobId: job.id,
        provider: job.provider,
        firstFrameAssetId: firstFrame?.id,
      },
    });
    res.status(201).json(job);
  };

  recordFoundationExploration = async (req: Request, res: Response) => {
    if (!assertStudentOwnership(req, res, req.params.studentId)) return;
    const { nodeKey, nodeLabel, domain, coreQuestion, taskId, taskLabel, actionType, outcome, note } = req.body as {
      nodeKey?: string;
      nodeLabel?: string;
      domain?: 'physics' | 'neuroscience';
      coreQuestion?: string;
      taskId?: string;
      taskLabel?: string;
      actionType?: 'select' | 'draw' | 'drag' | 'speak' | 'sequence';
      outcome?: InteractionOutcome;
      note?: string;
    };

    if (!nodeKey || !nodeLabel || !domain || !coreQuestion || !taskId || !taskLabel || !actionType) {
      res.status(400).json({ error: 'nodeKey, nodeLabel, domain, coreQuestion, taskId, taskLabel, and actionType are required.' });
      return;
    }
    if (domain !== 'physics' && domain !== 'neuroscience') {
      res.status(400).json({ error: 'domain must be physics or neuroscience.' });
      return;
    }
    if (outcome !== 'success' && outcome !== 'failure') {
      res.status(400).json({ error: 'outcome must be success or failure.' });
      return;
    }

    const result = await this.orchestrator.recordFoundationExploration({
      studentId: req.params.studentId,
      nodeKey,
      nodeLabel,
      domain,
      coreQuestion,
      taskId,
      taskLabel,
      actionType,
      outcome,
      note,
    });

    await this.eventLogger.track({
      name: 'foundation_science.exploration.completed',
      payload: {
        studentId: req.params.studentId,
        nodeKey,
        domain,
        taskId,
        outcome,
        cycleId: result.cycleId,
      },
    });
    res.status(201).json(result);
  };

  refreshMediaJob = async (req: Request, res: Response) => {
    const existingJob = await this.orchestrator.getMediaJob(req.params.jobId);
    if (!existingJob) {
      res.status(404).json({ error: 'Media job not found.' });
      return;
    }
    if (!assertStudentOwnership(req, res, existingJob.studentId)) return;

    const job = await this.orchestrator.refreshMediaJob(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: 'Media job not found.' });
      return;
    }
    res.json(job);
  };

  resolveInteraction = async (req: Request, res: Response) => {
    const job = await this.orchestrator.getMediaJob(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: 'Media job not found.' });
      return;
    }
    if (!assertStudentOwnership(req, res, job.studentId)) return;

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

    if (resolution.outcome === 'failure' && this.socraticDiagnosticService) {
      if (job) {
        resolution.diagnosticThread = await this.socraticDiagnosticService.createFailureThread({
          studentId: job.studentId,
          cycleId: resolution.cycleId,
          jobId: job.id,
          painPoint: job.promptBundle.title.replace(/^Mobius scene for /, ''),
          rule: job.promptBundle.prompt.split('Core rule: ')[1]?.split('. Emotion target:')[0]?.trim(),
          rationale: resolution.adjudication?.rationale,
          failureNarration: resolution.narration,
        });
      }
    }

    await this.eventLogger.track({
      name: 'mobius.interaction.resolved',
      payload: {
        jobId: req.params.jobId,
        outcome: resolution.outcome,
        cycleId: resolution.cycleId,
        actionType,
        hasSubmission: Boolean(submission),
        selectedStrategy: resolution.strategyDecision.selectedStrategy,
        strategyCandidates: resolution.strategyDecision.candidates,
        branchJobId: resolution.video?.jobId,
        diagnosticThreadId: resolution.diagnosticThread?.id,
      },
    });
    res.json(resolution);
  };
}
