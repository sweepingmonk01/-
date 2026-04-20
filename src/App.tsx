import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactPlayer from 'react-player';
import { 
  Sword, Map as MapIcon, ShieldAlert, Zap, Clock, 
  Check, ChevronRight, Play, BookOpen, Star, 
  BrainCircuit, RefreshCw, Trophy, Beaker,
  Target, Cpu, Sliders, Lock, Flame, Camera, UploadCloud, Orbit, AlertTriangle, Volume2, VolumeX
} from 'lucide-react';
import { auth, loginWithGoogle, logoutUser, syncUserProfile, getUserProfile, saveErrorRecord, getActiveErrors, resolveError, updateCognitiveState } from './lib/firebase';
import {
  analyzeQuestionImage,
  createMobiusSession,
  dehydrateHomework as dehydrateHomeworkViaApi,
  generateCloneQuestion as generateCloneQuestionViaApi,
  generateTheaterScript as generateTheaterScriptViaApi,
  getMobiusStudentStateSummary,
  refreshMobiusMediaJob,
  resolveMobiusContent,
  resolveMobiusInteraction,
} from './lib/mobius';
import { onAuthStateChanged } from 'firebase/auth';

import Dashboard from './components/Dashboard';

type ScreenState = 'welcome' | 'profile-setup' | 'diagnostic-loading' | 'target-setter' | 'dashboard' | 'subject-map' | 'error-book' | 'overview' | 'combat' | 'combat-feedback' | 'report' | 'dehydrator' | 'theater';

type AIQuestionData = import('./lib/mobius').AIQuestionData;
type DehydrateResult = import('./lib/mobius').DehydrateResult;
type TheaterScript = import('./lib/mobius').TheaterScript;
type KnowledgeActionType = import('./lib/mobius').KnowledgeActionType;
type InteractionConfidence = import('./lib/mobius').InteractionConfidence;
type MobiusStudentStateSummaryResponse = import('./lib/mobius').MobiusStudentStateSummaryResponse;

const SELECT_ACTION_OPTIONS = [
  { id: 'rule-first', label: '先触发规则动作', result: 'aligned' as const },
  { id: 'partial-rule', label: '想到一点规则，但步骤不稳', result: 'partial' as const },
  { id: 'guess-first', label: '先猜答案再补理由', result: 'guess' as const },
];

const SEQUENCE_ACTION_STEPS = ['识别关键条件', '触发核心规则', '确认最终答案'];
const DRAW_ACTION_CHECKPOINTS = ['锁定关键点', '连接正确路径', '复核动作结果'];

interface TheaterMeta {
  source: 'mobius' | 'gemini';
  provider?: string;
  videoStatus?: 'queued' | 'processing' | 'ready' | 'failed';
  videoUrl?: string;
  activeVideoUrl?: string;
  mediaJobId?: string;
  providerJobId?: string;
  errorMessage?: string;
  coachMessage?: string;
  nextActions?: string[];
  resolutionTitle?: string;
  branchOutcome?: 'success' | 'failure';
  contentKnowledgePointTitle?: string;
  contentKnowledgePointGrade?: string;
  contentEvidence?: string[];
  relatedQuestionSummary?: string[];
  diagnosedMistakeLabels?: string[];
  knowledgeActionLabel?: string;
  knowledgeActionType?: import('./lib/mobius').KnowledgeActionType;
  knowledgeActionId?: string;
  adjudicationRationale?: string[];
}

type SubjectKey = 'zh' | 'ma' | 'en';
type ErrorFilter = 'all' | SubjectKey;

