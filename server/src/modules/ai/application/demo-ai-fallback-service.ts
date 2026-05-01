import type { AIQuestionData, DehydrateHomeworkInput, DehydrateResult, StrategicQuestionPlan } from '../domain/types.js';

const ANALYZE_SAMPLES: AIQuestionData[] = [
  {
    painPoint: '几何中点辅助线选择失误',
    rule: '遇中点，先想倍长中线；造全等比硬算更稳。',
    questionText: '在 △ABC 中，D 为 AB 中点。若想判断 CD 的范围，第一步最稳妥的辅助线应该是什么？',
    options: [
      '延长 CD 到 E，使 DE = CD，并连接 AE、BE',
      '过 C 作 CF 垂直于 AB',
      '作 AB 的垂直平分线',
      '过 D 作 DE 平行于 BC',
    ],
    correctAnswer: '延长 CD 到 E，使 DE = CD，并连接 AE、BE',
  },
  {
    painPoint: 'There is/are 结构混淆',
    rule: 'there be 看最近主语，单数 is，复数 are。',
    questionText: '选择正确句子：On the desk, there ___ a pen and two notebooks.',
    options: ['is', 'are', 'be', 'were'],
    correctAnswer: 'is',
  },
  {
    painPoint: '多音字辨析不稳定',
    rule: '先看词义再定读音，别只盯字形。',
    questionText: '下列句子中，“长”的读音正确的一项是？“这家银行行长常鼓励学生成长。”',
    options: [
      '两个“长”都读 chang',
      '前一个读 zhang，后一个读 chang',
      '前一个读 chang，后一个读 zhang',
      '两个“长”都读 zhang',
    ],
    correctAnswer: '前一个读 zhang，后一个读 chang',
  },
];

