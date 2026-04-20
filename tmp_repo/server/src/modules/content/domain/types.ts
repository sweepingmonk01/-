import type { DiagnosedMistakePattern, ErrorRecord, KnowledgeAction } from '../../learning/domain/protocol.js';

export type SubjectCode = 'zh' | 'ma' | 'en';

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
  relatedQuestions: QuestionMatch[];
  recommendedStorySeed: MobiusStorySeed;
}