interface TaskCardData {
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

interface KnowledgeNode {
  name: string;
  state: 'mastered' | 'learning' | 'locked';
  progress: number;
}

interface TaskStatusRecord {
  completed: boolean;
  completedAt?: string;
}

interface KnowledgeProgressState {
  zh: { textbook: string; nodes: { name: string; progress: number }[] };
  ma: { textbook: string; nodes: { name: string; progress: number }[] };
  en: { textbook: string; nodes: { name: string; progress: number }[] };
}

const SUBJECT_META: Record<SubjectKey, { name: string; short: string; color: string; light: string; icon: string; textbookLabel: string; }> = {
  zh: { name: '丹青语文', short: '语文', color: 'var(--color-subj-zh)', light: 'rgba(255,93,115,0.12)', icon: '文', textbookLabel: '语文版图' },
  ma: { name: '极光数学', short: '数学', color: 'var(--color-subj-ma)', light: 'rgba(0,180,216,0.12)', icon: '数', textbookLabel: '数学版图' },
  en: { name: '阳光英语', short: '英语', color: 'var(--color-subj-en)', light: 'rgba(255,190,11,0.14)', icon: '英', textbookLabel: '英语版图' },
};

const KNOWLEDGE_LIBRARY: Record<SubjectKey, string[]> = {
  zh: ['多音字辨析', '形近字辨别', '标点用法', '阅读主旨题', '作文三段式', '古诗默写'],
  ma: ['几何辅助线', '面积与面积单位', '单位换算', '周长公式', '乘法估算', '应用题审题'],
  en: ['There is/are', '情态动词 can', '天气句型', '名词复数变化', '位置词 upstairs', '完形逻辑词'],
};

const DEMO_ERRORS = [
  {
    id: 'demo-ma-1',
    painPoint: '几何中点辅助线选择失误',
    rule: '遇中点，先想倍长中线；造全等比硬算更稳。',
    questionText: '在 △ABC 中，D 为 AB 中点，要求 CD 的范围时，第一步最稳妥的辅助线是什么？',
    options: ['过 D 作 DE // BC', '延长 CD 至 E，使 DE = CD，连接 AE, BE', '过 C 作 CF ⊥ AB', '作 BC 的垂直平分线'],
    status: 'active',
  },
  {
    id: 'demo-en-1',
    painPoint: 'There is/are 结构混淆',
    rule: 'there be 看最近主语，单数 is，复数 are。',
    questionText: 'There ___ a sofa and two chairs in the living room.',
    options: ['is', 'are', 'am', 'be'],
    status: 'active',
  },
  {
    id: 'demo-zh-1',
    painPoint: '多音字辨析不稳定',
    rule: '银行读 hang，成长读 zhang；先看词义再读音。',
    questionText: '“行”在“银行”中读什么？',
    options: ['xing', 'hang', 'heng', 'hang4'],
    status: 'active',
  },
];

const inferSubjectFromText = (text: string): SubjectKey => {
  const content = text.toLowerCase();
  if (/英语|english|weather|season|there is|there are|can't|upstairs|spring|winter|library/.test(content)) {
    return 'en';
  }
  if (/数学|面积|周长|几何|中点|辅助线|平方|方程|dm|cm|m²|应用题/.test(content)) {
    return 'ma';
  }
  return 'zh';
};

const inferKnowledgeNode = (text: string, subject: SubjectKey): string => {
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

const getErrorMeta = (errorItem: any) => {
  const rawText = `${errorItem?.painPoint || ''} ${errorItem?.rule || ''} ${errorItem?.questionText || ''}`;
  const subject = inferSubjectFromText(rawText);
  return {
    subject,
    node: inferKnowledgeNode(rawText, subject),
  };
};

const getErrorRecencyLabel = (index: number) => {
  if (index === 0) return '刚刚录入';
  if (index < 3) return '24h 内高危';
  if (index < 6) return '72h 巩固';
  return '待回访';
};

const getTodayKey = () => new Date().toISOString().slice(0, 10);

export default function App() {
  const todayKey = getTodayKey();
  const [currentScreen, setCurrentScreen] = useState<ScreenState>('welcome');
  const [timeSaved, setTimeSaved] = useState(0);
  const [targetScore, setTargetScore] = useState(115);
  
  // Auth state
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Profile settings state
  const [grade, setGrade] = useState('');
  const [textbooks, setTextbooks] = useState({ zh: '部编版(人教)', ma: '人教版', en: '人教PEP' });
  const [theaterCueEnabled, setTheaterCueEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem('liezi-theater-cue-enabled') !== 'false';
  });

  // Monitor auth state and load profile
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const profile = await getUserProfile(u.uid);
        if (profile) {
          if (profile.grade) setGrade(profile.grade);
          if (profile.textbooks) setTextbooks(profile.textbooks);
          if (profile.targetScore) setTargetScore(profile.targetScore);
          if (profile.timeSaved !== undefined) setTimeSaved(profile.timeSaved);
          if (profile.cognitiveState) setCogState(profile.cognitiveState);
          if (profile.theaterCueEnabled !== undefined) setTheaterCueEnabled(Boolean(profile.theaterCueEnabled));
          if (profile.taskStatusDate === todayKey) {
            setTaskStatus(profile.todayTaskStatus || {});
            setTaskStatusDate(profile.taskStatusDate || todayKey);
          } else {
            setTaskStatus({});
            setTaskStatusDate(todayKey);
          }
          if (profile.knowledgeProgress) {
            setKnowledgeProgressState(profile.knowledgeProgress);
          }
        }
        try {
          const errs = await getActiveErrors(u.uid);
          setErrorList(errs);
        } catch (error) {
          console.error(error);
        }
        await refreshStudentStateSummary(u.uid);
      } else {
        setTaskStatus({});
        setTaskStatusDate('');
        setKnowledgeProgressState(null);
        setPracticeQueue([]);
        setPracticeIndex(0);
        setStudentStateSummary(null);
      }
      setAuthChecking(false);
    });
    return () => unsub();
  }, []);

  const saveProfileData = async (data: any) => {
    if (user) {
      await syncUserProfile(user.uid, data);
    }
  };

  const handleTimeSavedUpdate = async (additionalTime: number) => {
    const newTime = timeSaved + additionalTime;
    setTimeSaved(newTime);
    if (user) {
      await syncUserProfile(user.uid, { timeSaved: newTime });
    }
  };

  // AI Combat State
  const [aiMode, setAiMode] = useState<'idle' | 'analyzing' | 'ready'>('idle');
  const [dehydrateMode, setDehydrateMode] = useState<'idle' | 'analyzing' | 'ready'>('idle');
  const [theaterMode, setTheaterMode] = useState<'idle' | 'generating' | 'playing' | 'interaction' | 'resolution'>('idle');
  const [aiData, setAiData] = useState<AIQuestionData | null>(null);
  const [dehydrateData, setDehydrateData] = useState<DehydrateResult | null>(null);
  const [theaterScript, setTheaterScript] = useState<TheaterScript | null>(null);
  const [theaterResolution, setTheaterResolution] = useState<'success' | 'failure' | null>(null);
  const [theaterMeta, setTheaterMeta] = useState<TheaterMeta | null>(null);
  const [theaterDecisionPending, setTheaterDecisionPending] = useState(false);
  const [theaterActionCompleted, setTheaterActionCompleted] = useState(true);
  const [theaterSelfCheck, setTheaterSelfCheck] = useState<'aligned' | 'partial' | 'guess'>('aligned');
  const [theaterConfidence, setTheaterConfidence] = useState<InteractionConfidence>('medium');
  const [theaterSelectedOption, setTheaterSelectedOption] = useState<string>('rule-first');
  const [theaterSequence, setTheaterSequence] = useState<string[]>(SEQUENCE_ACTION_STEPS);
  const [theaterDrawCheckpoints, setTheaterDrawCheckpoints] = useState<string[]>([]);
  const [theaterCutFxActive, setTheaterCutFxActive] = useState(false);
  const [theaterReadyCueActive, setTheaterReadyCueActive] = useState(false);
  
  // Cognitive Engine State
  const [cogState, setCogState] = useState({ focus: 50, frustration: 0, joy: 50 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dehydrateInputRef = useRef<HTMLInputElement>(null);
  const previousActiveVideoUrlRef = useRef<string | undefined>(undefined);
  const theaterAudioContextRef = useRef<AudioContext | null>(null);

  // Error Book State
  const [errorList, setErrorList] = useState<any[]>([]);
  const [errorFilter, setErrorFilter] = useState<ErrorFilter>('all');
  const [mapSubject, setMapSubject] = useState<SubjectKey>('ma');
  const [taskStatus, setTaskStatus] = useState<Record<string, TaskStatusRecord>>({});
  const [taskStatusDate, setTaskStatusDate] = useState('');
  const [knowledgeProgressState, setKnowledgeProgressState] = useState<KnowledgeProgressState | null>(null);
  const [practiceQueue, setPracticeQueue] = useState<any[]>([]);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [demoMode, setDemoMode] = useState(false);
  const [studentStateSummary, setStudentStateSummary] = useState<MobiusStudentStateSummaryResponse | null>(null);

  const refreshStudentStateSummary = async (studentId: string) => {
    try {
      const summary = await getMobiusStudentStateSummary(studentId);
      setStudentStateSummary(summary);
    } catch (error) {
      setStudentStateSummary(null);
      if ((error as Error).message.includes('404')) return;
      console.warn('Mobius state summary refresh failed.', error);
    }
  };

  useEffect(() => {
    if (!user && demoMode) {
      void refreshStudentStateSummary('demo-student');
    }
  }, [user, demoMode]);

  useEffect(() => {
    if (
      currentScreen !== 'theater' ||
      theaterMeta?.source !== 'mobius' ||
      !theaterMeta.mediaJobId ||
      !theaterMeta.videoStatus ||
      !['queued', 'processing'].includes(theaterMeta.videoStatus)
    ) {
      return;
    }

    let cancelled = false;
    const intervalId = window.setInterval(async () => {
      try {
        const job = await refreshMobiusMediaJob(theaterMeta.mediaJobId!);
        if (cancelled) return;

        setTheaterMeta((current) => {
          if (!current || current.mediaJobId !== job.id) return current;
          return {
            ...current,
            provider: job.provider,
            providerJobId: job.providerJobId,
            videoStatus: job.status,
            videoUrl: job.playbackUrl,
            activeVideoUrl: job.status === 'ready' && job.playbackUrl ? job.playbackUrl : current.activeVideoUrl,
            errorMessage: job.errorMessage,
          };
        });
      } catch (error) {
        if (!cancelled) {
          console.warn('Mobius media job refresh failed.', error);
        }
      }
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [currentScreen, theaterMeta]);

  useEffect(() => {
    if (currentScreen === 'error-book' && user) {
      loadErrors();
    }
  }, [currentScreen, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('liezi-theater-cue-enabled', String(theaterCueEnabled));
  }, [theaterCueEnabled]);

  const toggleTheaterCueEnabled = async () => {
    const nextValue = !theaterCueEnabled;
    setTheaterCueEnabled(nextValue);
    if (user) {
      await syncUserProfile(user.uid, { theaterCueEnabled: nextValue });
    }
  };

  useEffect(() => {
    const activeVideoUrl = theaterMeta?.activeVideoUrl;
    const previousVideoUrl = previousActiveVideoUrlRef.current;

    if (!activeVideoUrl) {
      previousActiveVideoUrlRef.current = undefined;
      return;
    }

    if (previousVideoUrl && previousVideoUrl !== activeVideoUrl) {
      setTheaterCutFxActive(true);
      if (theaterCueEnabled) {
        setTheaterReadyCueActive(true);
        playTheaterReadyCue();
      }
      const timeoutId = window.setTimeout(() => {
        setTheaterCutFxActive(false);
      }, 280);
      const cueTimeoutId = window.setTimeout(() => {
        setTheaterReadyCueActive(false);
      }, 720);
      previousActiveVideoUrlRef.current = activeVideoUrl;
      return () => {
        window.clearTimeout(timeoutId);
        window.clearTimeout(cueTimeoutId);
      };
    }

    previousActiveVideoUrlRef.current = activeVideoUrl;
    return;
  }, [theaterCueEnabled, theaterMeta?.activeVideoUrl]);

  const playTheaterReadyCue = () => {
    if (typeof window === 'undefined') return;

    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    try {
      const context = theaterAudioContextRef.current ?? new AudioContextCtor();
      theaterAudioContextRef.current = context;

      if (context.state === 'suspended') {
        void context.resume();
      }

      const startAt = context.currentTime + 0.01;
      const masterGain = context.createGain();
      masterGain.gain.setValueAtTime(0.0001, startAt);
      masterGain.gain.exponentialRampToValueAtTime(0.06, startAt + 0.02);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.22);
      masterGain.connect(context.destination);

      const toneA = context.createOscillator();
      toneA.type = 'triangle';
      toneA.frequency.setValueAtTime(880, startAt);
      toneA.frequency.exponentialRampToValueAtTime(1320, startAt + 0.12);
      toneA.connect(masterGain);
      toneA.start(startAt);
      toneA.stop(startAt + 0.14);

      const toneB = context.createOscillator();
      toneB.type = 'sine';
      toneB.frequency.setValueAtTime(1760, startAt + 0.06);
      toneB.frequency.exponentialRampToValueAtTime(1480, startAt + 0.2);
      toneB.connect(masterGain);
      toneB.start(startAt + 0.06);
      toneB.stop(startAt + 0.22);
    } catch (error) {
      console.warn('Theater ready cue playback failed.', error);
    }
  };

  const loadErrors = async () => {
    if (demoMode) {
      setErrorList(DEMO_ERRORS);
      return;
    }
    if (!user) return;
    try {
      const errs = await getActiveErrors(user.uid);
      setErrorList(errs);
    } catch (e) {
      console.error(e);
    }
  };

  const enterDemoMode = () => {
    setDemoMode(true);
    setGrade((prev) => prev || '四年级');
    setTargetScore(115);
    setTimeSaved(26);
    setTextbooks({ zh: '部编版(人教)', ma: '人教版', en: '人教PEP' });
    setErrorList(DEMO_ERRORS);
    setTaskStatus({});
    setTaskStatusDate(todayKey);
    setCurrentScreen('dashboard');
  };

  const persistTaskStatus = async (nextStatus: Record<string, TaskStatusRecord>) => {
    setTaskStatus(nextStatus);
    setTaskStatusDate(todayKey);
    if (user) {
      await syncUserProfile(user.uid, {
        todayTaskStatus: nextStatus,
        taskStatusDate: todayKey,
      });
    }
  };

  const markTaskComplete = async (taskId: string) => {
    const nextStatus = {
      ...taskStatus,
      [taskId]: {
        completed: true,
        completedAt: new Date().toISOString(),
      },
    };
    await persistTaskStatus(nextStatus);
  };

  const startContinuousPractice = async (errors: any[], startIndex: number) => {
    const queue = errors.slice(startIndex, startIndex + 5);
    if (!queue.length) return;
    setPracticeQueue(queue);
    setPracticeIndex(0);
    await generateCloneQuestion(queue[0]);
  };

  useEffect(() => {
    if (taskStatusDate && taskStatusDate !== todayKey) {
      persistTaskStatus({});
    }
  }, [taskStatusDate, todayKey]);

  useEffect(() => {
    const nextKnowledgeProgress: KnowledgeProgressState = {
      zh: {
        textbook: textbooks.zh,
        nodes: KNOWLEDGE_LIBRARY.zh.map((name, index) => {
          const hitCount = errorList.filter((item) => {
            const meta = getErrorMeta(item);
            return meta.subject === 'zh' && meta.node === name;
          }).length;
          const progress = Math.max(24, Math.min(96, (index < 2 ? 86 : 62) - hitCount * 18));
          return { name, progress };
        }),
      },
      ma: {
        textbook: textbooks.ma,
        nodes: KNOWLEDGE_LIBRARY.ma.map((name, index) => {
          const hitCount = errorList.filter((item) => {
            const meta = getErrorMeta(item);
            return meta.subject === 'ma' && meta.node === name;
          }).length;
          const progress = Math.max(24, Math.min(96, (index < 2 ? 84 : 60) - hitCount * 18));
          return { name, progress };
        }),
      },
      en: {
        textbook: textbooks.en,
        nodes: KNOWLEDGE_LIBRARY.en.map((name, index) => {
          const hitCount = errorList.filter((item) => {
            const meta = getErrorMeta(item);
            return meta.subject === 'en' && meta.node === name;
          }).length;
          const progress = Math.max(24, Math.min(96, (index < 2 ? 88 : 64) - hitCount * 18));
          return { name, progress };
        }),
      },
    };

    const currentSerialized = JSON.stringify(knowledgeProgressState);
    const nextSerialized = JSON.stringify(nextKnowledgeProgress);
    if (currentSerialized !== nextSerialized) {
      setKnowledgeProgressState(nextKnowledgeProgress);
      if (user) {
        syncUserProfile(user.uid, { knowledgeProgress: nextKnowledgeProgress }).catch((error) => {
          console.error(error);
        });
      }
    }
  }, [errorList, textbooks, user, knowledgeProgressState]);

  const filteredErrors = errorFilter === 'all'
    ? errorList
    : errorList.filter((errorItem) => getErrorMeta(errorItem).subject === errorFilter);

  const topMistakeCategory = (() => {
    const entries = Object.entries(studentStateSummary?.mistakeCategoryCounts ?? {});
    if (!entries.length) return null;
    const [category, count] = entries.sort((left, right) => Number(right[1] ?? 0) - Number(left[1] ?? 0))[0];
    const labels: Record<string, string> = {
      'concept-confusion': '概念混淆',
      'rule-recall': '规则提取',
      'strategy-selection': '策略选择',
      'careless-execution': '执行粗心',
      'language-mapping': '语言映射',
    };
    return {
      label: labels[category] ?? category,
      count: count ?? 0,
    };
  })();

  const studentModelCards = [
    {
      label: '累计快照',
      value: String(studentStateSummary?.totalSnapshots ?? 0),
      tone: 'text-[var(--color-primary)]',
    },
    {
      label: '最近裁决',
      value:
        studentStateSummary?.interactionStats.lastOutcome === 'success'
          ? '命中规则'
          : studentStateSummary?.interactionStats.lastOutcome === 'failure'
            ? '需要保护'
            : '暂无',
      tone:
        studentStateSummary?.interactionStats.lastOutcome === 'success'
          ? 'text-[var(--color-accent-green)]'
          : 'text-[var(--color-accent-pink)]',
    },
    {
      label: '主风险型',
      value: topMistakeCategory?.label ?? '待积累',
      tone: 'text-[var(--color-secondary)]',
    },
  ];

  const errorStats = errorList.reduce(
    (acc, errorItem) => {
      const { subject } = getErrorMeta(errorItem);
      acc.total += 1;
      acc[subject] += 1;
      return acc;
    },
    { total: 0, zh: 0, ma: 0, en: 0 }
  );

  const stateDrivenError = (() => {
    const recentPainPoints = studentStateSummary?.recentPainPoints ?? [];
    for (const painPoint of recentPainPoints) {
      const matched = errorList.find((errorItem) => {
        const candidates = [errorItem.painPoint, errorItem.rule, errorItem.questionText]
          .filter(Boolean)
          .map((item: string) => item.toLowerCase());
        const normalizedPainPoint = painPoint.toLowerCase();
        return candidates.some((item) => item.includes(normalizedPainPoint) || normalizedPainPoint.includes(item));
      });
      if (matched) return matched;
    }
    return errorList[0];
  })();

  const preferredFocus = stateDrivenError
    ? getErrorMeta(stateDrivenError)
    : {
        subject: (studentStateSummary?.recommendedSessionDefaults?.knowledgeActionType === 'sequence' ? 'en' : 'ma') as SubjectKey,
        node: '',
      };
  const recommendedErrorId = stateDrivenError?.id;

  const todayPlan: TaskCardData[] = (() => {
    const plan: TaskCardData[] = [];
    const expectedMinutes = Math.max(15, Math.ceil((targetScore - 85) * 1.5));
    const topError = stateDrivenError;
    const lastOutcome = studentStateSummary?.interactionStats.lastOutcome;
    const shouldProtect = lastOutcome === 'failure';

    if (topError) {
      const { subject, node } = getErrorMeta(topError);
      plan.push({
        id: 'error-revive',
        subject,
        title: shouldProtect ? `保护性重构：${node}` : `优先修复：${node}`,
        detail: shouldProtect
          ? `最近一次裁决还没命中规则，先围绕“${topError.rule || topError.painPoint || '当前高频错点'}”收窄提示。`
          : `先把“${topError.rule || topError.painPoint || '高频错点'}”修掉，立刻减少重复失分。`,
        mins: shouldProtect ? 10 : 8,
        xp: shouldProtect ? 20 : 18,
        status: taskStatus['error-revive']?.completed ? 'done' : 'urgent',
        action: 'error',
        focusSubject: subject,
        focusNode: node,
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
      status: taskStatus['knowledge-map']?.completed ? 'done' : errorList.length > 2 ? 'urgent' : 'todo',
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
  })().sort((left, right) => {
    const priority = { urgent: 0, todo: 1, done: 2 };
    if (priority[left.status] !== priority[right.status]) {
      return priority[left.status] - priority[right.status];
    }
    if (left.id === 'error-revive') return -1;
    if (right.id === 'error-revive') return 1;
    return 0;
  });

  const planTotals = todayPlan.reduce(
    (acc, item) => {
      acc.minutes += item.mins;
      acc.xp += item.xp;
      if (item.status === 'done') acc.done += 1;
      return acc;
    },
    { minutes: 0, xp: 0, done: 0 }
  );

  const knowledgeMap: Record<SubjectKey, KnowledgeNode[]> = (() => {
    const fallback = knowledgeProgressState || {
      zh: { textbook: textbooks.zh, nodes: KNOWLEDGE_LIBRARY.zh.map((name, index) => ({ name, progress: index < 2 ? 86 : 60 })) },
      ma: { textbook: textbooks.ma, nodes: KNOWLEDGE_LIBRARY.ma.map((name, index) => ({ name, progress: index < 2 ? 84 : 58 })) },
      en: { textbook: textbooks.en, nodes: KNOWLEDGE_LIBRARY.en.map((name, index) => ({ name, progress: index < 2 ? 88 : 64 })) },
    };

    return {
      zh: fallback.zh.nodes.map((node) => ({
        name: node.name,
        progress: node.progress,
        state: node.progress >= 80 ? 'mastered' : node.progress >= 45 ? 'learning' : 'locked',
      })),
      ma: fallback.ma.nodes.map((node) => ({
        name: node.name,
        progress: node.progress,
        state: node.progress >= 80 ? 'mastered' : node.progress >= 45 ? 'learning' : 'locked',
      })),
      en: fallback.en.nodes.map((node) => ({
        name: node.name,
        progress: node.progress,
        state: node.progress >= 80 ? 'mastered' : node.progress >= 45 ? 'learning' : 'locked',
      })),
    };
  })();

  const handleTaskAction = (task: TaskCardData) => {
    if (task.action === 'upload') {
      fileInputRef.current?.click();
      return;
    }
    if (task.action === 'dehydrate') {
      dehydrateInputRef.current?.click();
      return;
    }
    if (task.action === 'map') {
      if (task.focusSubject) {
        setMapSubject(task.focusSubject);
      }
      markTaskComplete('knowledge-map').catch((error) => console.error(error));
      setCurrentScreen('subject-map');
      return;
    }
    setErrorFilter(task.focusSubject ?? 'all');
    if (task.focusSubject) {
      setMapSubject(task.focusSubject);
    }
    setCurrentScreen('error-book');
  };

  const handleMapNodePress = (subject: SubjectKey, nodeName: string) => {
    const matchedError = errorList.find((errorItem) => {
      const meta = getErrorMeta(errorItem);
      return meta.subject === subject && meta.node === nodeName;
    });

    setMapSubject(subject);
    setErrorFilter(subject);

    if (matchedError) {
      setPracticeQueue([]);
      setPracticeIndex(0);
      generateCloneQuestion(matchedError);
      return;
    }

    setCurrentScreen('error-book');
  };

  useEffect(() => {
    if (!preferredFocus.subject) return;
    setMapSubject((current) => (current === preferredFocus.subject ? current : preferredFocus.subject));
  }, [preferredFocus.subject]);

  const handleUploadQuestion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAiMode('analyzing');
    setCurrentScreen('combat');

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(',')[1];
      const mimeType = file.type;
      
      try {
        const data = await analyzeQuestionImage({
          imageBase64: base64String,
          mimeType,
        });
        setAiData(data);
        setAiMode('ready');
        markTaskComplete('upload-question').catch((error) => console.error(error));
      } catch (err) {
        console.error("AI Analysis failed:", err);
        setAiMode('idle');
        setCurrentScreen('dashboard');
      }
    };
    reader.readAsDataURL(file);
  };

  const generateCloneQuestion = async (errorItem: any) => {
    setAiMode('analyzing');
    setCurrentScreen('combat');
    setCombatAnswer('');

    try {
      const data = await generateCloneQuestionViaApi({
        painPoint: errorItem.painPoint,
        rule: errorItem.rule,
        questionText: errorItem.questionText,
      });
      setAiData({ ...data, _errorId: errorItem.id } as any);
      setAiMode('ready');
    } catch (err) {
      console.error("AI Analysis failed:", err);
      setAiMode('idle');
      setCurrentScreen('error-book');
    }
  };

  const scheduleTheaterInteraction = () => {
    window.setTimeout(() => {
      setTheaterMode('interaction');
    }, 4000);
  };

  const generateFallbackTheaterScript = async (errorItem: any) => {
    return generateTheaterScriptViaApi({
      painPoint: errorItem.painPoint,
      rule: errorItem.rule,
    });
  };

  const generateTheaterScript = async (errorItem: any) => {
    setTheaterMode('generating');
    setCurrentScreen('theater');
    setTheaterResolution(null);
    setTheaterMeta(null);
    setTheaterDecisionPending(false);
    setTheaterActionCompleted(true);
    setTheaterSelfCheck('aligned');
    setTheaterConfidence('medium');
    setTheaterSelectedOption('rule-first');
    setTheaterSequence(SEQUENCE_ACTION_STEPS);
    setTheaterDrawCheckpoints([]);

    try {
      const errorMeta = getErrorMeta(errorItem);
      let contentResolution: Awaited<ReturnType<typeof resolveMobiusContent>> | null = null;

      try {
        contentResolution = await resolveMobiusContent({
          studentId: user?.uid || 'demo-student',
          subject: errorMeta.subject,
          grade: grade || undefined,
          painPoint: errorItem.painPoint,
          rule: errorItem.rule,
          questionText: errorItem.questionText,
        });
      } catch (contentError) {
        console.warn('Mobius content resolve failed, continuing with raw error item.', contentError);
      }

      const storySeed = contentResolution?.recommendedStorySeed;
      const primaryKnowledgePoint = contentResolution?.matchedKnowledgePoints[0]?.knowledgePoint;
      const relatedQuestionSummary = contentResolution?.relatedQuestions.slice(0, 2).map(({ question }) =>
        `${question.year} ${question.region} ${question.questionType}`,
      );
      const studentId = user?.uid || 'demo-student';
      let stateSummary: Awaited<ReturnType<typeof getMobiusStudentStateSummary>> | null = null;

      try {
        stateSummary = await getMobiusStudentStateSummary(studentId);
        setStudentStateSummary(stateSummary);
      } catch (stateSummaryError) {
        console.warn('Mobius state summary unavailable, falling back to local defaults.', stateSummaryError);
      }

      const sessionDefaults = stateSummary?.recommendedSessionDefaults;

      const mobiusSession = await createMobiusSession({
        studentId,
        targetScore: sessionDefaults?.targetScore ?? targetScore,
        grade: sessionDefaults?.grade ?? grade,
        painPoint: storySeed?.painPoint ?? errorItem.painPoint ?? sessionDefaults?.painPoint,
        rule: storySeed?.rule ?? errorItem.rule ?? sessionDefaults?.rule,
        questionText: storySeed?.questionText ?? errorItem.questionText,
        diagnosedMistakes: storySeed?.diagnosedMistakes ?? contentResolution?.errorRecord.diagnosedMistakes,
        knowledgeAction:
          storySeed?.knowledgeAction ??
          contentResolution?.errorRecord.knowledgeAction,
        timeSavedMinutes: timeSaved,
        previousState: {
          focus: stateSummary?.currentCognitiveState?.focus ?? sessionDefaults?.previousState.focus ?? cogState.focus,
          frustration:
            stateSummary?.currentCognitiveState?.frustration ??
            sessionDefaults?.previousState.frustration ??
            cogState.frustration,
          joy: stateSummary?.currentCognitiveState?.joy ?? sessionDefaults?.previousState.joy ?? cogState.joy,
        },
        learningSignals: {
          attempts: 1,
          correctStreak: 0,
          wrongStreak: stateSummary?.interactionStats.lastOutcome === 'failure' ? 2 : 1,
          timeSavedMinutes: timeSaved,
        },
      });

      setCogState({
        focus: mobiusSession.cognitiveState.focus,
        frustration: mobiusSession.cognitiveState.frustration,
        joy: mobiusSession.cognitiveState.joy,
      });

      if (user) {
        await updateCognitiveState(user.uid, {
          focus: mobiusSession.cognitiveState.focus,
          frustration: mobiusSession.cognitiveState.frustration,
          joy: mobiusSession.cognitiveState.joy,
        });
      }
      void refreshStudentStateSummary(studentId);

      setTheaterScript({
        sceneIntro: mobiusSession.story.sceneIntro,
        emotion: mobiusSession.story.emotion,
        interactionPrompt: mobiusSession.story.interactionPrompt,
        successScene: mobiusSession.story.successScene,
        failureScene: mobiusSession.story.failureScene,
      });
      setTheaterMeta({
        source: 'mobius',
        provider: mobiusSession.video.provider,
        providerJobId: mobiusSession.video.providerJobId,
        videoStatus: mobiusSession.video.status,
        videoUrl: mobiusSession.video.playbackUrl,
        activeVideoUrl: mobiusSession.video.status === 'ready' ? mobiusSession.video.playbackUrl : undefined,
        mediaJobId: mobiusSession.video.jobId ?? mobiusSession.sessionId.replace('mobius_', ''),
        branchOutcome: mobiusSession.video.branchOutcome,
        contentKnowledgePointTitle: primaryKnowledgePoint?.title,
        contentKnowledgePointGrade: primaryKnowledgePoint?.reference.grade,
        contentEvidence: contentResolution?.recommendedStorySeed.evidence.slice(0, 3),
        relatedQuestionSummary,
        diagnosedMistakeLabels: mobiusSession.errorProfile.diagnosedMistakes.map((item) => item.label),
        knowledgeActionLabel: mobiusSession.errorProfile.knowledgeAction.label,
        knowledgeActionType: mobiusSession.errorProfile.knowledgeAction.actionType,
        knowledgeActionId: mobiusSession.errorProfile.knowledgeAction.id,
      });
      setTheaterMode('playing');
      scheduleTheaterInteraction();
    } catch (mobiusError) {
      console.warn('Mobius orchestration failed, falling back to Gemini.', mobiusError);

      try {
        const newCogState = {
          focus: Math.min(100, cogState.focus + 20),
          frustration: Math.min(100, cogState.frustration + 10),
          joy: cogState.joy,
        };
        setCogState(newCogState);
        if (user) {
          await updateCognitiveState(user.uid, newCogState);
        }

        const script = await generateFallbackTheaterScript(errorItem);
        setTheaterScript(script);
        setTheaterMeta({
          source: 'gemini',
          provider: 'fallback',
          videoStatus: 'failed',
          errorMessage: 'Mobius unavailable, using Gemini local fallback.',
        });
        setTheaterMode('playing');
        scheduleTheaterInteraction();
      } catch (err) {
        console.error("Script gen failed:", err);
        setTheaterMode('idle');
        setCurrentScreen('error-book');
      }
    }
  };

  const handleTheaterResolution = async (outcome?: 'success' | 'failure') => {
    if (theaterDecisionPending) return;

    const derivedInteractionState = (() => {
      const actionType = theaterMeta?.knowledgeActionType;
      if (actionType === 'select') {
        const selected = SELECT_ACTION_OPTIONS.find((item) => item.id === theaterSelectedOption);
        return {
          completed: selected?.id === 'rule-first',
          selfCheck: selected?.result ?? theaterSelfCheck,
          note: `selected:${selected?.label ?? theaterSelectedOption}`,
        };
      }

      if (actionType === 'sequence') {
        const isExactOrder = theaterSequence.join('|') === SEQUENCE_ACTION_STEPS.join('|');
        const hasRuleInMiddle = theaterSequence[1] === '触发核心规则';
        return {
          completed: isExactOrder,
          selfCheck: (isExactOrder ? 'aligned' : hasRuleInMiddle ? 'partial' : 'guess') as 'aligned' | 'partial' | 'guess',
          note: `sequence:${theaterSequence.join(' -> ')}`,
        };
      }

      if (actionType === 'draw' || actionType === 'drag') {
        const allKeyPointsReady = theaterDrawCheckpoints.length >= 3;
        const partialReady = theaterDrawCheckpoints.length >= 2;
        return {
          completed: allKeyPointsReady,
          selfCheck: (allKeyPointsReady ? 'aligned' : partialReady ? 'partial' : 'guess') as 'aligned' | 'partial' | 'guess',
          note: `checkpoints:${theaterDrawCheckpoints.join(' -> ') || 'none'}`,
        };
      }

      return {
        completed: theaterActionCompleted,
        selfCheck: theaterSelfCheck,
        note: 'generic-submission',
      };
    })();

    if (theaterMeta?.source === 'mobius' && theaterMeta.mediaJobId) {
      try {
        setTheaterDecisionPending(true);
        const resolution = await resolveMobiusInteraction(theaterMeta.mediaJobId, {
          outcome,
          actionType: theaterMeta.knowledgeActionType ?? 'button-override',
          submission: outcome ? undefined : {
            actionId: theaterMeta.knowledgeActionId,
            actionType: theaterMeta.knowledgeActionType,
            completed: derivedInteractionState.completed,
            confidence: theaterConfidence,
            selfCheck: derivedInteractionState.selfCheck,
            note: derivedInteractionState.note,
          },
        });
        setTheaterResolution(resolution.outcome);
        setTheaterScript((current) => current ? {
          ...current,
          successScene: outcome === 'success' ? resolution.narration : current.successScene,
          failureScene: outcome === 'failure' ? resolution.narration : current.failureScene,
        } : current);
        setTheaterMeta((current) => current ? {
          ...current,
          provider: resolution.video?.provider ?? current.provider,
          providerJobId: resolution.video?.providerJobId ?? current.providerJobId,
          videoStatus: resolution.video?.status ?? current.videoStatus,
          videoUrl: resolution.video?.playbackUrl ?? current.videoUrl,
          activeVideoUrl: resolution.video?.status === 'ready' && resolution.video.playbackUrl
            ? resolution.video.playbackUrl
            : current.activeVideoUrl,
          mediaJobId: resolution.video?.jobId ?? current.mediaJobId,
          coachMessage: resolution.coachMessage,
          nextActions: resolution.nextActions,
          resolutionTitle: resolution.title,
          branchOutcome: resolution.video?.branchOutcome ?? resolution.outcome,
          adjudicationRationale: resolution.adjudication?.rationale,
          errorMessage: undefined,
        } : current);
        setTheaterMode('resolution');
        void refreshStudentStateSummary(user?.uid || 'demo-student');
      } catch (error) {
        console.warn('Mobius interaction resolve failed, falling back to local resolution.', error);
        setTheaterMeta((current) => current ? {
          ...current,
          errorMessage: '交互裁决请求失败，已回退到本地分支结果。',
        } : current);
        setTheaterResolution(outcome);
        setTheaterMode('resolution');
      } finally {
        setTheaterDecisionPending(false);
      }
      return;
    }

    setTheaterResolution(outcome ?? 'failure');
    setTheaterMode('resolution');
  };

  const rotateSequenceStep = (index: number) => {
    setTheaterSequence((current) => {
      if (index === current.length - 1) {
        return [current[index], ...current.slice(0, index)];
      }

      const next = [...current];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const toggleDrawCheckpoint = (checkpoint: string) => {
    setTheaterDrawCheckpoints((current) =>
      current.includes(checkpoint)
        ? current.filter((item) => item !== checkpoint)
        : [...current, checkpoint],
    );
  };

  const handleDehydrateHomework = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDehydrateMode('analyzing');
    setCurrentScreen('dehydrator');

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(',')[1];
      const mimeType = file.type;
      
      try {
        const data = await dehydrateHomeworkViaApi({
          imageBase64: base64String,
          mimeType,
          targetScore,
        });
        setDehydrateData(data);
        setDehydrateMode('ready');
        
        if (data.trashEasy + data.dropHard > 0) {
          handleTimeSavedUpdate((data.trashEasy + data.dropHard) * 5); // 5 mins saved per skipped question
        }
      } catch (err) {
        console.error("Dehydrate Analysis failed:", err);
        setDehydrateMode('idle');
        setCurrentScreen('dashboard');
      }
    };
    reader.readAsDataURL(file);
  };

  // --- Screens ---

  const renderWelcome = () => (
    <motion.div 
      key="welcome"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="absolute inset-0 w-full h-full flex flex-col p-6 pb-12 items-center justify-center text-center overflow-hidden"
    >
      <div className="absolute top-10 left-10 text-[var(--color-primary)] opacity-20"><Zap size={64} /></div>
      <div className="absolute bottom-40 right-10 text-[var(--color-secondary)] opacity-20"><SparkleIcon size={80} /></div>
      
      <div className="flex-1 flex flex-col justify-center items-center w-full max-w-md mx-auto z-10">
        <motion.div 
          animate={{ rotate: [0, -5, 5, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="bg-white border-4 border-[#1a1a2e] rounded-full w-24 h-24 flex items-center justify-center mb-8 shadow-[4px_4px_0_#1a1a2e]"
        >
          <img src="https://api.dicebear.com/7.x/bottts/svg?seed=liezi-yufeng" alt="列子御风 AI 伙伴" className="w-16 h-16" />
        </motion.div>
        
        <h1 className="text-4xl font-display font-bold leading-tight mb-4 text-[#1a1a2e]">
          今天先拿回<br/><span className="text-[var(--color-primary)] selection-bg">最值的分。</span>
        </h1>
        
        <p className="text-lg text-gray-600 mb-12 font-medium px-4">
          系统已为你挑出最短提分路径。完成这 3 项，你就比昨天更自由。
        </p>

        <button 
          onClick={async () => {
            try {
              let currentUser = user;
              if (!currentUser) {
                const res = await loginWithGoogle();
                currentUser = res.user;
              }
              const profile = await getUserProfile(currentUser.uid);
              if (profile && profile.grade) {
                setCurrentScreen('dashboard');
              } else {
                setCurrentScreen('profile-setup');
              }
            } catch (err) {
              console.error("Login Error:", err);
            }
          }}
          className="game-btn bg-[var(--color-primary)] text-white w-full py-4 text-xl flex items-center justify-center gap-2"
        >
          <Play fill="currentColor" size={24} /> {authChecking ? '连接中...' : '建立档案并诊断'}
        </button>
        
        <button className="mt-4 font-bold text-gray-500 flex items-center gap-2 py-2 px-4 hover:bg-gray-200 rounded-full transition-colors">
          <Clock size={18} /> 看看我省回多少时间
        </button>
        <button
          onClick={enterDemoMode}
          className="mt-3 font-bold text-[var(--color-primary)] flex items-center gap-2 py-2 px-4 bg-[var(--color-primary)]/10 rounded-full border border-[var(--color-primary)]/20 transition-colors"
        >
          <Zap size={18} /> 直接体验 Demo
        </button>
      </div>
    </motion.div>
  );

  const renderProfileSetup = () => (
    <motion.div 
      key="profile-setup"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="absolute inset-0 w-full h-full flex flex-col bg-gray-50 p-6 z-10"
    >
      <h2 className="text-3xl font-display font-bold text-[#1a1a2e] mb-2 mt-8">建立控分档案</h2>
      <p className="text-gray-500 font-bold mb-8">我们需要你的当前学段与教材版本，以精准匹配全国真题树。</p>
      
      <div className="space-y-8 flex-1 overflow-y-auto pb-6">
        {/* 年级选择 */}
        <div>
          <h3 className="font-bold text-lg mb-3">在读年级</h3>
          <div className="grid grid-cols-3 gap-2">
            {['三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级'].map(g => (
              <button 
                key={g}
                onClick={() => setGrade(g)}
                className={`py-2 px-3 rounded-xl border-2 font-bold text-sm transition-all ${
                  grade === g 
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] shadow-[2px_2px_0_var(--color-primary)]' 
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* 教材版本 */}
        <div>
          <h3 className="font-bold text-lg mb-3">三科教材版本</h3>
          <div className="space-y-3">
            {[{id: 'zh', name: '丹青语文', color: 'var(--color-subj-zh)', opts: ['部编版(人教)', '苏教版', '语文版']}, 
              {id: 'ma', name: '极光数学', color: 'var(--color-subj-ma)', opts: ['人教版', '北师大版', '苏教版']}, 
              {id: 'en', name: '阳光英语', color: 'var(--color-subj-en)', opts: ['人教PEP', '外研社', '牛津版']}].map(subj => (
              <div key={subj.id} className="flex items-center justify-between bg-white p-3 rounded-2xl border-2 border-[#1a1a2e] shadow-[2px_2px_0_#1a1a2e]">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full`} style={{backgroundColor: subj.color}}></div>
                  <span className="font-bold text-[#1a1a2e]">{subj.name}</span>
                </div>
                <select 
                  className="bg-gray-50 border-2 border-gray-200 rounded-lg px-2 py-1 font-bold text-sm outline-none focus:border-[var(--color-primary)]"
                  value={textbooks[subj.id as keyof typeof textbooks]}
                  onChange={(e) => setTextbooks({...textbooks, [subj.id]: e.target.value})}
                >
                  {subj.opts.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button 
        disabled={!grade}
        onClick={async () => {
          await saveProfileData({ grade, textbooks });
          setCurrentScreen('diagnostic-loading');
          setTimeout(() => setCurrentScreen('target-setter'), 3000);
        }}
        className="game-btn bg-[var(--color-primary)] text-white w-full py-4 text-xl flex justify-center items-center gap-2 mt-auto"
      >
        <MapIcon size={24} /> 开始极速诊断
      </button>
    </motion.div>
  );

  const renderDiagnosticLoading = () => (
    <motion.div 
      key="diag"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[var(--color-primary)] text-white"
    >
      <motion.div
        animate={{ rotate: 360, scale: [1, 1.1, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <BrainCircuit size={64} />
      </motion.div>
      <h2 className="text-2xl font-display font-bold mt-6 tracking-wider">列子御风 AI 演算中</h2>
      
      <div className="mt-8 space-y-3 w-64">
        {[
          { text: "扫描本地高频考点核心库...", delay: 0 },
          { text: "比对近 3 年期末真题概率...", delay: 0.8 },
          { text: "构建最小学习成本图谱...", delay: 1.6 }
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: item.delay }}
            className="flex items-center gap-2 text-sm font-bold opacity-80"
          >
            <Check size={16} /> {item.text}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );

  const renderTargetSetter = () => {
    const baseScore = 85;
    const ptsNeeded = targetScore - baseScore;
    const timeNeeded = Math.max(0, Math.ceil(ptsNeeded * 1.5));
    const tasksNeeded = Math.max(0, Math.ceil(ptsNeeded / 4));

    return (
      <motion.div 
        key="target-setter"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, y: 20 }}
        className="absolute inset-0 w-full h-full flex flex-col bg-gray-50 p-6 z-10"
      >
        <div className="flex items-center gap-2 mt-4 mb-2">
          <Sliders className="text-[var(--color-primary)]" />
          <h2 className="text-3xl font-display font-bold text-[#1a1a2e]">自由控分盘</h2>
        </div>
        <p className="text-gray-500 font-bold mb-8">AI 将为你计算达到目标分数的<span className="text-[var(--color-secondary)]">最短路径</span></p>
        
        {/* Slider Area */}
        <div className="bg-white p-6 rounded-[32px] border-4 border-[#1a1a2e] shadow-[4px_4px_0_#1a1a2e] mb-8">
          <div className="flex justify-between items-end mb-6">
            <span className="text-sm font-bold text-gray-400">设置你的目标</span>
            <span className="text-5xl font-display font-bold text-[var(--color-primary)] tracking-tight">
              {targetScore}<span className="text-lg text-gray-400 ml-1">/150</span>
            </span>
          </div>
          
          <input 
            type="range" 
            min={85} 
            max={145} 
            value={targetScore} 
            onChange={(e) => setTargetScore(Number(e.target.value))}
            className="w-full appearance-none h-4 rounded-full bg-gray-200 border-2 border-[#1a1a2e] outline-none cursor-pointer"
            style={{ backgroundImage: `linear-gradient(to right, var(--color-primary) ${(targetScore - 85) / 60 * 100}%, transparent 0)` }}
          />
          
          <div className="flex justify-between mt-3 text-xs font-bold text-gray-400">
            <span>85 (当前水平)</span>
            <span>150 满分</span>
          </div>
        </div>

        {/* AI Prediction Area */}
        <div className="game-card p-5 mb-auto relative overflow-hidden bg-[#1a1a2e] text-white border-0">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Cpu size={100} /></div>
          
          <div className="flex items-center gap-2 mb-6 relative z-10">
            <SparkleIcon className="text-[var(--color-accent-green)] w-6 h-6" />
            <h3 className="font-bold text-lg">AI 路径动态重组</h3>
          </div>
          
          <div className="space-y-4 relative z-10">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <span className="text-gray-400 font-medium">净提分需求</span>
              <span className="font-bold text-xl text-white">+{ptsNeeded} 分</span>
            </div>
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <span className="text-gray-400 font-medium">需攻克高频考点</span>
              <motion.span 
                key={tasksNeeded} 
                initial={{ scale: 1.5, color: '#FF8A3D' }} 
                animate={{ scale: 1, color: '#FF8A3D' }} 
                className="font-bold text-2xl text-[var(--color-secondary)] inline-block"
              >
                {tasksNeeded} 个
              </motion.span>
            </div>
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <span className="text-gray-400 font-medium">预计总耗时</span>
              <motion.span 
                key={timeNeeded} 
                initial={{ scale: 1.5, color: '#33D1A0' }} 
                animate={{ scale: 1, color: '#33D1A0' }} 
                className="font-bold text-2xl text-[var(--color-accent-green)] inline-block"
              >
                {timeNeeded} 分钟
              </motion.span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 font-medium">AI 命中率预估</span>
              <span className="font-bold text-xl text-white">96.8%</span>
            </div>
          </div>
        </div>

        <button 
          onClick={async () => {
             await saveProfileData({ targetScore });
             setCurrentScreen('dashboard');
          }}
          className="game-btn bg-[var(--color-primary)] text-white w-full py-4 text-xl flex justify-center items-center gap-2 mt-6"
        >
          <MapIcon fill="currentColor" size={24} /> 生成最短提分路径
        </button>
      </motion.div>
    );
  };

  const renderDashboard = () => (
    <motion.div 
      key="dash"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="absolute inset-0 w-full h-full flex flex-col bg-gray-50 pb-24"
    >
      <div className="bg-[var(--color-primary)] text-white p-6 pt-10 rounded-b-[40px] shadow-lg border-b-4 border-[#1a1a2e] relative z-10">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-white p-1 rounded-full border-2 border-[#1a1a2e]">
              <img src={user?.photoURL || "https://api.dicebear.com/7.x/notionists/svg?seed=Alex"} alt="Avatar" className="w-10 h-10 rounded-full" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">{user ? user.displayName?.split(' ')[0] : 'Alex'} 的列子风场 {grade ? `· ${grade}` : ''}</h2>
              <p className="text-xs font-bold text-white/80">今日只做最值当的题</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <div className="bg-white/20 px-3 py-1 rounded-full border border-white/40 flex items-center gap-1 font-bold text-xs">
              <Clock size={14} /> 已省回 {timeSaved} 分钟
            </div>
            <button
              onClick={() => { void toggleTheaterCueEnabled(); }}
              className="bg-white/20 px-3 py-1 rounded-full border border-white/40 text-xs font-bold flex items-center gap-1"
            >
              {theaterCueEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
              {theaterCueEnabled ? 'Cue 开' : 'Cue 关'}
            </button>
            {user && (
              <button 
                onClick={() => { logoutUser(); setDemoMode(false); setCurrentScreen('welcome'); }}
                className="bg-white/20 px-3 py-1 rounded-full border border-white/40 text-xs font-bold"
              >
                登出
              </button>
            )}
            {!user && demoMode && (
              <button
                onClick={() => { setDemoMode(false); setCurrentScreen('welcome'); }}
                className="bg-white/20 px-3 py-1 rounded-full border border-white/40 text-xs font-bold"
              >
                退出 Demo
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white text-[#1a1a2e] p-3 rounded-2xl border-2 border-[#1a1a2e] shadow-[2px_2px_0_#1a1a2e] text-center">
            <div className="text-xs font-bold text-gray-500 mb-1">目标分</div>
            <div className="text-2xl font-display font-bold text-[var(--color-primary)]">{targetScore}</div>
          </div>
          <div className="bg-white text-[#1a1a2e] p-3 rounded-2xl border-2 border-[#1a1a2e] shadow-[2px_2px_0_#1a1a2e] text-center">
            <div className="text-xs font-bold text-gray-500 mb-1">今日任务</div>
            <div className="text-2xl font-display font-bold text-[var(--color-secondary)]">{todayPlan.length}</div>
          </div>
          <div className="bg-white text-[#1a1a2e] p-3 rounded-2xl border-2 border-[#1a1a2e] shadow-[2px_2px_0_#1a1a2e] text-center">
            <div className="text-xs font-bold text-gray-500 mb-1">待修错题</div>
            <div className="text-2xl font-display font-bold text-[var(--color-accent-pink)]">{errorStats.total}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto w-full max-w-lg mx-auto">
        <div className="game-card p-5 mb-6 bg-[#1a1a2e] text-white border-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Target size={96} /></div>
          <div className="flex items-center justify-between mb-3 relative z-10">
            <h3 className="font-display text-2xl font-bold">今日任务</h3>
            <span className="text-xs font-bold bg-white/10 px-3 py-1 rounded-full border border-white/15">
              {planTotals.minutes} 分钟 · {planTotals.xp} XP
            </span>
          </div>
          <p className="text-sm text-gray-300 font-medium relative z-10">
            系统已按 {targetScore} 分目标重排路线。先修最值钱的失分点，再决定要不要继续扩张。
          </p>
        </div>

        <div className="game-card p-4 mb-6 bg-white border-2 border-[#1a1a2e]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-lg text-[#1a1a2e] flex items-center gap-2">
                <BrainCircuit size={18} className="text-[var(--color-primary)]" /> 长期学生状态
              </h3>
              <p className="text-xs text-gray-500 font-medium mt-1">现在的默认节奏，已经开始从历史 session 自动长出来。</p>
            </div>
            <button
              onClick={() => { void refreshStudentStateSummary(user?.uid || 'demo-student'); }}
              className="text-[11px] font-bold text-[var(--color-primary)]"
            >
              刷新
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            {studentModelCards.map((item) => (
              <div key={item.label} className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center">
                <div className={`text-base font-display font-bold ${item.tone}`}>{item.value}</div>
                <div className="mt-1 text-[10px] font-bold text-gray-500">{item.label}</div>
              </div>
            ))}
          </div>

          <div className="space-y-2 text-sm">
            <div className="rounded-xl border border-gray-100 bg-white p-3">
              <p className="text-[11px] font-bold text-gray-500 mb-1">近期高频痛点</p>
              <p className="font-bold text-[#1a1a2e]">
                {studentStateSummary?.recentPainPoints?.slice(0, 2).join(' · ') || '还在等待第一批可积累状态'}
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-3">
              <p className="text-[11px] font-bold text-gray-500 mb-1">当前活跃规则</p>
              <p className="font-bold text-[#1a1a2e]">
                {studentStateSummary?.activeRules?.[0] || '完成 1 次剧场交互后，这里会出现长期默认规则。'}
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-3">
              <p className="text-[11px] font-bold text-gray-500 mb-1">认知状态快照</p>
              <p className="font-medium text-gray-700">
                Focus {studentStateSummary?.currentCognitiveState?.focus ?? '--'} / Frustration {studentStateSummary?.currentCognitiveState?.frustration ?? '--'} / Joy {studentStateSummary?.currentCognitiveState?.joy ?? '--'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {todayPlan.map((task) => {
            const meta = SUBJECT_META[task.subject];
            const statusLabel = task.status === 'urgent' ? '优先' : task.status === 'done' ? '已完成' : '待执行';
            const statusClass = task.status === 'urgent'
              ? 'bg-[#1a1a2e] text-white'
              : task.status === 'done'
                ? 'bg-[var(--color-accent-green)] text-[#1a1a2e]'
                : 'bg-white text-gray-500';

            return (
              <div key={task.id} className="game-card p-4 relative overflow-hidden">
                <div className="absolute -right-5 -top-5 w-20 h-20 rounded-full opacity-20" style={{ backgroundColor: meta.color }}></div>
                <div className="flex justify-between items-start gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold px-2 py-1 rounded border-2 border-[#1a1a2e]" style={{ backgroundColor: meta.color, color: task.subject === 'en' ? '#1a1a2e' : '#fff' }}>
                        {meta.name}
                      </span>
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-full border ${statusClass}`}>{statusLabel}</span>
                    </div>
                    <h4 className="font-bold text-lg text-[#1a1a2e]">{task.title}</h4>
                    <p className="text-sm text-gray-600 font-medium mt-1 leading-relaxed">{task.detail}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-gray-500 flex items-center gap-1 justify-end"><Clock size={12} /> {task.mins}min</div>
                    <div className="text-sm font-bold mt-2" style={{ color: meta.color }}>+{task.xp} XP</div>
                  </div>
                </div>

                <button
                  onClick={() => handleTaskAction(task)}
                  className="game-btn bg-[var(--color-primary)] text-white w-full py-3 text-sm flex justify-center items-center gap-2"
                >
                  {task.status === 'done' ? '再执行一次' : '开始这一步'} <ChevronRight size={16} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="game-card p-4 text-left bg-[var(--color-secondary)] border-4 border-[#1a1a2e] shadow-[4px_4px_0_#1a1a2e]"
          >
            <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleUploadQuestion} />
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-white p-2 rounded-full border-2 border-[#1a1a2e]"><Camera size={18} className="text-[#1a1a2e]" /></div>
              <span className="font-display font-bold text-[#1a1a2e]">拍题破局</span>
            </div>
            <p className="text-sm font-bold text-[#1a1a2e]/80">上传真实难题，直接拆出法则与检测题。</p>
          </button>

          <button
            onClick={() => dehydrateInputRef.current?.click()}
            className="game-card p-4 text-left bg-[#1a1a2e] text-white border-4 border-[var(--color-secondary)] shadow-[0_0_15px_var(--color-secondary)]"
          >
            <input type="file" accept="image/*" ref={dehydrateInputRef} className="hidden" onChange={handleDehydrateHomework} />
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-white/10 p-2 rounded-full border border-white/15"><Zap size={18} className="text-[var(--color-secondary)]" /></div>
              <span className="font-display font-bold text-[var(--color-secondary)]">作业脱水</span>
            </div>
            <p className="text-sm font-bold text-gray-300">整页作业拍进来，系统只留下必须做的题。</p>
          </button>
        </div>

        <div className="game-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-lg text-[#1a1a2e] flex items-center gap-2">
              <RefreshCw size={18} className="text-[var(--color-secondary)]" /> 错题雷达
            </h3>
            <button
              onClick={() => setCurrentScreen('error-book')}
              className="text-sm font-bold text-[var(--color-primary)]"
            >
              查看全部
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
              <div className="text-xl font-display font-bold text-[#1a1a2e]">{errorStats.total}</div>
              <div className="text-[10px] font-bold text-gray-500 mt-1">总错题</div>
            </div>
            <div className="rounded-xl p-3 text-center border" style={{ backgroundColor: SUBJECT_META.zh.light, borderColor: 'rgba(255,93,115,0.15)' }}>
              <div className="text-xl font-display font-bold" style={{ color: SUBJECT_META.zh.color }}>{errorStats.zh}</div>
              <div className="text-[10px] font-bold text-gray-500 mt-1">语文</div>
            </div>
            <div className="rounded-xl p-3 text-center border" style={{ backgroundColor: SUBJECT_META.ma.light, borderColor: 'rgba(0,180,216,0.15)' }}>
              <div className="text-xl font-display font-bold" style={{ color: SUBJECT_META.ma.color }}>{errorStats.ma}</div>
              <div className="text-[10px] font-bold text-gray-500 mt-1">数学</div>
            </div>
            <div className="rounded-xl p-3 text-center border" style={{ backgroundColor: SUBJECT_META.en.light, borderColor: 'rgba(255,190,11,0.15)' }}>
              <div className="text-xl font-display font-bold" style={{ color: SUBJECT_META.en.color }}>{errorStats.en}</div>
              <div className="text-[10px] font-bold text-gray-500 mt-1">英语</div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderSubjectMap = () => {
    const activeMeta = SUBJECT_META[mapSubject];
    const activeNodes = knowledgeMap[mapSubject];
    const learningCount = activeNodes.filter((node) => node.state === 'learning').length;
    const masteredCount = activeNodes.filter((node) => node.state === 'mastered').length;
    const activeTextbook = textbooks[mapSubject as keyof typeof textbooks];
    const overallProgress = Math.round(activeNodes.reduce((sum, node) => sum + node.progress, 0) / Math.max(activeNodes.length, 1));
    const recommendedNodeActive = mapSubject === preferredFocus.subject ? preferredFocus.node : '';

    return (
      <motion.div 
        key="subject-map"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="absolute inset-0 w-full h-full flex flex-col bg-[#F4F6FB] pb-24"
      >
        <div className="text-white p-6 pt-10 rounded-b-[40px] shadow-lg border-b-4 border-[#1a1a2e] relative z-10" style={{ backgroundColor: activeMeta.color }}>
          <h2 className="text-2xl font-display font-bold flex items-center gap-2"><MapIcon /> {activeMeta.name} · 知识地图</h2>
          <p className="text-sm font-bold text-white/80 mt-2">当前教材：{activeTextbook}。点亮已掌握节点，盯住正在失血的区域，锁住暂时不该花时间的深水区。</p>
          <div className="mt-4 bg-white/15 rounded-2xl p-3 border border-white/20">
            <div className="flex justify-between text-xs font-bold mb-2">
              <span>{activeMeta.textbookLabel}</span>
              <span>{overallProgress}%</span>
            </div>
            <div className="h-3 bg-black/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all" style={{ width: `${overallProgress}%` }}></div>
            </div>
          </div>
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
            {(['zh', 'ma', 'en'] as SubjectKey[]).map((subject) => (
              <button
                key={subject}
                onClick={() => setMapSubject(subject)}
                className={`px-4 py-1 font-bold rounded-full border-2 text-sm whitespace-nowrap ${mapSubject === subject ? 'bg-white text-[#1a1a2e] border-[#1a1a2e]' : 'bg-black/20 text-white border-transparent'}`}
              >
                {SUBJECT_META[subject].name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto w-full max-w-lg mx-auto">
          {recommendedNodeActive ? (
            <div className="mb-4 rounded-2xl border-2 border-[#1a1a2e] bg-white px-4 py-3 shadow-[3px_3px_0_#1a1a2e]">
              <p className="text-[11px] font-bold text-gray-500 mb-1">AI 推荐修复节点</p>
              <p className="font-bold text-[#1a1a2e]">
                先处理“{recommendedNodeActive}”
                {studentStateSummary?.interactionStats.lastOutcome === 'failure' ? '，因为最近一次裁决还没命中规则。' : '，这是最近长期状态里最该优先收口的一块。'}
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="game-card p-4 text-center">
              <div className="text-2xl font-display font-bold text-[var(--color-accent-green)]">{masteredCount}</div>
              <div className="text-xs font-bold text-gray-500 mt-1">已掌握</div>
            </div>
            <div className="game-card p-4 text-center">
              <div className="text-2xl font-display font-bold text-[var(--color-secondary)]">{learningCount}</div>
              <div className="text-xs font-bold text-gray-500 mt-1">修复中</div>
            </div>
            <div className="game-card p-4 text-center">
              <div className="text-2xl font-display font-bold text-gray-400">{activeNodes.length - learningCount - masteredCount}</div>
              <div className="text-xs font-bold text-gray-500 mt-1">未启动</div>
            </div>
          </div>

          <div className="space-y-4">
            {activeNodes.map((node, index) => {
              const isLearning = node.state === 'learning';
              const isMastered = node.state === 'mastered';
              const offset = index % 2 === 0 ? 'translate-x-8' : '-translate-x-8';
              const isRecommended = Boolean(recommendedNodeActive && node.name === recommendedNodeActive);

              return (
                <div key={node.name} className={`relative flex flex-col items-center ${offset}`}>
                  {index !== activeNodes.length - 1 && (
                    <div className="absolute top-16 h-12 border-l-4 border-dashed border-gray-300"></div>
                  )}
                  {isRecommended && (
                    <div className="absolute -top-2 z-20 rounded-full bg-[var(--color-secondary)] px-3 py-1 text-[10px] font-black text-[#1a1a2e] border-2 border-[#1a1a2e] shadow-[2px_2px_0_#1a1a2e]">
                      AI 推荐修复
                    </div>
                  )}
                  <button
                    onClick={() => handleMapNodePress(mapSubject, node.name)}
                    className={`relative z-10 w-18 h-18 rounded-full border-4 mb-3 flex items-center justify-center transition-transform ${node.state === 'locked' ? 'cursor-pointer bg-gray-200 text-gray-400 border-[#1a1a2e]' : 'cursor-pointer hover:scale-105 border-[#1a1a2e]'}`}
                    style={{
                      width: isRecommended ? 92 : isLearning ? 84 : 72,
                      height: isRecommended ? 92 : isLearning ? 84 : 72,
                      backgroundColor: isMastered ? 'var(--color-accent-green)' : isLearning ? activeMeta.color : '#d1d5db',
                      color: isLearning ? '#fff' : isMastered ? '#1a1a2e' : '#6b7280',
                      boxShadow: isRecommended
                        ? `0 0 0 4px rgba(255,190,11,0.35), 4px 4px 0 #1a1a2e`
                        : isLearning
                          ? '4px 4px 0 #1a1a2e'
                          : '2px 2px 0 rgba(26,26,46,0.25)',
                    }}
                  >
                    {isMastered ? <Check size={26} strokeWidth={3.5} /> : isLearning ? <Flame size={28} /> : <Lock size={22} />}
                  </button>
                  <div className="text-center max-w-[180px]">
                    <div className={`inline-flex px-3 py-1 rounded-full border-2 border-[#1a1a2e] font-bold text-sm ${isLearning ? 'bg-white shadow-[2px_2px_0_#1a1a2e]' : isMastered ? 'bg-[var(--color-accent-green)] text-[#1a1a2e]' : 'bg-white text-gray-400'} ${isRecommended ? 'ring-2 ring-[var(--color-secondary)]' : ''}`}>
                      {node.name}
                    </div>
                    <div className="text-sm font-display font-bold mt-2" style={{ color: isLearning ? activeMeta.color : isMastered ? 'var(--color-accent-green)' : '#9ca3af' }}>
                      {node.progress}%
                    </div>
                    <div className="text-xs font-bold text-gray-500 mt-2">
                      {isRecommended ? '系统建议先修这一个' : isLearning ? '点击直接去修复' : isMastered ? '已稳定拿分' : '暂未进入今日主线'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderErrorBook = () => (
    <motion.div 
      key="error-book"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="absolute inset-0 w-full h-full flex flex-col bg-gray-50 pb-24"
    >
      <div className="p-6 pt-10 flex-1 overflow-y-auto">
        <h2 className="text-3xl font-display font-bold text-[#1a1a2e] flex items-center gap-2 mb-2">
          <RefreshCw className="text-[var(--color-secondary)]" /> 错题本增强
        </h2>
        <p className="text-gray-500 font-bold mb-6 text-sm">不再只是收藏夹。这里负责筛选、重做、消灭和退出重复失分。</p>

        <div className="game-card p-4 mb-5 border-2 border-[#1a1a2e] bg-[#1a1a2e] text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-white/60 mb-1">长期状态摘要</p>
              <p className="font-bold text-sm leading-relaxed">
                {studentStateSummary?.interactionStats.lastOutcome === 'success'
                  ? '最近一次剧场裁决命中了规则，可以继续做窄提示强化。'
                  : studentStateSummary?.interactionStats.lastOutcome === 'failure'
                    ? '最近一次剧场裁决未命中规则，当前更适合保护性引导。'
                    : '还没有足够的长期裁决数据，先从首轮剧场重构开始。'}
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xl font-display font-bold text-[var(--color-secondary)]">
                {studentStateSummary?.interactionStats.successCount ?? 0}/{(studentStateSummary?.interactionStats.successCount ?? 0) + (studentStateSummary?.interactionStats.failureCount ?? 0)}
              </div>
              <div className="text-[10px] font-bold text-white/60">成功裁决</div>
            </div>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
            {(studentStateSummary?.recentPainPoints?.length
              ? studentStateSummary.recentPainPoints.slice(0, 3)
              : ['等待状态积累']).map((item) => (
              <span
                key={item}
                className="whitespace-nowrap rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-white/85"
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-5">
          <div className="game-card p-3 text-center">
            <div className="text-2xl font-display font-bold text-[#1a1a2e]">{errorStats.total}</div>
            <div className="text-[10px] font-bold text-gray-500 mt-1">总错题</div>
          </div>
          <div className="game-card p-3 text-center" style={{ backgroundColor: SUBJECT_META.zh.light }}>
            <div className="text-2xl font-display font-bold" style={{ color: SUBJECT_META.zh.color }}>{errorStats.zh}</div>
            <div className="text-[10px] font-bold text-gray-500 mt-1">语文</div>
          </div>
          <div className="game-card p-3 text-center" style={{ backgroundColor: SUBJECT_META.ma.light }}>
            <div className="text-2xl font-display font-bold" style={{ color: SUBJECT_META.ma.color }}>{errorStats.ma}</div>
            <div className="text-[10px] font-bold text-gray-500 mt-1">数学</div>
          </div>
          <div className="game-card p-3 text-center" style={{ backgroundColor: SUBJECT_META.en.light }}>
            <div className="text-2xl font-display font-bold" style={{ color: SUBJECT_META.en.color }}>{errorStats.en}</div>
            <div className="text-[10px] font-bold text-gray-500 mt-1">英语</div>
          </div>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          {([
            ['all', '全部'],
            ['zh', '语文'],
            ['ma', '数学'],
            ['en', '英语'],
          ] as [ErrorFilter, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setErrorFilter(value)}
              className={`px-4 py-2 rounded-xl border-2 font-bold text-sm whitespace-nowrap ${errorFilter === value ? 'bg-[#1a1a2e] text-white border-[#1a1a2e] shadow-[2px_2px_0_#1a1a2e]' : 'bg-white text-gray-500 border-gray-200'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {filteredErrors.length === 0 ? (
            <div className="text-center text-gray-400 mt-10 font-bold border-2 border-gray-200 border-dashed rounded-xl p-8">
              当前筛选下没有待修复错题，继续保持这条线的稳定输出。
            </div>
          ) : (
            filteredErrors.map((err, idx) => {
              const { subject, node } = getErrorMeta(err);
              const meta = SUBJECT_META[subject];
              const isRecommended = Boolean(recommendedErrorId && err.id === recommendedErrorId);

              return (
                <div
                  key={err.id || idx}
                  className="game-card p-4 relative flex flex-col"
                  style={{
                    borderLeftWidth: 8,
                    borderLeftColor: meta.color,
                    boxShadow: isRecommended ? '0 0 0 3px rgba(255,190,11,0.25), 4px 4px 0 rgba(26,26,46,0.18)' : undefined,
                  }}
                >
                  {isRecommended && (
                    <div className="absolute right-3 top-3 rounded-full bg-[var(--color-secondary)] px-3 py-1 text-[10px] font-black text-[#1a1a2e] border-2 border-[#1a1a2e] shadow-[2px_2px_0_#1a1a2e]">
                      AI 当前主线
                    </div>
                  )}
                  <div className="flex justify-between items-start gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold px-2 py-1 rounded border-2 border-[#1a1a2e]" style={{ backgroundColor: meta.color, color: subject === 'en' ? '#1a1a2e' : '#fff' }}>
                          {meta.name}
                        </span>
                        <span className="text-[11px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded border border-gray-200">
                          {getErrorRecencyLabel(idx)}
                        </span>
                      </div>
                      <h4 className="font-bold text-lg text-[#1a1a2e] line-clamp-2">{node}</h4>
                    </div>
                    <span className="text-xs font-bold bg-[#1a1a2e] text-white px-2 py-1 rounded whitespace-nowrap">待复活</span>
                  </div>

                  <p className="text-sm text-gray-600 font-medium leading-relaxed mb-3">
                    {err.rule || err.painPoint || err.questionText?.substring(0, 60)}
                  </p>

                  <div className="flex gap-2 mb-4 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                    <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded border border-gray-200 whitespace-nowrap">{meta.short}薄弱点</span>
                    <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded border border-gray-200 whitespace-nowrap">点击可重做</span>
                    <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded border border-gray-200 whitespace-nowrap">{node}</span>
                    {isRecommended && (
                      <span className="bg-[var(--color-secondary)]/20 text-[#1a1a2e] text-xs font-bold px-2 py-1 rounded border-2 border-[#1a1a2e] whitespace-nowrap">长期状态推荐</span>
                    )}
                  </div>
                 
                  <div className="grid grid-cols-3 gap-2 mt-auto">
                    <button 
                      onClick={() => startContinuousPractice(filteredErrors, idx)}
                      className="game-btn bg-gray-200 text-gray-700 py-3 text-sm flex justify-center items-center gap-1 border-0"
                    >
                      连续练习
                    </button>
                    <button 
                      onClick={() => {
                        setPracticeQueue([]);
                        setPracticeIndex(0);
                        generateTheaterScript(err);
                      }}
                      className="game-btn bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white py-3 text-sm flex justify-center items-center gap-2 border-2 border-[#1a1a2e] shadow-[2px_2px_0_#1a1a2e]"
                    >
                      剧场重构
                    </button>
                    <button
                      onClick={async () => {
                        if (demoMode) {
                          setErrorList((current) => current.filter((item) => item.id !== err.id));
                        } else {
                          if (!user || !err.id) return;
                          await resolveError(user.uid, err.id);
                        }
                        await markTaskComplete('error-revive');
                        await markTaskComplete('stability-round');
                        if (!demoMode) {
                          await loadErrors();
                        }
                      }}
                      className="game-btn bg-[var(--color-accent-green)] text-[#1a1a2e] py-3 text-sm flex justify-center items-center gap-1 border-0"
                    >
                      已掌握
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </motion.div>
  );

  const renderOverview = () => (
    <motion.div 
      key="overview"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="absolute inset-0 w-full h-full flex flex-col bg-gray-50 pb-24 p-6 pt-10"
    >
      <h2 className="text-3xl font-display font-bold text-[#1a1a2e] flex items-center gap-2 mb-6">
        <Trophy className="text-[var(--color-primary)]" /> 家长驾驶舱
      </h2>
      <div className="bg-[#1a1a2e] text-white p-6 rounded-[32px] border-4 border-[#1a1a2e] shadow-[4px_4px_0_#1a1a2e] mb-6 relative overflow-hidden">
        <div className="absolute top-4 right-4 opacity-10"><Trophy size={100} /></div>
        <p className="text-gray-400 font-bold mb-2 text-sm relative z-10">本周效率评估</p>
        <div className="flex items-end gap-2 mb-4 relative z-10">
          <span className="text-5xl font-display font-bold text-[var(--color-primary)]">S</span>
          <span className="text-lg font-bold">极佳</span>
        </div>
        <p className="font-medium text-sm relative z-10 leading-relaxed text-gray-300">
          累计省下低效练习时间 <span className="text-[var(--color-secondary)] font-bold text-lg">{timeSaved} 分钟</span>，
          预测周末 Boss 战将额外提分 <span className="text-[var(--color-accent-green)] font-bold text-lg">+18 分</span>。
        </p>
      </div>

      <h3 className="font-bold text-lg mb-3">近期核心进展</h3>
      <div className="game-card p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <span className="font-bold text-[#1a1a2e] text-sm">攻克高危知识点</span>
          <span className="text-[var(--color-primary)] font-bold">4 个</span>
        </div>
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <span className="font-bold text-[#1a1a2e] text-sm">错题重复失效率</span>
          <span className="text-[var(--color-accent-green)] font-bold text-sm">↓ 12% (稳步下降)</span>
        </div>
      </div>

      <h3 className="font-bold text-lg mb-3 mt-6">体验偏好</h3>
      <div className="game-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-bold text-[#1a1a2e] text-sm">剧场分支 Cue 音效</p>
            <p className="text-xs text-gray-500 leading-relaxed mt-1">
              控制分支视频 ready 时的短音效提示。视觉切换会始终保留。
            </p>
          </div>
          <button
            type="button"
            onClick={() => { void toggleTheaterCueEnabled(); }}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-mono border transition ${
              theaterCueEnabled
                ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]'
                : 'bg-gray-100 text-gray-500 border-gray-200'
            }`}
          >
            {theaterCueEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            {theaterCueEnabled ? '已开启' : '已静音'}
          </button>
        </div>
      </div>
    </motion.div>
  );

  const [combatAnswer, setCombatAnswer] = useState('');

  const renderCombat = () => {
    if (aiMode === 'analyzing') {
      return (
        <motion.div 
          key="analyze"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[var(--color-secondary)] text-[#1a1a2e]"
        >
          <motion.div
            animate={{ rotate: 360, scale: [1, 1.1, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="mb-8"
          >
            <Camera size={80} />
          </motion.div>
          <h2 className="text-3xl font-display font-bold mb-4">多模态剥离中...</h2>
          <div className="w-64 space-y-3">
             <div className="flex items-center gap-2 font-bold"><Check size={18}/> 提取题干与迷惑图层</div>
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="flex items-center gap-2 font-bold"><Check size={18}/> 检索全网真题同源模型</motion.div>
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} className="flex items-center gap-2 font-bold"><Check size={18}/> 生成定制化“一句话法则”</motion.div>
          </div>
        </motion.div>
      );
    }

    const isAiContent = aiMode === 'ready' && aiData;

    return (
      <motion.div 
        key="combat"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="absolute inset-0 w-full h-full flex flex-col bg-white"
      >
        <div className="p-4 border-b-2 border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentScreen('dashboard')} className="mr-2 text-gray-500 hover:text-gray-700 bg-gray-100 p-1.5 rounded-full">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            <div className={`w-3 h-3 rounded-full ${isAiContent ? 'bg-[var(--color-secondary)]' : 'bg-[var(--color-subj-ma)]'}`}></div>
            <span className="font-bold text-sm">
              {practiceQueue.length > 1
                ? `连续练习 ${practiceIndex + 1}/${practiceQueue.length}`
                : isAiContent
                  ? 'AI 多模态动态推演'
                  : '极光数学 · 几何辅助线'}
            </span>
          </div>
          <div className="bg-gray-100 rounded-full h-2 w-24 overflow-hidden border border-gray-300">
            <div
              className="bg-[var(--color-primary)] h-full transition-all"
              style={{ width: `${practiceQueue.length > 1 ? ((practiceIndex + 1) / practiceQueue.length) * 100 : 50}%` }}
            ></div>
          </div>
        </div>

        <div className="flex-1 p-6 flex flex-col max-w-lg mx-auto w-full overflow-y-auto">
          {/* AI Prediction Header */}
          <div className="bg-[var(--color-secondary)]/10 border-2 border-[var(--color-secondary)] rounded-xl p-4 mb-4 flex gap-3 relative overflow-hidden">
             <div className="absolute -right-4 -bottom-4 opacity-10"><Target size={80} /></div>
             <div className="text-[var(--color-secondary)] z-10"><BrainCircuit size={24} /></div>
             <div className="z-10">
               <h5 className="font-bold text-sm text-[var(--color-secondary)] mb-1">AI 考向超前预判</h5>
               <p className="text-xs font-bold text-[#1a1a2e] opacity-80 leading-relaxed">
                 {isAiContent ? `【痛点锁定】：${aiData.painPoint}。掌握规则可直接避开陷阱。` : '分析全国近 3 年期末真题库证实，此模型【必考频率 96%】。拿下它可直接锁定 +4 分。'}
               </p>
             </div>
          </div>

          {/* Core Rule */}
          <div className="bg-[var(--color-primary)]/10 border-2 border-[var(--color-primary)] rounded-xl p-4 mb-6 flex gap-3">
            <div className="bg-[var(--color-primary)] text-white rounded-full p-2 h-fit border-2 border-[#1a1a2e] min-w-fit"><Beaker size={20} /></div>
            <div>
              <h5 className="font-bold text-[var(--color-primary)] text-sm mb-1 uppercase tracking-wider">一句话法则</h5>
              <p className="font-bold text-[#1a1a2e]">{isAiContent ? aiData.rule : '遇中点，连中线。构造平行四边形或中位线定理。'}</p>
            </div>
          </div>

          {/* Question */}
          <div className="flex-1 mb-6">
            <h3 className="font-bold text-lg mb-4">实战检测</h3>
            <div className="bg-gray-50 rounded-2xl p-6 border-2 border-gray-200 mb-6 relative">
              <p className="text-[#1a1a2e] font-medium leading-relaxed mb-6 whitespace-pre-wrap">
                {isAiContent ? aiData.questionText : '在 △ABC 中，D 为 AB 边上的中点，已知 AC = 8，BC = 6。为了求 CD 的取值范围，第一步最稳妥的辅助线应该怎么画？'}
              </p>
              
              <div className="space-y-3 mt-4">
                {(isAiContent ? aiData.options : ['过 D 作 DE // BC', '延长 CD 至 E，使 DE = CD，连接 AE, BE', '过 C 作 CF ⊥ AB', '作 BC 的垂直平分线']).map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCombatAnswer(option)}
                    className={`w-full text-left p-4 rounded-xl border-2 font-bold transition-all ${
                      combatAnswer === option 
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] shadow-[2px_2px_0_var(--color-primary)]' 
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    {String.fromCharCode(65 + idx)}. {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-white border-t-2 border-gray-100 pb-safe">
          <button 
            disabled={!combatAnswer}
            onClick={() => setCurrentScreen('combat-feedback')}
            className={`game-btn text-white w-full py-4 text-lg flex justify-center items-center gap-2 ${
              combatAnswer ? 'bg-[var(--color-primary)]' : 'bg-gray-300 cursor-not-allowed border-gray-400 border-b-4'
            }`}
          >
            提交校验 <ChevronRight />
          </button>
        </div>
      </motion.div>
    );
  };

  const renderDehydrator = () => {
    if (dehydrateMode === 'analyzing') {
      return (
        <motion.div 
          key="analyze-dehydrate"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[#1a1a2e] text-white"
        >
          <div className="absolute top-6 left-6 z-50">
            <button onClick={() => setCurrentScreen('dashboard')} className="text-gray-400 hover:text-white p-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/matrix-stampa.png')] opacity-20 animate-pulse"></div>
          <motion.div
            animate={{ rotate: -360, scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="mb-8 relative z-10 text-[var(--color-secondary)]"
          >
            <Cpu size={100} />
          </motion.div>
          <h2 className="text-3xl font-display font-bold mb-4 relative z-10 text-[var(--color-secondary)] drop-shadow-[0_0_10px_var(--color-secondary)]">暴风脱水中...</h2>
          <div className="w-72 space-y-3 relative z-10">
             <div className="flex items-center gap-2 font-bold text-gray-300"><Check className="text-[var(--color-accent-green)]" size={18}/> 扫描整卷知识点矩阵</div>
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="flex items-center gap-2 font-bold text-gray-300"><Check className="text-[var(--color-accent-green)]" size={18}/> 计算 115 分边界 ROI 极值</motion.div>
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} className="flex items-center gap-2 font-bold text-[var(--color-accent-pink)]"><Zap size={18}/> 废除无效机械惩罚任务</motion.div>
          </div>
        </motion.div>
      );
    }

    const data = dehydrateData;
    if (!data) return null;

    const savedMins = (data.trashEasy + data.dropHard) * 5;

    return (
      <motion.div 
        key="dehydrate-result"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="absolute inset-0 w-full h-full flex flex-col bg-[#1a1a2e] text-white overflow-y-auto"
      >
        <div className="p-6 pt-12 pb-24 max-w-lg mx-auto w-full relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-secondary)] opacity-10 blur-[100px] rounded-full"></div>
          
          <h2 className="text-4xl font-display font-bold text-[var(--color-secondary)] mb-2 flex items-center gap-3">
            <ShieldAlert size={36} /> 脱水完毕
          </h2>
          <p className="text-gray-400 font-bold mb-8">
            传统教育会让你把 {data.total} 题全做完。我帮你砸碎了其中 {data.trashEasy + data.dropHard} 题。
          </p>

          {/* Stats Bar */}
          <div className="bg-white/10 rounded-2xl p-4 border border-white/20 mb-6 font-mono grid grid-cols-3 gap-2 text-center divide-x divide-white/10">
            <div>
              <div className="text-3xl font-bold text-[var(--color-accent-pink)]">{data.dropHard}</div>
              <div className="text-[10px] text-gray-400 font-bold uppercase mt-1">超纲放弃 (Drop)</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-500">{data.trashEasy}</div>
              <div className="text-[10px] text-gray-400 font-bold uppercase mt-1">机械重复 (Trash)</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-[var(--color-accent-green)]">{data.mustDo}</div>
              <div className="text-[10px] text-[var(--color-accent-green)] font-bold uppercase mt-1">高悬赏区 (Must Do)</div>
            </div>
          </div>

          <div className="bg-[var(--color-secondary)] text-[#1a1a2e] rounded-xl p-5 mb-8 border-4 border-[#1a1a2e] shadow-[4px_4px_0_rgba(255,255,255,0.2)]">
            <h3 className="font-black text-xl mb-2 flex items-center gap-2"><Trophy size={20} /> AI 核心指令：</h3>
            <p className="font-bold leading-relaxed">{data.reasoning}</p>
          </div>

          <div className="border-l-4 border-[var(--color-accent-green)] pl-4 mb-10">
            <h4 className="text-sm font-bold text-gray-400 mb-1">你今晚只需要完成以下题目：</h4>
            <div className="text-2xl font-black text-white">{data.mustDoIndices || '无，全部免做！'}</div>
          </div>

          <div className="bg-[var(--color-accent-pink)]/20 border border-[var(--color-accent-pink)] rounded-xl p-4 flex gap-3 text-[var(--color-accent-pink)] mb-10">
            <Lock size={24} className="shrink-0" />
            <p className="text-sm font-bold mt-1">
              注意：其它题型已被强行列入【战略放弃区】，系统禁止你在这上面浪费时间去换取那微茫的分数。
            </p>
          </div>

        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#1a1a2e]/90 backdrop-blur pb-safe text-center w-full max-w-md mx-auto z-50 border-t border-white/10">
          <p className="text-[var(--color-secondary)] font-bold mb-3">为你的青春挽回了 {savedMins} 分钟</p>
          <button 
            onClick={async () => {
              await markTaskComplete('dehydrate-homework');
              setCurrentScreen('dashboard');
              setDehydrateMode('idle');
              setDehydrateData(null);
            }}
            className="game-btn bg-[var(--color-secondary)] text-[#1a1a2e] w-full py-4 text-lg border-2 border-transparent"
          >
            批准执行，生成免做凭证
          </button>
        </div>
      </motion.div>
    );
  };
  const renderCombatFeedback = () => {
    const isAiContent = aiMode === 'ready' && aiData;
    const isCorrect = isAiContent ? combatAnswer === aiData.correctAnswer : combatAnswer === '延长 CD 至 E，使 DE = CD，连接 AE, BE';
    
    if (!isCorrect) {
      return (
        <motion.div 
          key="socratic-feedback"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 w-full h-full flex flex-col bg-[#0a0a0a] text-[#00ff41] p-6 text-left font-mono"
        >
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] opacity-20"></div>
          
          <div className="flex-1 w-full max-w-sm mx-auto relative z-10 flex flex-col pt-12">
            <motion.div 
              initial={{ y: 20, opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              transition={{ delay: 0.1 }}
              className="mb-6 font-bold"
            >
              {">"} ERROR: LOGIC BREACH DETECTED.
            </motion.div>
            
            <motion.div 
              initial={{ y: 20, opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              transition={{ delay: 0.8 }}
              className="mb-6 font-bold text-gray-400"
            >
              {">"} INITIATING SOCRATIC INCEPTION...
            </motion.div>

            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              transition={{ delay: 1.5 }}
              className="mb-8 border-l-4 border-[#00ff41] pl-4 text-lg"
            >
              <p className="mb-2">"Wake up. You chose <span className="text-[#ff003c]">{combatAnswer || 'an incorrect path'}</span>."</p>
              <p className="text-white mt-4 leading-relaxed">
                {isAiContent ? aiData.rule : 'The key is "midpoint (中点)". If you have a midpoint, what happens if you double the median line?'}
              </p>
              <p className="text-xs text-gray-500 mt-4">_ System has logged this into your Error Resurrection Queue.</p>
            </motion.div>

            <div className="mt-auto mb-8">
              <button 
                onClick={async () => {
                   if (isAiContent && user) {
                     await saveErrorRecord(user.uid, aiData);
                   } else if (isAiContent && demoMode) {
                     setErrorList((current) => [{ ...aiData, id: `demo-added-${Date.now()}`, status: 'active' }, ...current]);
                   }
                   setCurrentScreen('combat');
                   setCombatAnswer('');
                }}
                className="w-full bg-transparent border-2 border-[#00ff41] text-[#00ff41] py-4 font-bold uppercase tracking-widest hover:bg-[#00ff41] hover:text-black transition-colors"
              >
                [ Retry Override ]
              </button>
            </div>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div 
        key="feedback-success"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute inset-0 w-full h-full flex flex-col bg-[var(--color-accent-green)] text-[#1a1a2e] justify-center items-center p-6 text-center"
      >
        <div className="absolute top-0 right-0 p-10 opacity-20">
          <SparkleIcon size={120} />
        </div>
        
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1, rotate: [0, -10, 10, 0] }}
          transition={{ type: "spring", stiffness: 200, damping: 10 }}
          className="bg-white rounded-full w-28 h-28 flex items-center justify-center border-4 border-[#1a1a2e] shadow-[4px_4px_0_#1a1a2e] mb-8 z-10 text-[var(--color-accent-green)]"
        >
          <Check size={56} strokeWidth={4} />
        </motion.div>

        <h2 className="font-display text-4xl font-bold mb-4 relative z-10 retro-text-shadow text-white">
          正确！修复成功
        </h2>
        <p className="text-lg font-bold mb-8 bg-white/20 text-[#1a1a2e] p-4 rounded-2xl border-2 border-[#1a1a2e] relative z-10 shadow-[4px_4px_0_#1a1a2e]">
          {isAiContent ? '完美应用法则成功破茧，你已完全掌握这道题的核心陷阱！' : '识别到了中点，选择“倍长中线”造全等，思路非常完美。这 4 分你拿稳了！'}
        </p>

        <div className="flex gap-4 w-full max-w-sm relative z-10 mt-8">
          <button 
            onClick={async () => {
               // Award points and save
               handleTimeSavedUpdate(15);
               if (isAiContent && (aiData as any)._errorId) {
                 if (user) {
                   await resolveError(user.uid, (aiData as any)._errorId);
                   await loadErrors();
                 } else if (demoMode) {
                   setErrorList((current) => current.filter((item) => item.id !== (aiData as any)._errorId));
                 }
                 await markTaskComplete('error-revive');
                 await markTaskComplete('stability-round');
               }
               if (practiceQueue.length > 1 && practiceIndex < practiceQueue.length - 1) {
                 const nextIndex = practiceIndex + 1;
                 setPracticeIndex(nextIndex);
                 setCombatAnswer('');
                 await generateCloneQuestion(practiceQueue[nextIndex]);
                 return;
               }
               setCurrentScreen('report');
               setAiMode('idle');
               setAiData(null);
               setCombatAnswer('');
               setPracticeQueue([]);
               setPracticeIndex(0);
            }}
            className="game-btn bg-white text-[#1a1a2e] flex-1 py-4 text-lg"
          >
            {practiceQueue.length > 1 && practiceIndex < practiceQueue.length - 1 ? '进入下一题' : '收下战利品'}
          </button>
        </div>
      </motion.div>
    );
  };

  const renderInteractiveTheater = () => {
    if (theaterMode === 'generating') {
      return (
        <motion.div 
          key="theater-gen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-black text-white p-6"
        >
          <div className="text-center">
            <motion.div 
              animate={{ rotate: 360, scale: [1, 1.2, 1] }} 
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-fuchsia-500 mb-6 flex justify-center"
            >
              <Orbit size={80} strokeWidth={1} />
            </motion.div>
            <h2 className="font-display font-black text-2xl tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-purple-600 mb-4">MÖBIUS ENGINE INITIALIZING</h2>
            <p className="text-gray-400 font-mono text-xs">Generating Seedance 2.0 Dynamic Video Stream...</p>
            <p className="text-gray-500 font-mono text-[10px] mt-2">Compiling cognitive state... [Frustration: {cogState.frustration}, Focus: {cogState.focus}]</p>
            {theaterMeta && (
              <p className="text-gray-500 font-mono text-[10px] mt-2">
                Source: {theaterMeta.source} {theaterMeta.provider ? `// Provider: ${theaterMeta.provider}` : ''}
              </p>
            )}
          </div>
        </motion.div>
      );
    }

    if (!theaterScript) return null;

    const displayVideoUrl = theaterMeta?.activeVideoUrl;
    const hasReadyVideo = Boolean(
      theaterMeta?.source === 'mobius' &&
      displayVideoUrl,
    );
    const isVideoPending = Boolean(
      theaterMeta?.source === 'mobius' &&
      theaterMeta?.videoStatus &&
      ['queued', 'processing'].includes(theaterMeta.videoStatus),
    );
    const isBranchTransitionPending = Boolean(
      theaterMode === 'resolution' &&
      theaterMeta?.source === 'mobius' &&
      theaterMeta?.branchOutcome &&
      isVideoPending,
    );

    return (
      <motion.div 
        key="theater-play"
        initial={{ opacity: 0, scale: 1.1 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 w-full h-full flex flex-col bg-black overflow-hidden font-sans"
      >
        <div className="flex-1 relative overflow-hidden flex flex-col items-center justify-center">
          <div className={`absolute inset-0 z-0 ${hasReadyVideo ? 'bg-black' : 'bg-gradient-to-b from-indigo-900/40 to-black'}`}></div>
          <div className="absolute top-5 left-5 z-40">
            <button
              type="button"
              onClick={() => setCurrentScreen('dashboard')}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/55 px-3 py-2 text-[11px] font-mono text-white backdrop-blur-sm transition hover:border-cyan-300/60 hover:text-cyan-100"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              <span>强制退出 EXIT</span>
            </button>
          </div>
          <div className="absolute top-5 right-5 z-40">
            <button
              type="button"
              onClick={() => { void toggleTheaterCueEnabled(); }}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/55 px-3 py-2 text-[11px] font-mono text-white backdrop-blur-sm transition hover:border-cyan-300/60 hover:text-cyan-100"
            >
              {theaterCueEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              <span>{theaterCueEnabled ? 'Cue Sound On' : 'Cue Sound Off'}</span>
            </button>
          </div>
          
          <div className="relative z-10 w-[95%] h-[90%] border-4 border-white/20 p-2 transform rotate-1">
            <div className="w-full h-full border-4 border-white overflow-hidden relative bg-[#111]">
               {hasReadyVideo && (
                 <>
                   {React.createElement(ReactPlayer as any, {
                     key: displayVideoUrl,
                     url: displayVideoUrl,
                     className: "absolute inset-0",
                     width: "100%",
                     height: "100%",
                     playing: true,
                     muted: true,
                     loop: true,
                     playsinline: true,
                     controls: true,
                     onError: () => {
                       setTheaterMeta((current) => current ? {
                         ...current,
                         videoStatus: 'failed',
                         errorMessage: '视频流化失败，已启动大列表长缓冲池自动回退到极客文本剧场。',
                       } : current);
                     }
                   })}
                   <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent z-10 pointer-events-none"></div>
                 </>
               )}
               <AnimatePresence>
                 {theaterCutFxActive && (
                   <motion.div
                     key="branch-cut-fx"
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     exit={{ opacity: 0 }}
                     transition={{ duration: 0.14 }}
                     className="absolute inset-0 z-30 pointer-events-none overflow-hidden"
                   >
                     <div className="absolute inset-0 bg-white/85 mix-blend-screen" />
                     <div className="absolute inset-0 bg-gradient-to-b from-cyan-300/70 via-fuchsia-500/25 to-transparent" />
                     <motion.div
                       initial={{ x: '-100%' }}
                       animate={{ x: '100%' }}
                       transition={{ duration: 0.24, ease: 'easeInOut' }}
                       className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-cyan-200/90 to-transparent blur-md"
                     />
                     <motion.div
                       initial={{ opacity: 0 }}
                       animate={{ opacity: [0, 1, 0.35] }}
                       transition={{ duration: 0.24 }}
                       className="absolute inset-0"
                       style={{
                         backgroundImage:
                           'repeating-linear-gradient(180deg, rgba(255,255,255,0.18) 0px, rgba(255,255,255,0.18) 2px, transparent 2px, transparent 7px)',
                       }}
                     />
                   </motion.div>
                 )}
               </AnimatePresence>
               
               <motion.div 
                 initial={{ y: 50, opacity: 0 }}
                 animate={{ y: 0, opacity: 1 }}
                 className={`absolute inset-0 ${hasReadyVideo ? 'z-20' : ''} flex items-center justify-center p-8 text-center`}
               >
                 {theaterMode === 'playing' && (
                   <div className="space-y-6">
                     <p className={`font-bold italic text-white drop-shadow-lg leading-relaxed ${hasReadyVideo ? 'text-xl md:text-2xl max-w-md mx-auto bg-black/45 backdrop-blur-sm p-4 rounded-2xl border border-white/15' : 'text-2xl'}`}>
                       "{theaterScript.sceneIntro}"
                     </p>
                     <p className="text-fuchsia-400 font-mono text-sm">[ E.M.A Companion Status: <span className="uppercase">{theaterScript.emotion}</span> ]</p>
                     {theaterMeta && (
                       <div className={`text-[11px] font-mono space-y-1 ${hasReadyVideo ? 'text-gray-200' : 'text-gray-400'}`}>
                         <p>[ Source: {theaterMeta.source.toUpperCase()} ]</p>
                         {theaterMeta.provider && <p>[ Video Provider: {theaterMeta.provider.toUpperCase()} ]</p>}
                         {theaterMeta.providerJobId && <p>[ Provider Job ID: {theaterMeta.providerJobId} ]</p>}
                         {theaterMeta.videoStatus && <p>[ Video Status: {theaterMeta.videoStatus.toUpperCase()} ]</p>}
                         {theaterMeta.contentKnowledgePointTitle && (
                           <p>[ Knowledge Point: {theaterMeta.contentKnowledgePointTitle} {theaterMeta.contentKnowledgePointGrade ? `// ${theaterMeta.contentKnowledgePointGrade}` : ''} ]</p>
                         )}
                        {theaterMeta.relatedQuestionSummary?.length ? (
                          <p>[ Similar Questions: {theaterMeta.relatedQuestionSummary.join(' | ')} ]</p>
                        ) : null}
                        {theaterMeta.knowledgeActionLabel && (
                          <p>[ Knowledge Action: {theaterMeta.knowledgeActionLabel}{theaterMeta.knowledgeActionType ? ` // ${theaterMeta.knowledgeActionType}` : ''} ]</p>
                        )}
                        {theaterMeta.diagnosedMistakeLabels?.length ? (
                          <p>[ Diagnosed Mistakes: {theaterMeta.diagnosedMistakeLabels.join(' | ')} ]</p>
                        ) : null}
                        {theaterMeta.errorMessage && <p>[ Note: {theaterMeta.errorMessage} ]</p>}
                       </div>
                     )}
                     {hasReadyVideo && (
                       <p className="text-xs text-cyan-200 font-mono">
                         视频已就绪，当前为真实播放态。
                       </p>
                     )}
                   </div>
                 )}
                 {theaterMode === 'interaction' && (
                    <div className="space-y-8 bg-black/80 p-8 rounded-3xl border border-fuchsia-500/50 backdrop-blur-sm">
                     <p className="text-2xl font-bold text-fuchsia-400 drop-shadow-[0_0_10px_rgba(232,121,249,0.8)] animate-pulse">
                       AWAITING YOUR OVERRIDE:
                     </p>
                     <p className="text-xl text-white font-medium">"{theaterScript.interactionPrompt}"</p>
                     {theaterMeta?.videoUrl && (
                       <p className="text-xs text-gray-400 font-mono break-all">
                         Preview Asset: {theaterMeta.videoUrl}
                       </p>
                     )}
                     {isVideoPending && (
                       <p className="text-xs text-cyan-300 font-mono">
                         视频仍在生成中，前端正自动轮询最新状态...
                       </p>
                     )}
                     {hasReadyVideo && (
                       <p className="text-xs text-cyan-300 font-mono">
                         视频已切入真实播放，你现在看到的是生成结果上的交互叠层。
                       </p>
                     )}
                     <div className="max-w-md mx-auto rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-4 text-left space-y-3">
                       <p className="text-xs text-cyan-200 font-mono">JUDGE INPUT // STRUCTURED ACTION SUBMISSION</p>
                       <div className="flex items-center justify-between gap-4">
                         <span className="text-sm text-white font-medium">我完成了这个知识动作</span>
                         <button
                           type="button"
                           onClick={() => setTheaterActionCompleted((value) => !value)}
                           className={`game-btn px-4 py-2 text-sm ${theaterActionCompleted ? 'bg-emerald-400 text-[#1a1a2e]' : 'bg-transparent border-2 border-gray-500 text-gray-300'}`}
                         >
                           {theaterActionCompleted ? '已完成' : '未完成'}
                         </button>
                       </div>
                       <div>
                         <p className="text-xs text-gray-300 font-mono mb-2">SELF CHECK</p>
                         <div className="flex flex-wrap gap-2">
                           {[
                             { key: 'aligned', label: '完全对齐' },
                             { key: 'partial', label: '部分命中' },
                             { key: 'guess', label: '更像猜测' },
                           ].map((item) => (
                             <button
                               key={item.key}
                               type="button"
                               onClick={() => setTheaterSelfCheck(item.key as 'aligned' | 'partial' | 'guess')}
                               className={`game-btn px-3 py-2 text-xs ${theaterSelfCheck === item.key ? 'bg-cyan-300 text-[#1a1a2e]' : 'bg-transparent border-2 border-gray-500 text-gray-300'}`}
                             >
                               {item.label}
                             </button>
                           ))}
                         </div>
                       </div>
                       <div>
                         <p className="text-xs text-gray-300 font-mono mb-2">CONFIDENCE</p>
                         <div className="flex flex-wrap gap-2">
                           {[
                             { key: 'low', label: '低' },
                             { key: 'medium', label: '中' },
                             { key: 'high', label: '高' },
                           ].map((item) => (
                             <button
                               key={item.key}
                               type="button"
                               onClick={() => setTheaterConfidence(item.key as InteractionConfidence)}
                               className={`game-btn px-3 py-2 text-xs ${theaterConfidence === item.key ? 'bg-amber-300 text-[#1a1a2e]' : 'bg-transparent border-2 border-gray-500 text-gray-300'}`}
                             >
                               {item.label}
                             </button>
                           ))}
                         </div>
                       </div>
                       <div>
                         <p className="text-xs text-gray-300 font-mono mb-2">ACTION PANEL // {theaterMeta?.knowledgeActionType?.toUpperCase() ?? 'GENERIC'}</p>
                         {(theaterMeta?.knowledgeActionType ?? 'select') === 'select' && (
                           <div className="grid gap-2">
                             {SELECT_ACTION_OPTIONS.map((item) => (
                               <button
                                 key={item.id}
                                 type="button"
                                 onClick={() => setTheaterSelectedOption(item.id)}
                                 className={`game-btn px-3 py-3 text-sm text-left ${
                                   theaterSelectedOption === item.id
                                     ? 'bg-fuchsia-300 text-[#1a1a2e]'
                                     : 'bg-transparent border-2 border-gray-500 text-gray-200'
                                 }`}
                               >
                                 {item.label}
                               </button>
                             ))}
                           </div>
                         )}
                         {theaterMeta?.knowledgeActionType === 'sequence' && (
                           <div className="space-y-2">
                             {theaterSequence.map((step, index) => (
                               <button
                                 key={`${step}-${index}`}
                                 type="button"
                                 onClick={() => rotateSequenceStep(index)}
                                 className="game-btn w-full px-3 py-3 text-sm text-left bg-transparent border-2 border-gray-500 text-gray-200"
                               >
                                 Step {index + 1}: {step}
                               </button>
                             ))}
                             <p className="text-[11px] text-cyan-100 font-mono">点击步骤可与下一步交换顺序，排出你认为正确的动作链。</p>
                           </div>
                         )}
                         {(theaterMeta?.knowledgeActionType === 'draw' || theaterMeta?.knowledgeActionType === 'drag') && (
                           <div className="space-y-2">
                             <div className="grid grid-cols-1 gap-2">
                               {DRAW_ACTION_CHECKPOINTS.map((checkpoint) => (
                                 <button
                                   key={checkpoint}
                                   type="button"
                                   onClick={() => toggleDrawCheckpoint(checkpoint)}
                                   className={`game-btn px-3 py-3 text-sm text-left ${
                                     theaterDrawCheckpoints.includes(checkpoint)
                                       ? 'bg-cyan-300 text-[#1a1a2e]'
                                       : 'bg-transparent border-2 border-gray-500 text-gray-200'
                                   }`}
                                 >
                                   {theaterDrawCheckpoints.includes(checkpoint) ? '[ Locked ]' : '[ Tap ]'} {checkpoint}
                                 </button>
                               ))}
                             </div>
                             <p className="text-[11px] text-cyan-100 font-mono">用“点亮关键节点”的方式模拟描线/拖拽路径。</p>
                           </div>
                         )}
                       </div>
                     </div>

                     <div className="flex flex-col gap-4 pt-4">
                       <button
                         disabled={theaterDecisionPending}
                         onClick={() => { handleTheaterResolution(); }}
                         className="game-btn bg-fuchsia-600 text-white py-4 border-2 border-white shadow-[4px_4px_0_#fff]"
                       >
                         {theaterDecisionPending ? '[ Resolving ]' : '[ Submit Action ] // Judge via Mobius'}
                       </button>
                       <button
                         disabled={theaterDecisionPending}
                         onClick={() => { handleTheaterResolution('failure'); }}
                         className="game-btn bg-transparent border-2 border-gray-600 text-gray-400 py-3"
                       >
                         [ Ignore Rule ] // Fail
                       </button>
                     </div>
                   </div>
                 )}
                 {theaterMode === 'resolution' && (
                   <div className="space-y-6">
                    <p className={`text-3xl font-black italic ${theaterResolution === 'success' ? 'text-[var(--color-accent-green)]' : 'text-[var(--color-accent-pink)]'}`}>
                      {theaterMeta?.resolutionTitle ?? (theaterResolution === 'success' ? 'MISSION ACCOMPLISHED' : 'SYSTEM COLLAPSE')}
                    </p>
                    <p className="text-xl text-white font-bold leading-relaxed">
                      {theaterResolution === 'success' ? theaterScript.successScene : theaterScript.failureScene}
                    </p>
                    {theaterMeta?.source === 'mobius' && theaterMeta?.branchOutcome && (
                      <p className="text-xs text-cyan-300 font-mono">
                        Branch video: {theaterMeta.branchOutcome.toUpperCase()} // {theaterMeta.videoStatus?.toUpperCase() ?? 'UNKNOWN'}
                      </p>
                    )}
                    {isBranchTransitionPending && (
                      <div className="max-w-md mx-auto rounded-2xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-3 text-left">
                        <p className="text-sm font-mono text-cyan-200">
                          正在切入 {theaterMeta?.branchOutcome === 'success' ? 'SUCCESS' : 'FAILURE'} 分支片段...
                        </p>
                        <p className="mt-2 text-xs font-mono text-cyan-100/90">
                          当前继续保持上一段已就绪视频播放，分支素材 ready 后会自动无缝切换。
                        </p>
                      </div>
                    )}
                    {theaterMeta?.source === 'mobius' && theaterMeta?.branchOutcome && theaterMeta?.videoStatus === 'ready' && (
                      <p className="text-xs text-emerald-300 font-mono">
                        {theaterMeta.branchOutcome.toUpperCase()} 分支片段已切入播放。
                      </p>
                    )}
                    {theaterCutFxActive && (
                      <p className="text-xs text-fuchsia-200 font-mono tracking-[0.25em]">
                        WORLDLINE SHIFT DETECTED
                      </p>
                    )}
                    {theaterReadyCueActive && (
                      <motion.p
                        initial={{ opacity: 0.4, scale: 0.96 }}
                        animate={{ opacity: [0.4, 1, 0.65], scale: [0.96, 1.02, 1] }}
                        transition={{ duration: 0.45 }}
                        className="text-xs text-cyan-100 font-mono tracking-[0.22em]"
                      >
                        SYNC CUE // BRANCH LOCK ACQUIRED
                      </motion.p>
                    )}
                    {!theaterCueEnabled && (
                      <p className="text-[11px] text-gray-400 font-mono">
                        Cue sound muted for this theater session.
                      </p>
                    )}
                    {theaterMeta?.coachMessage && (
                      <p className="text-sm text-cyan-200 font-mono max-w-md mx-auto">
                        {theaterMeta.coachMessage}
                       </p>
                     )}
                    {theaterMeta?.adjudicationRationale?.length ? (
                      <div className="max-w-md mx-auto rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-left">
                        <p className="text-xs text-cyan-200 font-mono">ADJUDICATION RATIONALE</p>
                        <div className="mt-2 space-y-1 text-[11px] text-gray-200 font-mono">
                          {theaterMeta.adjudicationRationale.map((item) => (
                            <p key={item}>[{item}]</p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {theaterMeta?.contentKnowledgePointTitle && (
                      <div className="max-w-md mx-auto rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left">
                        <p className="text-xs text-amber-200 font-mono">
                          内容底座已锁定知识点：{theaterMeta.contentKnowledgePointTitle}
                          {theaterMeta.contentKnowledgePointGrade ? ` // ${theaterMeta.contentKnowledgePointGrade}` : ''}
                        </p>
                        {theaterMeta.contentEvidence?.length ? (
                          <div className="mt-2 space-y-1 text-[11px] text-gray-300 font-mono">
                            {theaterMeta.contentEvidence.map((item) => (
                              <p key={item}>[{item}]</p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )}
                     {theaterMeta?.nextActions?.length ? (
                       <div className="text-xs text-gray-300 font-mono max-w-md mx-auto space-y-1">
                         {theaterMeta.nextActions.map((item) => (
                           <p key={item}>[{item}]</p>
                         ))}
                       </div>
                     ) : null}
                     <button onClick={() => setCurrentScreen('dashboard')} className="mt-12 game-btn bg-white text-black py-3 px-8 text-lg hover:bg-gray-200">
                       Exit Simulation
                     </button>
                   </div>
                 )}
               </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };
  const renderReport = () => (
    <motion.div 
      key="report"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 w-full h-full flex flex-col bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] bg-[#1a1a2e] text-white p-6 justify-center items-center overflow-hidden"
    >
      <div className="absolute top-1/4 left-0 w-full h-64 bg-[var(--color-secondary)]/20 blur-[100px] rounded-full"></div>
      
      <div className="w-full max-w-sm mx-auto z-10 flex flex-col h-full overflow-y-auto pb-6">
        <div className="flex-1 flex flex-col justify-center mt-10">
          <h2 className="text-center font-bold text-[var(--color-secondary)] text-xl tracking-widest mb-6">TIME RETURNED</h2>
          
          {/* Viral Poster Element */}
          <div className="bg-gradient-to-b from-[#2a2a4a] to-[#1a1a2e] border-2 border-[var(--color-secondary)] rounded-[32px] p-8 text-center mb-8 relative shadow-[0_0_30px_rgba(255,138,61,0.2)]">
            <div className="absolute -top-4 -right-4 bg-[var(--color-primary)] text-white text-xs font-bold px-3 py-1 rounded-full border-2 border-[#1a1a2e] transform rotate-12">
              超越 95% 同龄人
            </div>
            
            <p className="text-gray-300 font-medium mb-1">今日已收回青春时长</p>
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="font-display font-black text-6xl text-[var(--color-secondary)] flex items-end justify-center mb-6 leading-none"
            >
              +{timeSaved ? timeSaved : 26}<span className="text-2xl ml-1 text-white pb-2">min</span>
            </motion.div>
            
            <div className="bg-black/30 rounded-xl p-4 text-left border border-white/10 mb-4">
               <p className="text-sm text-gray-400 mb-1"><Zap size={14} className="inline mr-1 text-[var(--color-primary)]"/> 击碎无用题海：<span className="text-white float-right">15 题</span></p>
               <p className="text-sm text-gray-400 mb-1"><MapIcon size={14} className="inline mr-1 text-[var(--color-accent-green)]"/> 突破薄弱知识：<span className="text-white float-right">3 个</span></p>
            </div>
            
            <div className="text-xs text-gray-500 mt-2 italic flex justify-center items-center gap-1">
               <Lock size={12} /> Powered by 列子御风 AI
            </div>
          </div>
          
          <div className="text-center mb-auto">
            <p className="text-lg font-bold text-white mb-2 leading-relaxed">
              “今天省下来的时间，<br/>属于你自己。”
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-3">
          <button 
            className="game-btn bg-[var(--color-primary)] text-white w-full py-4 text-xl flex justify-center items-center gap-2 border-2 border-transparent"
          >
            <UploadCloud size={20} /> 生成炫耀海报
          </button>
          
          <button 
            onClick={() => {
              setCurrentScreen('dashboard');
            }}
            className="game-btn bg-white/10 text-white w-full py-4 text-lg border-2 border-transparent flex justify-center items-center gap-2"
          >
             返回营地继续休息
          </button>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="w-full h-screen bg-[#1a1a2e] flex items-center justify-center font-sans">
      {/* Mobile container constraint for web view */}
      <div className="w-full h-full max-w-md mx-auto bg-white overflow-hidden relative shadow-2xl sm:rounded-[40px] sm:h-[90vh] sm:border-[8px] sm:border-[#1a1a2e]">
        <AnimatePresence mode="wait">
          {currentScreen === 'welcome' && renderWelcome()}
          {currentScreen === 'profile-setup' && renderProfileSetup()}
          {currentScreen === 'diagnostic-loading' && renderDiagnosticLoading()}
          {currentScreen === 'target-setter' && renderTargetSetter()}
          {currentScreen === 'dashboard' && <Dashboard 
             studentId={user?.uid || 'demo-student'} 
             onNavigate={(s) => setCurrentScreen(s as ScreenState)} 
             onTriggerUpload={() => fileInputRef.current?.click()}
             onTriggerDehydrate={() => dehydrateInputRef.current?.click()}
          />}
          {currentScreen === 'subject-map' && renderSubjectMap()}
          {currentScreen === 'error-book' && renderErrorBook()}
          {currentScreen === 'overview' && renderOverview()}
          {currentScreen === 'dehydrator' && renderDehydrator()}
          {currentScreen === 'combat' && renderCombat()}
          {currentScreen === 'combat-feedback' && renderCombatFeedback()}
          {currentScreen === 'theater' && renderInteractiveTheater()}
          {currentScreen === 'report' && renderReport()}
        </AnimatePresence>

        {/* E.M.A Companion Sprite Floating Overlay */}
        {['dashboard', 'subject-map'].includes(currentScreen) && (
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1, y: [0, -10, 0] }}
            transition={{ y: { repeat: Infinity, duration: 3, ease: 'easeInOut' } }}
            className="absolute top-20 right-6 z-40 pointer-events-none"
          >
            <div className="relative">
              <div className={`w-12 h-12 rounded-full border-2 border-white shadow-lg flex items-center justify-center ${cogState.frustration > 60 ? 'bg-red-500/80 animate-pulse' : cogState.focus > 70 ? 'bg-blue-500/80' : 'bg-fuchsia-500/80'}`}>
                {cogState.frustration > 60 ? <AlertTriangle size={20} className="text-white" /> : cogState.focus > 70 ? <Zap size={20} className="text-white" /> : <Orbit size={20} className="text-white relative z-10" />}
              </div>
              <div className="absolute top-14 right-0 w-max bg-black/60 backdrop-blur-sm text-[10px] text-white px-2 py-1 rounded-full border border-white/20">
                E.M.A. 陪伴中
              </div>
            </div>
          </motion.div>
        )}
        
        {['dashboard', 'subject-map', 'error-book', 'overview'].includes(currentScreen) && (
          <div className="absolute bottom-0 left-0 right-0 w-full bg-white border-t-4 border-[#1a1a2e] flex justify-around items-center p-3 sm:pb-4 pt-4 z-20 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
            <NavButton onClick={() => setCurrentScreen('dashboard')} icon={<Sword />} label="作战" active={currentScreen === 'dashboard'} />
            <NavButton onClick={() => setCurrentScreen('subject-map')} icon={<MapIcon />} label="学科岛" active={currentScreen === 'subject-map'} />
            <NavButton onClick={() => setCurrentScreen('error-book')} icon={<RefreshCw />} label="错题" active={currentScreen === 'error-book'} />
            <NavButton onClick={() => setCurrentScreen('overview')} icon={<Trophy />} label="总览" active={currentScreen === 'overview'} />
          </div>
        )}
      </div>
    </div>
  );
}

const NavButton = ({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 p-2 transition-colors ${active ? 'text-[var(--color-primary)]' : 'text-gray-400 hover:text-gray-600'}`}>
    {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: active ? 24 : 22, strokeWidth: active ? 3 : 2 }) : icon}
    <span className={`text-[10px] font-bold ${active ? 'opacity-100' : 'opacity-80'}`}>{label}</span>
  </button>
);

const SparkleIcon = (props: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    <path d="M5 3v4M3 5h4M19 3v4M17 5h4M5 17v4M3 19h4M19 17v4M17 19h4"/>
  </svg>
);
