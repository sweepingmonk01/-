import type { StudentErrorRecord } from '../../student-state/infrastructure/sqlite-student-profile-repository.js';
import type {
  AgentJobRecord,
  GraphWeaveJobPayload,
  KnowledgeGraphDecisionContext,
  KnowledgeGraphDecisionNode,
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
} from '../domain/types.js';
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

  async getDecisionContext(input: {
    studentId: string;
    painPoint?: string;
    rule?: string;
    questionText?: string;
  }): Promise<KnowledgeGraphDecisionContext> {
    const graph = await this.getGraph(input.studentId);
    const topHotspots = graph.nodes
      .slice(0, 3)
      .map((node): KnowledgeGraphDecisionNode => ({
        key: node.key,
        label: node.label,
        weight: node.weight,
      }));

    if (!graph.nodes.length) {
      return {
        topHotspots,
        matchedHotspots: [],
        neighborRecommendations: [],
        summary: [],
      };
    }

    const corpus = normalizeText([input.painPoint, input.rule, input.questionText].filter(Boolean).join(' '));
    const matchedHotspots = graph.nodes
      .filter((node) => textMatches(corpus, node.label))
      .slice(0, 3)
      .map((node): KnowledgeGraphDecisionNode => ({
        key: node.key,
        label: node.label,
        weight: node.weight,
      }));

    const anchors = matchedHotspots.length ? matchedHotspots : topHotspots.slice(0, 1);
    const neighborRecommendations = this.buildNeighborRecommendations(graph.nodes, graph.edges, anchors);

    const summary: string[] = [];
    if (matchedHotspots.length) {
      summary.push(`图谱热点命中：${matchedHotspots.map((node) => node.label).join('、')}`);
    } else if (topHotspots.length) {
      summary.push(`近期高频节点：${topHotspots.map((node) => node.label).join('、')}`);
    }
    if (neighborRecommendations.length) {
      summary.push(
        `相邻修复建议：${neighborRecommendations.map((node) => `${node.label}${node.anchorLabel ? ` <- ${node.anchorLabel}` : ''}`).join('、')}`,
      );
    }

    return {
      topHotspots,
      matchedHotspots,
      neighborRecommendations,
      summary,
    };
  }

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

  private buildNeighborRecommendations(
    nodes: KnowledgeGraphNode[],
    edges: KnowledgeGraphEdge[],
    anchors: KnowledgeGraphDecisionNode[],
  ): KnowledgeGraphDecisionNode[] {
    if (!anchors.length) return [];

    const nodeByKey = new Map(nodes.map((node) => [node.key, node]));
    const anchorKeys = new Set(anchors.map((node) => node.key));
    const scored = new Map<string, KnowledgeGraphDecisionNode>();

    for (const edge of edges) {
      const sourceIsAnchor = anchorKeys.has(edge.source);
      const targetIsAnchor = anchorKeys.has(edge.target);
      if (!sourceIsAnchor && !targetIsAnchor) continue;

      const neighborKey = sourceIsAnchor ? edge.target : edge.source;
      if (anchorKeys.has(neighborKey)) continue;

      const neighborNode = nodeByKey.get(neighborKey);
      if (!neighborNode) continue;

      const anchorKey = sourceIsAnchor ? edge.source : edge.target;
      const anchorNode = anchors.find((node) => node.key === anchorKey);
      const relationWeight = edge.weight * 3 + neighborNode.weight;
      const existing = scored.get(neighborKey);
      if (existing && (existing.relationWeight ?? 0) >= relationWeight) continue;

      scored.set(neighborKey, {
        key: neighborNode.key,
        label: neighborNode.label,
        weight: neighborNode.weight,
        relationWeight,
        anchorKey: anchorNode?.key,
        anchorLabel: anchorNode?.label,
      });
    }

    return [...scored.values()]
      .sort((left, right) => (right.relationWeight ?? 0) - (left.relationWeight ?? 0) || right.weight - left.weight)
      .slice(0, 3);
  }
}

const normalizeText = (value: string) => value.trim().toLowerCase();

const textMatches = (corpus: string, label: string) => {
  const normalizedLabel = normalizeText(label);
  if (!corpus || !normalizedLabel) return false;

  return corpus.includes(normalizedLabel)
    || normalizedLabel.includes(corpus)
    || normalizedLabel.split(/[\s/()（）]+/).some((fragment) => fragment.length >= 2 && corpus.includes(fragment));
};
