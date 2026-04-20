import type { Request, Response } from 'express';
import type { SQLiteStudentProfileRepository } from '../infrastructure/sqlite-student-profile-repository.js';
import { randomUUID } from 'node:crypto';

export class StudentProfileController {
  constructor(private readonly repo: SQLiteStudentProfileRepository) {}

  getProfile = async (req: Request, res: Response) => {
    const studentId = req.params.studentId;
    if (!studentId) {
      res.status(400).json({ error: 'studentId is required.' });
      return;
    }
    const profile = await this.repo.getProfile(studentId);
    if (!profile) {
      // Return empty default state instead of 404 to avoid frontend crash on new users
      res.json({});
      return;
    }
    res.json(profile);
  };

  updateProfile = async (req: Request, res: Response) => {
    const studentId = req.params.studentId;
    if (!studentId) {
      res.status(400).json({ error: 'studentId is required.' });
      return;
    }
    const profile = await this.repo.updateProfile(studentId, req.body);
    res.json(profile);
  };

  getActiveErrors = async (req: Request, res: Response) => {
    const studentId = req.params.studentId;
    if (!studentId) {
      res.status(400).json({ error: 'studentId is required.' });
      return;
    }
    const errors = await this.repo.getActiveErrors(studentId);
    res.json({ items: errors });
  };

  addErrorRecord = async (req: Request, res: Response) => {
    const studentId = req.params.studentId;
    if (!studentId) {
      res.status(400).json({ error: 'studentId is required.' });
      return;
    }
    const id = randomUUID();
    const errorRecord = await this.repo.addErrorRecord(studentId, id, req.body);
    res.json(errorRecord);
  };

  resolveError = async (req: Request, res: Response) => {
    const { studentId, errorId } = req.params;
    if (!studentId || !errorId) {
      res.status(400).json({ error: 'studentId and errorId are required.' });
      return;
    }
    await this.repo.resolveError(studentId, errorId);
    res.json({ success: true });
  };

  getDashboardStats = async (req: Request, res: Response) => {
    const studentId = req.params.studentId;
    if (!studentId) {
      res.status(400).json({ error: 'studentId is required.' });
      return;
    }

    try {
      const profile = await this.repo.getProfile(studentId) || {
        targetScore: 115,
        timeSaved: 0,
        cognitiveState: { focus: 50, frustration: 0, joy: 50 },
      };

      const activeErrors = await this.repo.getActiveErrors(studentId);
      
      const painPointsRaw = activeErrors.map(e => e.painPoint).filter(Boolean);
      const uniquePainPoints = Array.from(new Set(painPointsRaw));
      
      // Extremely simplified Mock "AI ROI Projection" for frontend demo.
      // Every active error lowers our estimation by 3 points from the target, 
      // but student won't fall beneath 60.
      const estimatedScore = Math.max(60, profile.targetScore - (activeErrors.length * 3));

      // Time saved calculation derived from the profile DB directly
      const timeSavedHours = profile.timeSaved || 0;

      res.json({
        timeSavedHours,
        targetScore: profile.targetScore,
        estimatedScore,
        cognitiveState: profile.cognitiveState,
        activeIssuesCount: activeErrors.length,
        topPainPoints: uniquePainPoints.slice(0, 3)
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  };
}
