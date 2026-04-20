import type { Request, Response } from 'express';
import { StudentStateSummaryService } from '../application/student-state-summary-service.js';

export class StudentStateController {
  constructor(private readonly summaryService: StudentStateSummaryService) {}

  getStateSummary = async (req: Request, res: Response) => {
    const studentId = req.params.studentId;
    if (!studentId) {
      res.status(400).json({ error: 'studentId route parameter is required.' });
      return;
    }

    const summary = await this.summaryService.getStudentStateSummary(studentId);
    if (!summary) {
      res.status(404).json({ error: 'Student state summary not found.' });
      return;
    }

    res.json(summary);
  };
}
