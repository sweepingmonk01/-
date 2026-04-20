import type { Request, Response } from 'express';
import type { EventLogger } from '../../analytics/application/event-logger.js';
import { ContentOrchestrator } from '../application/content-orchestrator.js';
import type { ErrorToContentInput, SubjectCode } from '../domain/types.js';

const isSubjectCode = (value: unknown): value is SubjectCode => value === 'zh' || value === 'ma' || value === 'en';

export class ContentController {
  constructor(
    private readonly orchestrator: ContentOrchestrator,
    private readonly eventLogger: EventLogger,
  ) {}

  resolveErrorContext = async (req: Request, res: Response) => {
    const input = req.body as ErrorToContentInput;

    if (!input?.painPoint) {
      res.status(400).json({ error: 'painPoint is required.' });
      return;
    }

    if (input.subject && !isSubjectCode(input.subject)) {
      res.status(400).json({ error: 'subject must be zh, ma, or en.' });
      return;
    }

    const resolution = await this.orchestrator.resolveErrorContext(input);
    await this.eventLogger.track({
      name: 'content.resolve.completed',
      payload: {
        subject: input.subject,
        grade: input.grade,
        painPoint: input.painPoint,
        matchedKnowledgePoints: resolution.matchedKnowledgePoints.length,
        relatedQuestions: resolution.relatedQuestions.length,
      },
    });
    res.json(resolution);
  };
}
