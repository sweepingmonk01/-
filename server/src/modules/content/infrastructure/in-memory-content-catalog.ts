import type { ExamQuestion, FoundationScienceCatalogQuery, KnowledgePoint } from '../domain/types.js';
import {
  SEEDED_FOUNDATION_KNOWLEDGE_EDGES,
  SEEDED_FOUNDATION_KNOWLEDGE_NODES,
} from './foundation-science-seeds.js';

export const SEEDED_KNOWLEDGE_POINTS: KnowledgePoint[] = [
  {
    id: 'ma-g8-geom-midpoint',
    reference: { subject: 'ma', grade: '八年级', version: '人教版', term: '下' },
    chapter: '图形与几何',
    section: '几何辅助线',
    title: '中点与倍长中线',
    masteryGoal: '遇到中点类范围题，优先尝试倍长中线或构造全等，不要直接硬算长度。',
    keywords: ['中点', '倍长中线', '辅助线', '全等', '范围'],
    commonMistakes: ['辅助线选择失误', '直接硬算', '不会倍长中线'],
    prerequisiteIds: [],
  },
  {
    id: 'en-g4-grammar-there-be',
    reference: { subject: 'en', grade: '四年级', version: '人教PEP', term: '下' },
    chapter: '语法基础',
    section: 'There be 句型',
    title: 'There is/are 就近一致',
    masteryGoal: 'there be 结构优先看最近主语，最近是单数用 is，复数用 are。',
    keywords: ['there is', 'there are', '最近主语', '单数', '复数'],
    commonMistakes: ['there be 混淆', '忽略最近主语'],
    prerequisiteIds: [],
  },
  {
    id: 'ma-g8-function-quadratic-vertex',
    reference: { subject: 'ma', grade: '八年级', version: '人教版', term: '下' },
    chapter: '函数',
    section: '二次函数',
    title: '二次函数顶点式与最值',
    masteryGoal: '看到顶点式先锁定对称轴和顶点，再判断开口方向与最值。',
    keywords: ['二次函数', '顶点式', '对称轴', '最值', '开口方向'],
    commonMistakes: ['对称轴漏判', '最值方向混淆', '顶点坐标读错'],
    prerequisiteIds: [],
  },
  {
    id: 'zh-g4-phonetic-polyphone',
    reference: { subject: 'zh', grade: '四年级', version: '部编版(人教)', term: '上' },
    chapter: '字词积累',
    section: '多音字辨析',
    title: '多音字结合词义判断',
    masteryGoal: '多音字先看词义和语境，再决定读音，不要靠单字机械记忆。',
    keywords: ['多音字', '词义', '语境', '银行', '成长'],
    commonMistakes: ['脱离词义判断', '机械背音'],
    prerequisiteIds: [],
  },
];

export const SEEDED_EXAM_QUESTIONS: ExamQuestion[] = [
  {
    id: 'ma-2025-sh-final-midpoint-range',
    subject: 'ma',
    grade: '八年级',
    region: '上海',
    source: 'final-exam',
    year: 2025,
    term: '下',
    questionType: '几何范围题',
    stem: '在 △ABC 中，D 是 AB 的中点。要求 CD 的取值范围时，最稳妥的第一步辅助线是什么？',
    answerSummary: '倍长中线，构造全等或平行四边形，再转化边的关系。',
    score: 4,
    difficulty: 'standard',
    knowledgePointIds: ['ma-g8-geom-midpoint'],
    tags: ['中点', '辅助线', '范围', '倍长中线'],
  },
  {
    id: 'ma-2024-js-unit-midpoint-proof',
    subject: 'ma',
    grade: '八年级',
    region: '江苏',
    source: 'unit-test',
    year: 2024,
    term: '下',
    questionType: '几何证明题',
    stem: '已知 D 为线段 AB 中点，补充辅助线后证明两三角形全等。',
    answerSummary: '延长中线并构造对应边相等，转入全等证明。',
    score: 5,
    difficulty: 'stretch',
    knowledgePointIds: ['ma-g8-geom-midpoint'],
    tags: ['中点', '全等', '辅助线'],
  },
  {
    id: 'ma-2026-zj-diagnostic-midpoint',
    subject: 'ma',
    grade: '八年级',
    region: '浙江',
    source: 'mock',
    year: 2026,
    term: '上',
    questionType: '几何综合题',
    stem: '已知 M 为线段 AB 中点，若需证明 CM 与另一条边关系成立，优先尝试哪类辅助线？',
    answerSummary: '优先考虑倍长中线，再结合全等或平行四边形转化关系。',
    score: 6,
    difficulty: 'stretch',
    knowledgePointIds: ['ma-g8-geom-midpoint'],
    tags: ['中点', '辅助线', '倍长中线', '综合题'],
  },
  {
    id: 'en-2025-hz-final-therebe',
    subject: 'en',
    grade: '四年级',
    region: '杭州',
    source: 'final-exam',
    year: 2025,
    term: '下',
    questionType: '单项选择',
    stem: 'There ___ a sofa and two chairs in the living room.',
    answerSummary: '看最近主语 a sofa，用 is。',
    score: 2,
    difficulty: 'foundation',
    knowledgePointIds: ['en-g4-grammar-there-be'],
    tags: ['there is', 'there are', '最近主语'],
  },
  {
    id: 'ma-2026-sh-unit-quadratic-vertex',
    subject: 'ma',
    grade: '八年级',
    region: '上海',
    source: 'unit-test',
    year: 2026,
    term: '下',
    questionType: '函数应用题',
    stem: '已知 y=a(x-h)^2+k，如何快速判断对称轴和最值？',
    answerSummary: '对称轴为 x=h；再看 a 的正负决定最大值或最小值为 k。',
    score: 5,
    difficulty: 'standard',
    knowledgePointIds: ['ma-g8-function-quadratic-vertex'],
    tags: ['二次函数', '顶点式', '对称轴', '最值'],
  },
  {
    id: 'zh-2024-bj-final-polyphone',
    subject: 'zh',
    grade: '四年级',
    region: '北京',
    source: 'final-exam',
    year: 2024,
    term: '上',
    questionType: '字音辨析',
    stem: '判断“行”在“银行”与“行走”中的正确读音。',
    answerSummary: '词义不同，读音不同；银行读 hang，行走读 xing。',
    score: 2,
    difficulty: 'foundation',
    knowledgePointIds: ['zh-g4-phonetic-polyphone'],
    tags: ['多音字', '银行', '词义'],
  },
];

export class InMemoryContentCatalog {
  async listKnowledgePoints(): Promise<KnowledgePoint[]> {
    return SEEDED_KNOWLEDGE_POINTS;
  }

  async listExamQuestions(): Promise<ExamQuestion[]> {
    return SEEDED_EXAM_QUESTIONS;
  }

  async listFoundationKnowledgeNodes(query: FoundationScienceCatalogQuery = {}) {
    return SEEDED_FOUNDATION_KNOWLEDGE_NODES.filter((node) => {
      if (query.domain && node.domain !== query.domain) return false;
      if (!query.keyword) return true;

      const corpus = [
        node.key,
        node.label,
        node.summary,
        node.coreQuestion,
        ...node.keywords,
        ...node.relatedMistakePatterns,
      ].join(' ').toLowerCase();
      return corpus.includes(query.keyword.toLowerCase());
    });
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
}
