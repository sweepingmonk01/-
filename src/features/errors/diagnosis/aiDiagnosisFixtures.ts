import type {
  AIErrorDiagnosisApiResponse,
  AIErrorDiagnosisMistakeKey,
  AIErrorDiagnosisRequest,
  AIErrorDiagnosisResult,
  AIErrorDiagnosisSubject,
} from './aiDiagnosisTypes';
import { AI_ERROR_DIAGNOSIS_SCHEMA_VERSION } from './aiDiagnosisTypes';

export function buildAIErrorDiagnosisRequestFixture(input?: {
  questionText?: string;
  ocrText?: string;
  subject?: AIErrorDiagnosisSubject;
  grade?: string;
}): AIErrorDiagnosisRequest {
  return {
    schemaVersion: AI_ERROR_DIAGNOSIS_SCHEMA_VERSION,
    errorInput: {
      questionText: input?.questionText ??
        '阅读材料后回答：为什么主人公最后改变了决定？',
      ocrText: input?.ocrText,
      studentAnswer: '因为他一开始想错了。',
      correctAnswer: '他理解了同伴的真实意图，并重新判断了情境。',
      explanationText: '答案需要结合上下文中的人物动机和情境变化。',
      subject: input?.subject ?? 'zh',
      grade: input?.grade ?? '七年级',
    },
    learningProfile: {
      worldModelIndex: 0.4,
      mindModelIndex: 0.4,
      meaningModelIndex: 0.4,
      actionMechanismIndex: 0.25,
      activeStructuralIntelligence: 0.45,
      dominantStrength: 'world',
      dominantWeakness: 'game',
      stage: 'forming',
      profileSummary: '学习者已经开始形成基础结构，但证据还不稳定。',
      recommendedNextFocus: '建议优先补强反馈回路。',
      recommendedNodeKey: 'game.feedback_loop',
    },
    clientMeta: {
      appVersion: 'local-dev',
      source: 'test',
      requestedAt: '2026-01-01T00:00:00.000Z',
    },
  };
}

export function buildAIErrorDiagnosisResultFixture(input?: {
  mistakeKey?: AIErrorDiagnosisMistakeKey;
  confidence?: number;
  primaryNodeKey?: string;
  secondaryNodeKeys?: string[];
}): AIErrorDiagnosisResult {
  return {
    mistakeKey: input?.mistakeKey ?? 'context_misread',
    confidence: input?.confidence ?? 0.78,
    summary: '学生没有把答案放回上下文和人物动机中判断，导致解释停留在表层。',
    fourLayerExplanation: {
      curriculum: '这类题需要回到材料，找出人物、情境和关键转折。',
      worldEngine: '题目中的事件不是孤立发生的，人物行为受到情境约束。',
      mindEngine: '学生可能只抓住了表面动作，没有推断人物想法的变化。',
      meaningEngine: '真正要解释的是“为什么改变”，不是复述“发生了什么”。',
      gameMechanism: '先定位关键信号，再用反馈回路检查答案是否解释了题目目标。',
    },
    recommendedExploreNodes: {
      primaryNodeKey: input?.primaryNodeKey ?? 'language.context',
      secondaryNodeKeys: input?.secondaryNodeKeys ?? [
        'neuroscience.cognition_consciousness',
        'game.feedback_loop',
      ],
    },
    repairAction: '重做时先圈出人物、时间、场景、目的，再写一句“改变的原因”。',
    yufengSuggestion: '完成语境判断节点后，保存一次御风快照，观察意义模型是否提升。',
  };
}

export function buildAIErrorDiagnosisSuccessResponseFixture(input?: {
  mistakeKey?: AIErrorDiagnosisMistakeKey;
  confidence?: number;
  primaryNodeKey?: string;
  secondaryNodeKeys?: string[];
  diagnosedAt?: string;
}): AIErrorDiagnosisApiResponse {
  return {
    ok: true,
    diagnosedAt: input?.diagnosedAt ?? '2026-01-01T00:00:00.000Z',
    result: buildAIErrorDiagnosisResultFixture({
      mistakeKey: input?.mistakeKey,
      confidence: input?.confidence,
      primaryNodeKey: input?.primaryNodeKey,
      secondaryNodeKeys: input?.secondaryNodeKeys,
    }),
    message: 'Fixture diagnosis success.',
  };
}

export function buildAIErrorDiagnosisFailureResponseFixture(): AIErrorDiagnosisApiResponse {
  return {
    ok: false,
    diagnosedAt: '2026-01-01T00:00:00.000Z',
    message: 'Fixture diagnosis failure.',
    errors: [
      {
        code: 'MISSING_ERROR_CONTENT',
        message: 'Provide questionText or ocrText before diagnosis.',
        path: 'errorInput',
      },
    ],
  };
}
