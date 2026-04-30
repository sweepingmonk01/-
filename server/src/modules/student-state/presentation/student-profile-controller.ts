import type { Request, Response } from 'express';
import type { SQLiteStudentProfileRepository } from '../infrastructure/sqlite-student-profile-repository.js';
import { randomUUID } from 'node:crypto';
import { GraphWeaverService } from '../../ai/application/graph-weaver-service.js';
import { StudentStateSummaryService } from '../application/student-state-summary-service.js';
import { resolveStudentScope } from '../../auth/presentation/request-auth.js';
import { buildDashboardViewState } from '../../../../../shared/dashboard-metrics.js';
import { createDefaultCognitiveState } from '../../../../../shared/cognitive-state.js';

export class StudentProfileController {
  constructor(
    private readonly repo: SQLiteStudentProfileRepository,
    private readonly studentStateSummaryService: StudentStateSummaryService,
    private readonly graphWeaverService: GraphWeaverService | null,
  ) {}

  getProfile = async (req: Request, res: Response) => {
    const studentId = resolveStudentScope(req, res, { source: 'params' });
    if (!studentId) return;
    const profile = await this.repo.getProfile(studentId);
    if (!profile) {
      // Return empty default state instead of 404 to avoid frontend crash on new users
      res.json({});
      return;
    }
    res.json(profile);
  };

  updateProfile = async (req: Request, res: Response) => {
    const studentId = resolveStudentScope(req, res, { source: 'params' });
    if (!studentId) return;
    const profile = await this.repo.updateProfile(studentId, req.body);
    res.json(profile);
  };

  getActiveErrors = async (req: Request, res: Response) => {
    const studentId = resolveStudentScope(req, res, { source: 'params' });
    if (!studentId) return;
    const errors = await this.repo.getActiveErrors(studentId);
    res.json({ items: errors });
  };

  addErrorRecord = async (req: Request, res: Response) => {
    const studentId = resolveStudentScope(req, res, { source: 'params' });
    if (!studentId) return;
    const id = randomUUID();
    const errorRecord = await this.repo.addErrorRecord(studentId, id, req.body);
    this.graphWeaverService?.enqueueForErrorRecord(studentId, errorRecord);
    res.json(errorRecord);
  };

  resolveError = async (req: Request, res: Response) => {
    const studentId = resolveStudentScope(req, res, { source: 'params' });
    const errorId = req.params.errorId;
    if (!studentId) return;
    if (!errorId) {
      res.status(400).json({ error: 'studentId and errorId are required.' });
      return;
    }
    await this.repo.resolveError(studentId, errorId);
    res.json({ success: true });
  };

  getDashboardStats = async (req: Request, res: Response) => {
    const studentId = resolveStudentScope(req, res, { source: 'params' });
    if (!studentId) return;

    try {
      const profile = await this.repo.getProfile(studentId) || {
        targetScore: 115,
        timeSaved: 0,
        cognitiveState: createDefaultCognitiveState(),
      };
      const activeErrors = await this.repo.getActiveErrors(studentId);
      const summary = await this.studentStateSummaryService.getStudentStateSummary(studentId);
      const painPointsRaw = activeErrors.map((item) => item.painPoint).filter(Boolean);
      const currentCognitiveState = summary?.currentCognitiveState ?? profile.cognitiveState;
      const successCount = summary?.interactionStats.successCount ?? 0;
      const failureCount = summary?.interactionStats.failureCount ?? 0;
      res.json(buildDashboardViewState({
        targetScore: profile.targetScore,
        timeSavedMinutes: profile.timeSaved ?? 0,
        successCount,
        failureCount,
        activeIssuesCount: activeErrors.length,
        painPoints: [...(summary?.recentPainPoints ?? []), ...painPointsRaw],
        cognitiveState: currentCognitiveState,
      }));
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  };
}
