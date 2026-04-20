import type { ExamQuestion, ErrorToContentInput, ErrorToContentResolution, KnowledgePoint, QuestionMatch } from '../domain/types.js';
import type { DiagnosedMistakePattern, KnowledgeAction, MistakeCategory } from '../../learning/domain/protocol.js';

interface ContentCatalog {
  listKnowledgePoints(): Promise<KnowledgePoint[]>;
  listExamQuestions(): Promise<ExamQuestion[]>;
}

interface ContentOrchestratorDeps {
  catalog: ContentCatalog;
}

const normalize = (value: string) => value.toLowerCase();

export class ContentOrchestrator {
  constructor(private readonly deps: ContentOrchestratorDeps) {}

  async resolveErrorContext(input: ErrorToContentInput): Promise<ErrorToContentResolution> {
    const [knowledgePoints, examQuestions] = await Promise.all([
      this.deps.catalog.listKnowledgePoints(),
      this.deps.catalog.listExamQuestions(),
    ]);

    const corpus = normalize([input.painPoint, input.rule, input.questionText].filter(Boolean).join(' '));
    const matchedKnowledgePoints = knowledgePoints
      .filter((item) => !input.subject || item.reference.subject === input.subject)
      .filter((item) => !input.grade || item.reference.grade === input.grade)
      .map((knowledgePoint) => {
        const reasons: string[] = [];
        let score = 0;

        for (const keyword of knowledgePoint.keywords) {
          if (corpus.includes(normalize(keyword))) {
            score += 3;
            reasons.push(`命中关键词: ${keyword}`);
          }
        }

        for (const mistake of knowledgePoint.commonMistakes) {
          if (corpus.includes(normalize(mistake))) {
            score += 2;
            reasons.push(`命中常见错因: ${mistake}`);
          }
        }

        if (normalize(input.painPoint).includes(normalize(knowledgePoint.title))) {
          score += 4;
          reasons.push(`痛点直接贴合知识点标题: ${knowledgePoint.title}`);
        }

        return {
          knowledgePoint,
          score,
          reasons,
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const matchedIds = new Set(matchedKnowledgePoints.map((item) => item.knowledgePoint.id));
    const relatedQuestions = examQuestions
      .filter((question) => !input.subject || question.subject === input.subject)
      .filter((question) => !input.grade || question.grade === input.grade)
      .map<QuestionMatch | null>((question) => {
        const overlapKnowledgePointIds = question.knowledgePointIds.filter((id) => matchedIds.has(id));
        const matchedTags = question.tags.filter((tag) => corpus.includes(normalize(tag)));
        if (!overlapKnowledgePointIds.length && !matchedTags.length) {
          return null;
        }

        const rationaleParts = [];
        if (overlapKnowledgePointIds.length) {
          rationaleParts.push(`关联知识点 ${overlapKnowledgePointIds.join(', ')}`);
        }
        if (matchedTags.length) {
          rationaleParts.push(`题目标签命中 ${matchedTags.join(', ')}`);
        }

        return {
          question,
          overlapKnowledgePointIds,
          rationale: rationaleParts.join('；'),
        };
      })
      .filter((item): item is QuestionMatch => Boolean(item))
      .sort((a, b) => b.overlapKnowledgePointIds.length - a.overlapKnowledgePointIds.length || b.question.year - a.question.year)
      .slice(0, 5);

    const topKnowledgePoint = matchedKnowledgePoints[0]?.knowledgePoint;
    const diagnosedMistakes = this.buildDiagnosedMistakes(input, topKnowledgePoint);
    const knowledgeAction = this.buildKnowledgeAction(input, topKnowledgePoint, diagnosedMistakes[0]?.category);
    const evidence = [
      ...matchedKnowledgePoints.flatMap((item) => item.reasons.slice(0, 2)),
      ...relatedQuestions.slice(0, 2).map((item) => `相似真题: ${item.question.year} ${item.question.region} ${item.question.questionType}`),
    ].slice(0, 5);

    return {
      input,
      errorRecord: {
        painPoint: input.painPoint,
        rule: input.rule ?? topKnowledgePoint?.masteryGoal ?? '围绕命中的知识点给出更窄一步的操作规则。',
        questionText: input.questionText,
        subject: input.subject,
        grade: input.grade,
        diagnosedMistakes,
        knowledgeAction,
      },
      matchedKnowledgePoints,
      relatedQuestions,
      recommendedStorySeed: {
        painPoint: input.painPoint,
        rule: input.rule ?? topKnowledgePoint?.masteryGoal ?? '围绕命中的知识点给出更窄一步的操作规则。',
        questionText: input.questionText ?? relatedQuestions[0]?.question.stem ?? input.painPoint,
        recommendedKnowledgePointId: topKnowledgePoint?.id,
        evidence,
        diagnosedMistakes,
        knowledgeAction,
      },
    };
  }

  private buildDiagnosedMistakes(input: ErrorToContentInput, knowledgePoint?: KnowledgePoint): DiagnosedMistakePattern[] {
    const corpus = normalize([input.painPoint, input.rule, input.questionText].filter(Boolean).join(' '));
    const patterns: DiagnosedMistakePattern[] = [];

    const pushPattern = (
      id: string,
      category: MistakeCategory,
      label: string,
      description: string,
      evidence: string[],
      coachingHint: string,
    ) => {
      patterns.push({ id, category, label, description, evidence, coachingHint });
    };

    if (/中点|辅助线|先想|第一步|最稳妥/.test(corpus)) {
      pushPattern(
        'mistake-strategy-selection',
        'strategy-selection',
        '第一步策略选择失误',
        '学生知道题型大概方向，但不会优先挑选最稳的解题动作。',
        [input.painPoint, input.rule ?? '缺少稳定规则'],
        '先固定第一步动作，再进入推理，不要一上来硬算。',
      );
    }

    if (/there is|there are|单数|复数|最近主语/.test(corpus)) {
      pushPattern(
        'mistake-rule-recall',
        'rule-recall',
        '规则召回不稳定',
        '学生接触过规则，但在真实题面里不能及时提取正确口诀。',
        [input.painPoint, input.rule ?? '缺少句型规则'],
        '先口头复述规则，再作答。',
      );
    }

    if (/多音字|词义|语境|银行|成长/.test(corpus)) {
      pushPattern(
        'mistake-language-mapping',
        'language-mapping',
        '词义到规则映射失稳',
        '学生能识别字词，但不能稳定地把语境映射到正确读法或规则。',
        [input.painPoint, input.questionText ?? '缺少题干'],
        '先判断语境意思，再决定读音或答案。',
      );
    }

    if (!patterns.length) {
      pushPattern(
        'mistake-concept-confusion',
        knowledgePoint ? 'concept-confusion' : 'rule-recall',
        knowledgePoint ? `知识点“${knowledgePoint.title}”理解不稳` : '核心规则提取不稳',
        knowledgePoint
          ? '学生对命中知识点存在理解断裂，导致做题时动作不稳定。'
          : '学生目前缺少一条可立即执行的稳定规则。',
        [input.painPoint, input.rule ?? '尚未建立显性法则'],
        knowledgePoint?.masteryGoal ?? '先把规则压缩成一句可执行的话，再练一次。',
      );
    }

    return patterns.slice(0, 2);
  }

  private buildKnowledgeAction(
    input: ErrorToContentInput,
    knowledgePoint: KnowledgePoint | undefined,
    primaryMistakeCategory: MistakeCategory | undefined,
  ): KnowledgeAction {
    const subject = input.subject ?? knowledgePoint?.reference.subject ?? 'ma';
    const actionType =
      subject === 'zh' ? 'select' :
      subject === 'en' ? 'sequence' :
      primaryMistakeCategory === 'strategy-selection' ? 'draw' :
      'select';

    const label =
      subject === 'ma' ? '锁定第一步辅助线动作' :
      subject === 'en' ? '先判最近主语再定答案' :
      '先判语境再锁定读音';

    const instruction =
      subject === 'ma'
        ? `先识别题目中的关键条件，再执行“${input.rule ?? knowledgePoint?.masteryGoal ?? '稳定第一步'}”这一动作。`
        : subject === 'en'
          ? `先口头或心里复述规则“${input.rule ?? knowledgePoint?.masteryGoal ?? '看最近主语'}”，再按顺序判定答案。`
          : `先判断词义语境，再根据“${input.rule ?? knowledgePoint?.masteryGoal ?? '先看语境'}”选择答案。`;

    return {
      id: `action-${subject}-${primaryMistakeCategory ?? 'default'}`,
      label,
      actionType,
      instruction,
      successCriteria: [
        '先完成规则触发，再进入最终答案选择。',
        '动作顺序稳定，且能说出为什么这样做。',
      ],
      failureSignals: [
        '直接猜答案，没有显式触发规则。',
        '第一步动作摇摆，仍靠直觉试错。',
      ],
    };
  }
}
