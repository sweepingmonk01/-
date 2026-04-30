import type {
  AIErrorDiagnosisRequest,
  AIErrorDiagnosisResult,
  AIErrorMistakeKey,
} from './errorDiagnosisTypes.js';

const primaryNodeByMistakeKey: Record<AIErrorMistakeKey, string> = {
  context_misread: 'language.context',
  rule_mismatch: 'language.rules',
  meaning_misunderstanding: 'language.meaning',
  conservation_missing: 'physics.symmetry_conservation',
  attention_distracted: 'neuroscience.cognition_consciousness',
  repeated_same_mistake: 'neuroscience.circuit',
  feedback_loop_broken: 'game.feedback_loop',
  unknown: 'language.rules',
};

const secondaryNodesByMistakeKey: Record<AIErrorMistakeKey, string[]> = {
  context_misread: ['neuroscience.cognition_consciousness', 'game.feedback_loop'],
  rule_mismatch: ['physics.symmetry_conservation', 'game.feedback_loop'],
  meaning_misunderstanding: ['language.context', 'neuroscience.cognition_consciousness'],
  conservation_missing: ['language.rules', 'game.feedback_loop'],
  attention_distracted: ['game.feedback_loop', 'neuroscience.circuit'],
  repeated_same_mistake: ['game.feedback_loop', 'language.rules'],
  feedback_loop_broken: ['neuroscience.circuit', 'language.context'],
  unknown: ['language.context', 'game.feedback_loop'],
};

function inferMistakeKeyFromText(text: string): AIErrorMistakeKey {
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
    request.questionText,
    request.studentAnswer,
    request.correctAnswer,
    request.painPoint,
    request.rule,
    request.subject,
    request.grade,
  ]
    .filter(Boolean)
    .join('\n');
}

function inferMistakeKeyFromRequest(request: AIErrorDiagnosisRequest) {
  const prioritizedTexts = [
    request.questionText,
    request.painPoint,
    request.rule,
  ].filter(Boolean);

  for (const text of prioritizedTexts) {
    const mistakeKey = inferMistakeKeyFromText(text);
    if (mistakeKey !== 'unknown') return mistakeKey;
  }

  return inferMistakeKeyFromText(collectRequestText(request));
}

function buildSummary(mistakeKey: AIErrorMistakeKey) {
  switch (mistakeKey) {
    case 'context_misread':
      return '学生没有把答案放回上下文和语境中判断，导致解释停留在表层。';
    case 'rule_mismatch':
      return '学生识别规则或公式时出现错配，后续解题路径被带偏。';
    case 'meaning_misunderstanding':
      return '学生抓到了表层信息，但没有对主旨、隐含意图或意义目标完成解释。';
    case 'conservation_missing':
      return '学生没有稳定追踪等量、平衡或总量关系，导致结构判断失真。';
    case 'attention_distracted':
      return '学生的注意力被局部条件或干扰项带偏，出现看错、漏看或粗心错误。';
    case 'repeated_same_mistake':
      return '学生在同类题上重复犯错，说明旧路径还没有被新的反馈修正。';
    case 'feedback_loop_broken':
      return '学生还没有形成稳定复盘回路，不清楚错误从哪一步开始发生。';
    case 'unknown':
      return '当前信息不足以稳定归因，建议先补充题干、错答和解题规则。';
  }
}

export function createMockErrorDiagnosis(
  request: AIErrorDiagnosisRequest,
): AIErrorDiagnosisResult {
  const mistakeKey = inferMistakeKeyFromRequest(request);
  const primaryNodeKey = primaryNodeByMistakeKey[mistakeKey];

  return {
    mistakeKey,
    confidence: mistakeKey === 'unknown' ? 0.42 : 0.78,
    summary: buildSummary(mistakeKey),
    fourLayerExplanation: {
      curriculum: '先回到题目要求，确认考查点、条件和答案目标。',
      worldEngine: '把题目看成一个有约束的系统，先找出稳定关系和变化条件。',
      mindEngine: '观察自己第一反应抓住了哪些信息，又忽略了哪些关键信号。',
      meaningEngine: '用一句话解释这道题真正要说明的意思，而不是只复述步骤。',
      gameMechanism: '完成答案后用反馈回路检查：条件、规则、结论是否互相支持。',
    },
    recommendedExploreNodes: {
      primaryNodeKey,
      secondaryNodeKeys: secondaryNodesByMistakeKey[mistakeKey].filter(
        (nodeKey) => nodeKey !== primaryNodeKey,
      ),
    },
    repairAction: '重做时先写下题目目标、关键条件和使用规则，再对照错答定位第一处偏差。',
    yufengSuggestion: `优先完成 ${primaryNodeKey} 探索节点，并把这次错因记录为下一次御风任务草案。`,
  };
}
