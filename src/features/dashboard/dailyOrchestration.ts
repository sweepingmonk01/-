// 首页 daily orchestration 模块。
// 把 App.tsx 内嵌的 subject 分类法、知识库、错题元信息推断与今日任务编排
// 提为独立模块，让 App.tsx 重新满足 Vite Fast Refresh 对 component-only export 的要求，
// 同时让首页核心编排可独立单测、独立替换。

export type SubjectKey = 'zh' | 'ma' | 'en';

export interface TaskCardData {
  id: string;
  subject: SubjectKey;
  title: string;
  detail: string;
  mins: number;
  xp: number;
  status: 'urgent' | 'todo' | 'done';
  action: 'upload' | 'error' | 'dehydrate' | 'map';
  focusSubject?: SubjectKey;
  focusNode?: string;
}

export interface TaskStatusRecord {
  completed: boolean;
  completedAt?: string;
}

export const SUBJECT_META: Record<SubjectKey, {
  name: string;
  short: string;
  color: string;
  light: string;
  icon: string;
  textbookLabel: string;
}> = {
  zh: { name: '丹青语文', short: '语文', color: 'var(--color-subj-zh)', light: 'rgba(255,93,115,0.12)', icon: '文', textbookLabel: '语文版图' },
  ma: { name: '极光数学', short: '数学', color: 'var(--color-subj-ma)', light: 'rgba(0,180,216,0.12)', icon: '数', textbookLabel: '数学版图' },
  en: { name: '阳光英语', short: '英语', color: 'var(--color-subj-en)', light: 'rgba(255,190,11,0.14)', icon: '英', textbookLabel: '英语版图' },
};

export const KNOWLEDGE_LIBRARY: Record<SubjectKey, string[]> = {
  zh: ['多音字辨析', '形近字辨别', '标点用法', '阅读主旨题', '作文三段式', '古诗默写'],
  ma: ['几何辅助线', '面积与面积单位', '单位换算', '周长公式', '乘法估算', '应用题审题'],
  en: ['There is/are', '情态动词 can', '天气句型', '名词复数变化', '位置词 upstairs', '完形逻辑词'],
};

export const inferSubjectFromText = (text: string): SubjectKey => {
  const content = text.toLowerCase();
  if (/英语|english|weather|season|there is|there are|can't|upstairs|spring|winter|library/.test(content)) {
    return 'en';
  }
  if (/数学|面积|周长|几何|中点|辅助线|平方|方程|dm|cm|m²|应用题/.test(content)) {
    return 'ma';
  }
  return 'zh';
};

