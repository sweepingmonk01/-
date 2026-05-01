import type { Request, Response } from 'express';
import type { EventLogger } from '../../analytics/application/event-logger.js';
import { ContentOrchestrator } from '../application/content-orchestrator.js';
import type {
  ContentCatalogQuery,
  ErrorToContentInput,
  FoundationScienceCatalogQuery,
  FoundationScienceDomain,
  SubjectCode,
} from '../domain/types.js';

const isSubjectCode = (value: unknown): value is SubjectCode => value === 'zh' || value === 'ma' || value === 'en';
const isFoundationScienceDomain = (value: unknown): value is FoundationScienceDomain =>
  value === 'physics' || value === 'neuroscience';

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

  listKnowledgePoints = async (req: Request, res: Response) => {
    const query = this.parseCatalogQuery(req);
    const items = await this.orchestrator.listKnowledgePoints(query);
    res.json({ items });
  };

  getKnowledgePointNeighborhood = async (req: Request, res: Response) => {
    const neighborhood = await this.orchestrator.getKnowledgePointNeighborhood(req.params.knowledgePointId);
    if (!neighborhood) {
      res.status(404).json({ error: 'Knowledge point not found.' });
      return;
    }

    res.json(neighborhood);
  };

  listFoundationKnowledgeNodes = async (req: Request, res: Response) => {
    const query = this.parseFoundationScienceQuery(req);
    const items = await this.orchestrator.listFoundationKnowledgeNodes(query);
    res.json({ items });
  };

  listFoundationKnowledgeEdges = async (req: Request, res: Response) => {
    const query = this.parseFoundationScienceQuery(req);
    const items = await this.orchestrator.listFoundationKnowledgeEdges(query);
    res.json({ items });
  };

  getFoundationKnowledgeNode = async (req: Request, res: Response) => {
    const item = await this.orchestrator.getFoundationKnowledgeNode(req.params.nodeKey);
    if (!item) {
      res.status(404).json({ error: 'Foundation knowledge node not found.' });
      return;
    }

    res.json({ item });
  };

  private parseCatalogQuery(req: Request): ContentCatalogQuery {
    const subject = typeof req.query.subject === 'string' && isSubjectCode(req.query.subject)
      ? req.query.subject
      : undefined;
    return {
      subject,
      grade: typeof req.query.grade === 'string' ? req.query.grade : undefined,
      keyword: typeof req.query.keyword === 'string' ? req.query.keyword : undefined,
    };
  }

  private parseFoundationScienceQuery(req: Request): FoundationScienceCatalogQuery {
    const domain = typeof req.query.domain === 'string' && isFoundationScienceDomain(req.query.domain)
      ? req.query.domain
      : undefined;

    return {
      domain,
      keyword: typeof req.query.keyword === 'string' ? req.query.keyword : undefined,
    };
  }
}
