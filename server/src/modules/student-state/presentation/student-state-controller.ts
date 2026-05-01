import type { Request, Response } from 'express';
import { resolveStudentScope } from '../../auth/presentation/request-auth.js';
import { StudentStateSummaryService } from '../application/student-state-summary-service.js';

export class StudentStateController {
  constructor(private readonly summaryService: StudentStateSummaryService) {}

  getStateSummary = async (req: Request, res: Response) => {
    const studentId = resolveStudentScope(req, res, { source: 'params' });
    if (!studentId) return;

    const summary = await this.summaryService.getStudentStateSummary(studentId);
    if (!summary) {
      res.status(404).json({ error: 'Student state summary not found.' });
      return;
    }

    res.json(summary);
  };
}