export const inferKnowledgeNode = (text: string, subject: SubjectKey): string => {
  const normalized = text.toLowerCase();
  const pool = KNOWLEDGE_LIBRARY[subject];
  const directMatch = pool.find((item) => normalized.includes(item.toLowerCase()));
  if (directMatch) return directMatch;

  if (subject === 'ma' && /中点|辅助线|平行四边形/.test(text)) return '几何辅助线';
  if (subject === 'ma' && /面积|平方|单位换算/.test(text)) return '面积与面积单位';
  if (subject === 'en' && /there is|there are/.test(normalized)) return 'There is/are';
  if (subject === 'en' && /can|can't/.test(normalized)) return '情态动词 can';
  if (subject === 'zh' && /多音字/.test(text)) return '多音字辨析';
  if (subject === 'zh' && /标点/.test(text)) return '标点用法';

  return pool[0];
};

export const getErrorMeta = (errorItem: any) => {
  const rawText = `${errorItem?.painPoint || ''} ${errorItem?.rule || ''} ${errorItem?.questionText || ''}`;
  const subject = inferSubjectFromText(rawText);
  return {
    subject,
    node: inferKnowledgeNode(rawText, subject),
  };
};

export interface TodayPlanInput {
  targetScore: number;
  topError?: any;
  topSignal: string;
  preferredFocus: { subject: SubjectKey; node: string };
  taskStatus: Record<string, TaskStatusRecord>;
  errorListLength: number;
  timeSaved: number;
  lastOutcome?: 'success' | 'failure';
}

// 纯函数，无副作用，便于独立单测和未来替换为基于 effectScore 反向回归的策略。
export const buildTodayPlan = (input: TodayPlanInput): TaskCardData[] => {
  const { targetScore, topError, topSignal, preferredFocus, taskStatus, errorListLength, timeSaved, lastOutcome } = input;
  const plan: TaskCardData[] = [];
  const expectedMinutes = Math.max(15, Math.ceil((targetScore - 85) * 1.5));
  const shouldProtect = lastOutcome === 'failure';

  if (topError || topSignal || preferredFocus.node) {
    const subject = topError ? getErrorMeta(topError).subject : preferredFocus.subject;
    const node = topError ? getErrorMeta(topError).node : preferredFocus.node;
    const focusLabel = node || topSignal || '当前主线';
    plan.push({
      id: 'error-revive',
      subject,
      title: shouldProtect ? `保护性重构：${focusLabel}` : `优先修复：${focusLabel}`,
      detail: shouldProtect
        ? `最近一次裁决还没命中规则，先围绕“${topSignal || '当前高频错点'}”收窄提示。`
        : `先把“${topSignal || '高频错点'}”修掉，立刻减少重复失分。`,
      mins: shouldProtect ? 10 : 8,
      xp: shouldProtect ? 20 : 18,
      status: taskStatus['error-revive']?.completed ? 'done' : 'urgent',
      action: topError ? 'error' : 'map',
      focusSubject: subject,
      focusNode: node || undefined,
    });
  } else {
    plan.push({
      id: 'upload-question',
      subject: 'ma',
      title: '上传 1 道真实不会题',
      detail: '把今天最卡的一题交给列子御风拆解，拿到一句话法则。',
      mins: 6,
      xp: 12,
      status: taskStatus['upload-question']?.completed ? 'done' : 'todo',
      action: 'upload',
    });
  }

  plan.push({
    id: 'knowledge-map',
    subject: preferredFocus.subject,
    title: shouldProtect ? '巡视保护性节点' : '巡视知识地图',
    detail: preferredFocus.node
      ? `直接聚焦 ${SUBJECT_META[preferredFocus.subject].short} 的“${preferredFocus.node}”，别再平均用力。`
      : '只看正在失血的节点，决定今晚优先打哪一块。',
    mins: 4,
    xp: 8,
    status: taskStatus['knowledge-map']?.completed ? 'done' : errorListLength > 2 ? 'urgent' : 'todo',
    action: 'map',
    focusSubject: preferredFocus.subject,
    focusNode: preferredFocus.node || undefined,
  });

  plan.push({
    id: 'dehydrate-homework',
    subject: 'en',
    title: '整页作业脱水',
    detail: `以 ${targetScore} 分目标重排作业优先级，回收低效题海时间。`,
    mins: 5,
    xp: 16,
    status: taskStatus['dehydrate-homework']?.completed || timeSaved > 0 ? 'done' : 'todo',
    action: 'dehydrate',
  });

  if (expectedMinutes > 26) {
    plan.push({
      id: 'stability-round',
      subject: preferredFocus.subject,
      title: shouldProtect ? '补 1 轮规则复位' : '补 1 轮短时巩固',
      detail: shouldProtect
        ? '先把最近失手的规则重新走顺，再进入额外扩张。'
        : '目标分拉得更高，今晚需要一轮额外的保分复现。',
      mins: 6,
      xp: 10,
      status: taskStatus['stability-round']?.completed ? 'done' : 'todo',
      action: 'error',
      focusSubject: preferredFocus.subject,
      focusNode: preferredFocus.node || undefined,
    });
  }

  return plan;
};

export const sortTodayPlan = (plan: TaskCardData[]): TaskCardData[] => {
  const priority = { urgent: 0, todo: 1, done: 2 } as const;
  return [...plan].sort((left, right) => {
    if (priority[left.status] !== priority[right.status]) {
      return priority[left.status] - priority[right.status];
    }
    if (left.id === 'error-revive') return -1;
    if (right.id === 'error-revive') return 1;
    return 0;
  });
};

// 简易组合：把 build + sort 合成单步调用，用于 useDailyOrchestration hook 与测试。
export const buildSortedTodayPlan = (input: TodayPlanInput): TaskCardData[] => (
  sortTodayPlan(buildTodayPlan(input))
);