const FALLBACK_FOCUS_TOPICS = [
  '先触发题眼规则再作答',
  '优先锁定第一步动作',
  '把高频失误题放到主攻区',
  '复核最近连续失败的知识点',
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const gcd = (left: number, right: number): number => (right === 0 ? left : gcd(right, left % right));

const hashText = (value: string) => {
  let hash = 0;
  const input = value.slice(0, 4096);
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const dedupe = (items: string[]) => {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const item of items) {
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }

  return output;
};

const buildMustDoIndices = (total: number, mustDo: number, hash: number) => {
  const picks = new Set<number>();
  const safeTotal = Math.max(total, 1);
  let cursor = hash % safeTotal;
  let step = (hash % Math.max(safeTotal - 1, 1)) + 1;

  while (gcd(step, safeTotal) !== 1) {
    step += 1;
  }

  while (picks.size < mustDo) {
    picks.add((cursor % safeTotal) + 1);
    cursor += step;
  }

  return Array.from(picks)
    .sort((left, right) => left - right)
    .map((index) => `Q${index}`)
    .join(', ');
};

const buildQuestionPlans = (
  mustDoLabels: string[],
  focusTopics: string[],
  weakTopicAlerts: string[],
): StrategicQuestionPlan[] => {
  const plans: StrategicQuestionPlan[] = [];
  const attackLabels = mustDoLabels.slice(0, 4);

  attackLabels.forEach((label, index) => {
    plans.push({
      questionLabel: label,
      topic: focusTopics[index % focusTopics.length] ?? FALLBACK_FOCUS_TOPICS[index % FALLBACK_FOCUS_TOPICS.length],
      action: index === attackLabels.length - 1 ? 'review' : 'attack',
      estimatedMinutes: index === 0 ? 7 : 5,
      roiScore: clamp(88 - index * 9, 55, 95),
      rationale: index === 0
        ? '先吃最稳的题，立刻建立提分斜率。'
        : '这题和近期失误高度重合，先修这里最值。',
      extractedKnowledgePoint: weakTopicAlerts[index] ?? focusTopics[index % focusTopics.length] ?? '第一步规则触发',
    });
  });

  if (!plans.length) {
    plans.push({
      questionLabel: 'Q1',
      topic: focusTopics[0] ?? FALLBACK_FOCUS_TOPICS[0],
      action: 'attack',
      estimatedMinutes: 6,
      roiScore: 82,
      rationale: '先拿最短路径题，不要全卷平推。',
      extractedKnowledgePoint: weakTopicAlerts[0] ?? '第一步规则触发',
    });
  }

  return plans;
};

export const createDemoAnalyzeQuestionImageResult = (input: {
  imageBase64: string;
  mimeType: string;
}): AIQuestionData => {
  const hash = hashText(`${input.mimeType}:${input.imageBase64}`);
  return ANALYZE_SAMPLES[hash % ANALYZE_SAMPLES.length]!;
};

export const createDemoDehydrateHomeworkResult = (input: DehydrateHomeworkInput): DehydrateResult => {
  const hash = hashText(`${input.mimeType}:${input.imageBase64}:${input.targetScore}`);
  const total = 12 + (hash % 7);
  const mustDoRatio = input.targetScore >= 120 ? 0.58 : input.targetScore >= 100 ? 0.5 : 0.42;
  const dropRatio = input.targetScore >= 120 ? 0.12 : input.targetScore >= 100 ? 0.18 : 0.24;
  const mustDo = clamp(Math.round(total * mustDoRatio), 4, total - 2);
  const dropHard = clamp(Math.round(total * dropRatio), 1, total - mustDo - 1);
  const trashEasy = Math.max(0, total - mustDo - dropHard);
  const mustDoIndices = buildMustDoIndices(total, mustDo, hash);
  const mustDoLabels = mustDoIndices.split(', ').filter(Boolean);
  const mustDoLabelSet = new Set(mustDoLabels);
  const skipQuestions = Array.from({ length: total }, (_, index) => `Q${index + 1}`)
    .filter((label) => !mustDoLabelSet.has(label))
    .slice(-dropHard);
  const focusTopics = dedupe([
    ...(input.strategicContext?.activeRules ?? []),
    ...(input.strategicContext?.recentPainPoints ?? []),
    ...(input.strategicContext?.graphHotspots ?? []).map((item) => item.split(' 图谱热点 ')[0]!.trim()),
    ...(input.strategicContext?.graphNeighborSignals ?? []).map((item) => item.split(' 相邻于 ')[0]!.trim()),
    ...FALLBACK_FOCUS_TOPICS,
  ]).slice(0, 4);
  const weakTopicAlerts = dedupe([
    ...(input.strategicContext?.weakTopicAlerts ?? []),
    ...(input.strategicContext?.graphHotspots ?? []),
    ...(input.strategicContext?.graphNeighborSignals ?? []),
    ...(input.strategicContext?.recentPainPoints ?? []).map((item) => `${item} 最近反复出现，继续失分风险高。`),
  ]).slice(0, 4);
  const questionPlans = buildQuestionPlans(mustDoLabels, focusTopics, weakTopicAlerts);

  return {
    total,
    trashEasy,
    dropHard,
    mustDo,
    mustDoIndices,
    reasoning: `当前是 demo fallback：目标 ${input.targetScore} 分不需要全卷清空，只打高回报区，机械题和超纲题直接剥离。`,
    strategicPlan: {
      commanderBriefing: `Demo 战略官判定：这页作业只需要主攻 ${mustDo} 题，先拿确定性分数。`,
      immediateOrder: `先完成 ${mustDoLabels.slice(0, 3).join('、') || mustDoIndices}，其余题按 ROI 延后。`,
      focusKnowledgePoints: focusTopics.length ? focusTopics : FALLBACK_FOCUS_TOPICS.slice(0, 3),
      weakTopicAlerts,
      attackQuestions: mustDoLabels.slice(0, 3),
      reviewQuestions: mustDoLabels.slice(3, 5),
      skipQuestions,
      questionPlans,
    },
  };
};
