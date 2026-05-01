import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { ContentCatalog } from '../domain/ports.js';
import type {
  ContentCatalogQuery,
  ExamQuestion,
  FoundationScienceCatalogQuery,
  KnowledgePoint,
  KnowledgePointNeighborhood,
  SubjectCode,
} from '../domain/types.js';
import { SEEDED_EXAM_QUESTIONS, SEEDED_KNOWLEDGE_POINTS } from './in-memory-content-catalog.js';
import {
  SEEDED_FOUNDATION_KNOWLEDGE_EDGES,
  SEEDED_FOUNDATION_KNOWLEDGE_NODES,
} from './foundation-science-seeds.js';

interface SQLiteContentCatalogOptions {
  dbFile: string;
}

interface KnowledgePointRow {
  id: string;
  subject: SubjectCode;
  grade: string;
  version: string;
  term: '上' | '下' | '全' | null;
  chapter: string;
  section: string;
  title: string;
  mastery_goal: string;
  keywords_json: string;
  common_mistakes_json: string;
  prerequisite_ids_json: string;
}

interface ExamQuestionRow {
  id: string;
  subject: SubjectCode;
  grade: string;
  region: string;
  source: ExamQuestion['source'];
  year: number;
  term: '上' | '下' | null;
  question_type: string;
  stem: string;
  answer_summary: string;
  score: number;
  difficulty: ExamQuestion['difficulty'];
  knowledge_point_ids_json: string;
  tags_json: string;
}

const normalize = (value: string) => value.toLowerCase();

export class SQLiteContentCatalog implements ContentCatalog {
  private readonly db: DatabaseSync;

