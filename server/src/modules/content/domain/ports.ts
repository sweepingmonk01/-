import type {
  ContentCatalogQuery,
  ExamQuestion,
  FoundationKnowledgeEdge,
  FoundationKnowledgeNode,
  FoundationScienceCatalogQuery,
  KnowledgePoint,
  KnowledgePointNeighborhood,
} from './types.js';

export interface ContentCatalog {
  listKnowledgePoints(query?: ContentCatalogQuery): Promise<KnowledgePoint[]>;
  listExamQuestions(query?: ContentCatalogQuery): Promise<ExamQuestion[]>;
  getKnowledgePoint(id: string): Promise<KnowledgePoint | null>;
  getKnowledgePointNeighborhood(id: string): Promise<KnowledgePointNeighborhood | null>;
  listFoundationKnowledgeNodes(query?: FoundationScienceCatalogQuery): Promise<FoundationKnowledgeNode[]>;
  listFoundationKnowledgeEdges(query?: FoundationScienceCatalogQuery): Promise<FoundationKnowledgeEdge[]>;
  getFoundationKnowledgeNode(key: string): Promise<FoundationKnowledgeNode | null>;
}
