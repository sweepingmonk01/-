import type { AIErrorDiagnosisClient } from './aiDiagnosisClientTypes';
import {
  type AIErrorDiagnosisMistakeKey,
  type AIErrorDiagnosisRequest,
} from './aiDiagnosisTypes';
import { buildAIErrorDiagnosisSuccessResponseFixture } from './aiDiagnosisFixtures';
import { validateAIErrorDiagnosisRequest } from './aiDiagnosisValidators';

function inferMistakeKeyFromText(text: string): AIErrorDiagnosisMistakeKey {
  const source = text.toLowerCase();

  if (/语境|阅读|上下文|context/.test(source)) return 'context_misread';
  if (/规则|公式|语法|运算|rule|formula/.test(source)) return 'rule_mismatch';
  if (/意思|主旨|隐含|作者意图|meaning|main idea/.test(source)) {
    return 'meaning_misunderstanding';
  }
  if (/守恒|等量|平衡|总量|conservation|balance/.test(source)) {
    return 'conservation_missing';
  }
  if (/粗心|注意|看错|漏看|attention|careless/.test(source)) {
    return 'attention_distracted';
  }
  if (/反复|同类|又错|repeated/.test(source)) {
    return 'repeated_same_mistake';
  }
  if (/反馈|复盘|不知道为什么错|没复盘|feedback/.test(source)) {
    return 'feedback_loop_broken';
  }

  return 'unknown';
}

function collectRequestText(request: AIErrorDiagnosisRequest) {
  return [
    request.errorInput.questionText,
    request.errorInput.ocrText,
    request.errorInput.studentAnswer,
    request.errorInput.correctAnswer,
    request.errorInput.explanationText,
    request.errorInput.painPoint,
    request.errorInput.rule,
    request.errorInput.subject,
    request.errorInput.grade,
    request.learningProfile?.profileSummary,
    request.learningProfile?.recommendedNextFocus,
    request.learningProfile?.recommendedNodeKey,
  ]
    .filter(Boolean)
    .join('\n');
}

function inferMistakeKeyFromRequest(request: AIErrorDiagnosisRequest) {
  const prioritizedTexts = [
    request.errorInput.questionText,
    request.errorInput.ocrText,
    request.errorInput.explanationText,
  ].filter(Boolean);

  for (const text of prioritizedTexts) {
    const mistakeKey = inferMistakeKeyFromText(text);
    if (mistakeKey !== 'unknown') return mistakeKey;
  }

  return inferMistakeKeyFromText(collectRequestText(request));
}

export const mockAiDiagnosisClient: AIErrorDiagnosisClient = {
  async diagnose(request) {
    const validation = validateAIErrorDiagnosisRequest(request);

    if (!validation.ok) {
      return {
        ok: false,
        diagnosedAt: new Date().toISOString(),
        errors: validation.errors,
        message: 'Mock diagnosis request is invalid.',
      };
    }

    const mistakeKey = inferMistakeKeyFromRequest(request);

    return buildAIErrorDiagnosisSuccessResponseFixture({
      mistakeKey,
      diagnosedAt: new Date().toISOString(),
    });
  },
};
