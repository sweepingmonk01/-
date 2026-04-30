import type { DiagnosedMistakePattern, ErrorRecord, KnowledgeAction } from '../../learning/domain/protocol.js';

export type SubjectCode = 'zh' | 'ma' | 'en';
export type FoundationScienceDomain = 'physics' | 'neuroscience';
export type KnowledgeDomainLayer = 'curriculum' | 'foundation-science' | 'meta-cognition' | 'application';
export type FoundationKnowledgeScale = 'global' | 'module' | 'concept' | 'mechanism' | 'task';
export type KnowledgeEdgeKind =
  | 'prerequisite'
  | 'explains'
  | 'analogy'
  | 'contrasts'
  | 'applies-to'
  | 'supports-cognition'
  | 'maps-to-curriculum'
  | 'maps-to-mistake';

export interface TextbookReference {
  subject: SubjectCode;
  grade: string;
  version: string;
  term?: '上' | '下' | '全';
}

export interface KnowledgePoint {
  id: string;
  reference: TextbookReference;
  chapter: string;
  section: string;
  title: string;
  masteryGoal: string;
  keywords: string[];
  commonMistakes: string[];
  prerequisiteIds: string[];
}

export interface FoundationKnowledgeNode {
  key: string;
  label: string;
  domain: FoundationScienceDomain;
  domainLayer: Extract<KnowledgeDomainLayer, 'foundation-science'>;
  scale: FoundationKnowledgeScale;
  summary: string;
  coreQuestion: string;
  prerequisites: string[];
  relatedCurriculumNodes: string[];
  relatedMistakePatterns: string[];
  keywords: string[];
  mediaPromptSeed: {
    visualMetaphor: string;
    gptImageStyle: string;
    seedanceStoryboard: string[];
  };
}

export interface FoundationKnowledgeEdge {
  source: string;
  target: string;
  kind: KnowledgeEdgeKind;
  rationale: string;
}

export interface FoundationKnowledgeMatch {
  node: FoundationKnowledgeNode;
  score: number;
  reasons: string[];
  edges: FoundationKnowledgeEdge[];
}

export interface FoundationScienceCatalogQuery {
  domain?: FoundationScienceDomain;
  keyword?: string;
}

export interface ExamQuestion {
  id: string;
  subject: SubjectCode;
  grade: string;
  region: string;
  source: 'final-exam' | 'unit-test' | 'mock';
  year: number;
  term?: '上' | '下';
  questionType: string;
  stem: string;
  answerSummary: string;
  score: number;
  difficulty: 'foundation' | 'standard' | 'stretch';
  knowledgePointIds: string[];
  tags: string[];
}

export interface ErrorToContentInput {
  studentId?: string;
  subject?: SubjectCode;
  grade?: string;
  painPoint: string;
  rule?: string;
  questionText?: string;
}

export interface ContentMatch {
  knowledgePoint: KnowledgePoint;
  score: number;
  reasons: string[];
}

export interface QuestionMatch {
  question: ExamQuestion;
  overlapKnowledgePointIds: string[];
  rationale: string;
}

export interface KnowledgePointNeighborhood {
  knowledgePoint: KnowledgePoint;
  prerequisites: KnowledgePoint[];
  dependents: KnowledgePoint[];
  relatedQuestions: ExamQuestion[];
}

export interface ContentCatalogQuery {
  subject?: SubjectCode;
  grade?: string;
  keyword?: string;
}

export interface MobiusStorySeed {
  painPoint: string;
  rule: string;
  questionText: string;
  recommendedKnowledgePointId?: string;
  evidence: string[];
  diagnosedMistakes: DiagnosedMistakePattern[];
  knowledgeAction: KnowledgeAction;
}

export interface ErrorToContentResolution {
  input: ErrorToContentInput;
  errorRecord: ErrorRecord;
  matchedKnowledgePoints: ContentMatch[];
  recommendedFoundationNodes: FoundationKnowledgeMatch[];
  relatedQuestions: QuestionMatch[];
  recommendedStorySeed: MobiusStorySeed;
}