  constructor(options: SQLiteContentCatalogOptions) {
    mkdirSync(path.dirname(options.dbFile), { recursive: true });
    this.db = new DatabaseSync(options.dbFile);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS content_knowledge_points (
        id TEXT PRIMARY KEY,
        subject TEXT NOT NULL,
        grade TEXT NOT NULL,
        version TEXT NOT NULL,
        term TEXT,
        chapter TEXT NOT NULL,
        section TEXT NOT NULL,
        title TEXT NOT NULL,
        mastery_goal TEXT NOT NULL,
        keywords_json TEXT NOT NULL,
        common_mistakes_json TEXT NOT NULL,
        prerequisite_ids_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS content_exam_questions (
        id TEXT PRIMARY KEY,
        subject TEXT NOT NULL,
        grade TEXT NOT NULL,
        region TEXT NOT NULL,
        source TEXT NOT NULL,
        year INTEGER NOT NULL,
        term TEXT,
        question_type TEXT NOT NULL,
        stem TEXT NOT NULL,
        answer_summary TEXT NOT NULL,
        score INTEGER NOT NULL,
        difficulty TEXT NOT NULL,
        knowledge_point_ids_json TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_content_kp_subject_grade
      ON content_knowledge_points (subject, grade);
      CREATE INDEX IF NOT EXISTS idx_content_question_subject_grade
      ON content_exam_questions (subject, grade);
    `);
    this.seedDefaults();
  }

  async listKnowledgePoints(query: ContentCatalogQuery = {}): Promise<KnowledgePoint[]> {
    const rows = this.db.prepare(`
      SELECT * FROM content_knowledge_points
      ORDER BY subject, grade, chapter, section, title
    `).all() as unknown as KnowledgePointRow[];

    return rows
      .map((row) => this.mapKnowledgePoint(row))
      .filter((item) => this.matchesKnowledgePoint(item, query));
  }

  async listExamQuestions(query: ContentCatalogQuery = {}): Promise<ExamQuestion[]> {
    const rows = this.db.prepare(`
      SELECT * FROM content_exam_questions
      ORDER BY year DESC, subject, grade, id
    `).all() as unknown as ExamQuestionRow[];

    return rows
      .map((row) => this.mapExamQuestion(row))
      .filter((item) => this.matchesQuestion(item, query));
  }

  async getKnowledgePoint(id: string): Promise<KnowledgePoint | null> {
    const row = this.db.prepare(`
      SELECT * FROM content_knowledge_points WHERE id = ?
    `).get(id) as unknown as KnowledgePointRow | undefined;

    return row ? this.mapKnowledgePoint(row) : null;
  }

  async getKnowledgePointNeighborhood(id: string): Promise<KnowledgePointNeighborhood | null> {
    const knowledgePoint = await this.getKnowledgePoint(id);
    if (!knowledgePoint) return null;

    const allPoints = await this.listKnowledgePoints();
    const questions = await this.listExamQuestions();
    const prerequisites = knowledgePoint.prerequisiteIds
      .map((prerequisiteId) => allPoints.find((item) => item.id === prerequisiteId))
      .filter((item): item is KnowledgePoint => Boolean(item));
    const dependents = allPoints.filter((item) => item.prerequisiteIds.includes(id));
    const relatedQuestions = questions.filter((question) => question.knowledgePointIds.includes(id));

    return {
      knowledgePoint,
      prerequisites,
      dependents,
      relatedQuestions,
    };
  }

  async listFoundationKnowledgeNodes(query: FoundationScienceCatalogQuery = {}) {
    return SEEDED_FOUNDATION_KNOWLEDGE_NODES.filter((node) => this.matchesFoundationNode(node, query));
  }

  async listFoundationKnowledgeEdges(query: FoundationScienceCatalogQuery = {}) {
    if (!query.domain && !query.keyword) return SEEDED_FOUNDATION_KNOWLEDGE_EDGES;

    const nodes = await this.listFoundationKnowledgeNodes(query);
    const nodeKeys = new Set(nodes.map((node) => node.key));
    return SEEDED_FOUNDATION_KNOWLEDGE_EDGES.filter((edge) => nodeKeys.has(edge.source) || nodeKeys.has(edge.target));
  }

  async getFoundationKnowledgeNode(key: string) {
    return SEEDED_FOUNDATION_KNOWLEDGE_NODES.find((node) => node.key === key) ?? null;
  }

  private seedDefaults() {
    const now = new Date().toISOString();
    for (const item of SEEDED_KNOWLEDGE_POINTS) {
      this.db.prepare(`
        INSERT INTO content_knowledge_points (
          id, subject, grade, version, term, chapter, section, title, mastery_goal,
          keywords_json, common_mistakes_json, prerequisite_ids_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          subject = excluded.subject,
          grade = excluded.grade,
          version = excluded.version,
          term = excluded.term,
          chapter = excluded.chapter,
          section = excluded.section,
          title = excluded.title,
          mastery_goal = excluded.mastery_goal,
          keywords_json = excluded.keywords_json,
          common_mistakes_json = excluded.common_mistakes_json,
          prerequisite_ids_json = excluded.prerequisite_ids_json,
          updated_at = excluded.updated_at
      `).run(
        item.id,
        item.reference.subject,
        item.reference.grade,
        item.reference.version,
        item.reference.term ?? null,
        item.chapter,
        item.section,
        item.title,
        item.masteryGoal,
        JSON.stringify(item.keywords),
        JSON.stringify(item.commonMistakes),
        JSON.stringify(item.prerequisiteIds),
        now,
      );
    }

    for (const item of SEEDED_EXAM_QUESTIONS) {
      this.db.prepare(`
        INSERT INTO content_exam_questions (
          id, subject, grade, region, source, year, term, question_type, stem,
          answer_summary, score, difficulty, knowledge_point_ids_json, tags_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          subject = excluded.subject,
          grade = excluded.grade,
          region = excluded.region,
          source = excluded.source,
          year = excluded.year,
          term = excluded.term,
          question_type = excluded.question_type,
          stem = excluded.stem,
          answer_summary = excluded.answer_summary,
          score = excluded.score,
          difficulty = excluded.difficulty,
          knowledge_point_ids_json = excluded.knowledge_point_ids_json,
          tags_json = excluded.tags_json,
          updated_at = excluded.updated_at
      `).run(
        item.id,
        item.subject,
        item.grade,
        item.region,
        item.source,
        item.year,
        item.term ?? null,
        item.questionType,
        item.stem,
        item.answerSummary,
        item.score,
        item.difficulty,
        JSON.stringify(item.knowledgePointIds),
        JSON.stringify(item.tags),
        now,
      );
    }
  }

  private matchesKnowledgePoint(item: KnowledgePoint, query: ContentCatalogQuery) {
    if (query.subject && item.reference.subject !== query.subject) return false;
    if (query.grade && item.reference.grade !== query.grade) return false;
    if (!query.keyword) return true;

    const corpus = normalize([
      item.title,
      item.chapter,
      item.section,
      item.masteryGoal,
      ...item.keywords,
      ...item.commonMistakes,
    ].join(' '));
    return corpus.includes(normalize(query.keyword));
  }

  private matchesQuestion(item: ExamQuestion, query: ContentCatalogQuery) {
    if (query.subject && item.subject !== query.subject) return false;
    if (query.grade && item.grade !== query.grade) return false;
    if (!query.keyword) return true;

    const corpus = normalize([
      item.stem,
      item.answerSummary,
      item.questionType,
      ...item.tags,
    ].join(' '));
    return corpus.includes(normalize(query.keyword));
  }

  private matchesFoundationNode(
    item: (typeof SEEDED_FOUNDATION_KNOWLEDGE_NODES)[number],
    query: FoundationScienceCatalogQuery,
  ) {
    if (query.domain && item.domain !== query.domain) return false;
    if (!query.keyword) return true;

    const corpus = normalize([
      item.key,
      item.label,
      item.summary,
      item.coreQuestion,
      ...item.keywords,
      ...item.relatedMistakePatterns,
    ].join(' '));
    return corpus.includes(normalize(query.keyword));
  }

  private mapKnowledgePoint(row: KnowledgePointRow): KnowledgePoint {
    return {
      id: row.id,
      reference: {
        subject: row.subject,
        grade: row.grade,
        version: row.version,
        term: row.term ?? undefined,
      },
      chapter: row.chapter,
      section: row.section,
      title: row.title,
      masteryGoal: row.mastery_goal,
      keywords: JSON.parse(row.keywords_json) as string[],
      commonMistakes: JSON.parse(row.common_mistakes_json) as string[],
      prerequisiteIds: JSON.parse(row.prerequisite_ids_json) as string[],
    };
  }

  private mapExamQuestion(row: ExamQuestionRow): ExamQuestion {
    return {
      id: row.id,
      subject: row.subject,
      grade: row.grade,
      region: row.region,
      source: row.source,
      year: row.year,
      term: row.term ?? undefined,
      questionType: row.question_type,
      stem: row.stem,
      answerSummary: row.answer_summary,
      score: row.score,
      difficulty: row.difficulty,
      knowledgePointIds: JSON.parse(row.knowledge_point_ids_json) as string[],
      tags: JSON.parse(row.tags_json) as string[],
    };
  }
}
