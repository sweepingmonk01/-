import type { StudentErrorRecord } from '../../student-state/infrastructure/sqlite-student-profile-repository.js';
import type { AgentJobRecord, GraphWeaveJobPayload } from '../domain/types.js';
import { DeepSeekCoachService } from './deepseek-coach-service.js';
import { SQLiteKnowledgeGraphRepository } from '../infrastructure/sqlite-knowledge-graph-repository.js';
import { SQLiteAgentJobRepository } from '../infrastructure/sqlite-agent-job-repository.js';

interface GraphWeaverServiceDeps {
  coachService: DeepSeekCoachService | null;
  repository: SQLiteKnowledgeGraphRepository;
  agentJobs: SQLiteAgentJobRepository;
  errorRecords?: {
    getActiveErrors(studentId: string): Promise<StudentErrorRecord[]>;
  };
}

export class GraphWeaverService {
  constructor(private readonly deps: GraphWeaverServiceDeps) {}

  enqueueForErrorRecord(studentId: string, errorRecord: StudentErrorRecord) {
    void this.deps.agentJobs.enqueueUnique({
      jobType: 'graph-weave-error-record',
      studentId,
      idempotencyKey: `graph-weave:${errorRecord.id}`,
      payload: {
        studentId,
        errorRecord,
      },
    }).catch((error) => {
      console.warn('Graph weaving enqueue failed.', error);
    });
  }

  async weaveErrorRecord(studentId: string, errorRecord: StudentErrorRecord): Promise<void> {
    const entities = await this.extractEntities(studentId, errorRecord);
    await this.deps.repository.upsertEntities(studentId, entities);
  }

  async processJob(job: AgentJobRecord<GraphWeaveJobPayload>): Promise<void> {
    await this.weaveErrorRecord(job.payload.studentId, job.payload.errorRecord as StudentErrorRecord);
  }

  async getGraph(studentId: string) {
    const currentGraph = await this.deps.repository.getGraph(studentId);
    if (currentGraph.nodes.length || currentGraph.edges.length || !this.deps.errorRecords) {
      return currentGraph;
    }

    const activeErrors = await this.deps.errorRecords.getActiveErrors(studentId);
    if (!activeErrors.length) {
      return currentGraph;
    }

    for (const errorRecord of activeErrors) {
      await this.weaveErrorRecord(studentId, errorRecord);
    }

    return this.deps.repository.getGraph(studentId);
  }

  private async extractEntities(studentId: string, errorRecord: StudentErrorRecord): Promise<string[]> {
    const rawText = [errorRecord.painPoint, errorRecord.rule, errorRecord.questionText].filter(Boolean).join(' ');

    if (this.deps.coachService) {
      try {
        const extracted = await this.deps.coachService.extractKnowledgeGraphEntities({
          studentId,
          painPoint: errorRecord.painPoint,
          rule: errorRecord.rule,
          questionText: errorRecord.questionText,
        });

        if (extracted.entities.length) return extracted.entities;
      } catch (error) {
        console.warn('Knowledge graph entity extraction failed, falling back to heuristic extraction.', error);
      }
    }

    return rawText
      .split(/[，。；、,\s/()（）]+/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2)
      .map((item) => item.replace(/[.。,:：；;!?！？]+$/g, ''))
      .filter(Boolean)
      .slice(0, 6);
  }
}
