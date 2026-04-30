import type { Request, Response } from 'express';
import { resolveStudentScope } from '../../auth/presentation/request-auth.js';
import { LearningCycleService } from '../application/learning-cycle-service.js';

const readLimit = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
};

export class LearningCycleController {
  constructor(private readonly learningCycles: LearningCycleService) {}

  listStudentCycles = async (req: Request, res: Response) => {
    const studentId = resolveStudentScope(req, res, { source: 'params' });
    if (!studentId) return;

    const report = await this.learningCycles.listStudentCycleReports(
      studentId,
      readLimit(req.query.limit),
    );
    res.json(report);
  };

  getCycleReport = async (req: Request, res: Response) => {
    const studentId = resolveStudentScope(req, res, { source: 'params' });
    if (!studentId) return;

    const report = await this.learningCycles.getCycleReport(studentId, req.params.cycleId);
    if (!report) {
      res.status(404).json({ error: 'Learning cycle not found.' });
      return;
    }

    res.json(report);
  };
}
