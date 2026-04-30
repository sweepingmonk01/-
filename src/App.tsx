import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sword, Map as MapIcon, ShieldAlert, Zap, Clock, 
  Check, ChevronRight, Play, BookOpen, Star, 
  BrainCircuit, RefreshCw, Trophy, Beaker,
  Target, Cpu, Sliders, Camera, Orbit, AlertTriangle, Volume2, VolumeX, Compass, Navigation
} from 'lucide-react';
import { auth, loginWithGoogle, logoutUser, syncUserProfile, getUserProfile, saveErrorRecord, getActiveErrors, resolveError, updateCognitiveState } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { buildDashboardViewState } from '../shared/dashboard-metrics';
import type { DashboardViewState } from '../shared/dashboard-metrics';
import { buildOverviewViewState } from '../shared/overview-metrics';
import {
  createDefaultCognitiveState,
  normalizeCognitiveState,
  projectDashboardRadarState,
  type CognitiveState,
} from '../shared/cognitive-state';

import type { LinkedKnowledgeGraphError } from './components/error-book/KnowledgeGraphSummary';
import { DRAW_ACTION_CHECKPOINTS, SELECT_ACTION_OPTIONS, SEQUENCE_ACTION_STEPS } from './components/theater/theater-constants';
import type { TheaterMeta } from './components/theater/theater-types';
import type { ExploreEngineKey } from './features/explore/data/exploreTypes';
import type { LightweightMistakeRecord } from './features/explore/utils/aiActiveStateFromExplore';
import {
  getYufengDailyTaskState,
  subscribeYufengDailyTaskUpdated,
  type YufengDailyTaskState,
} from './features/explore/cockpit/yufengDailyTaskState';

type MobiusApi = typeof import('./lib/mobius');

const loadMobiusApi = () => import('./lib/mobius');
const loadExploreRecommendationTools = async () => {
  const [exploreData, recommendExploreNodes] = await Promise.all([
    import('./features/explore/data/exploreData'),
    import('./features/explore/utils/recommendExploreNodes'),
  ]);

  return {
    getEngineByKey: exploreData.getEngineByKey,
    recommendExploreNodesForMistake: recommendExploreNodes.recommendExploreNodesForMistake,
  };
};

const Dashboard = lazy(() => import('./components/Dashboard'));
const CombatFlow = lazy(() => import('./components/combat/CombatFlow'));
const DehydratorFlow = lazy(() => import('./components/dehydrator/DehydratorFlow'));
const InteractiveTheater = lazy(() => import('./components/theater/InteractiveTheater'));
const WelcomeScreen = lazy(() => import('./components/onboarding/OnboardingScreens').then((module) => ({ default: module.WelcomeScreen })));
const ProfileSetupScreen = lazy(() => import('./components/onboarding/OnboardingScreens').then((module) => ({ default: module.ProfileSetupScreen })));
const DiagnosticLoadingScreen = lazy(() => import('./components/onboarding/OnboardingScreens').then((module) => ({ default: module.DiagnosticLoadingScreen })));
const TargetSetterScreen = lazy(() => import('./components/onboarding/OnboardingScreens').then((module) => ({ default: module.TargetSetterScreen })));
const SubjectMapView = lazy(() => import('./components/views/SubjectMapView'));
const ErrorBookView = lazy(() => import('./components/views/ErrorBookView'));
const OverviewView = lazy(() => import('./components/views/OverviewView'));
const ReportView = lazy(() => import('./components/views/ReportView'));
const FoundationScienceView = lazy(() => import('./components/views/FoundationScienceView'));
const ExploreView = lazy(() => import('./features/explore/components/ExploreView'));
const ExploreCockpitView = lazy(() => import('./features/explore/components/ExploreCockpitView'));

type ScreenState = 'welcome' | 'profile-setup' | 'diagnostic-loading' | 'target-setter' | 'dashboard' | 'subject-map' | 'error-book' | 'overview' | 'foundation-science' | 'explore' | 'explore-cockpit' | 'combat' | 'combat-feedback' | 'report' | 'dehydrator' | 'theater';
type AsyncSurfaceState = 'idle' | 'loading' | 'refreshing' | 'ready' | 'error';
interface ExploreRouteState {
  engineKey?: string;
  nodeKey?: string;
}

type AIQuestionData = import('./lib/mobius').AIQuestionData;
type DehydrateResult = import('./lib/mobius').DehydrateResult;
type TheaterScript = import('./lib/mobius').TheaterScript;
type KnowledgeActionType = import('./lib/mobius').KnowledgeActionType;
type InteractionConfidence = import('./lib/mobius').InteractionConfidence;
type MobiusStudentStateSummaryResponse = import('./lib/mobius').MobiusStudentStateSummaryResponse;
type KnowledgeGraphSnapshot = import('./lib/mobius').KnowledgeGraphSnapshot;
type SocraticThread = import('./lib/mobius').SocraticThread;

const WELCOME_OUTCOMES = [
  { label: '今日主线', value: '3 步拿回最值分', accent: 'text-[var(--color-primary)]' },
  { label: '长期模型', value: '持续记住痛点与规则', accent: 'text-[var(--color-secondary)]' },
  { label: '训练方式', value: '先诊断，再脱水，再剧场修复', accent: 'text-[var(--color-accent-green)]' },
];

const WELCOME_SIGNALS = [
  { icon: ShieldAlert, title: '长期学生状态', detail: '把最近裁决、风险型和高频痛点持续沉淀，不再每次从零开始。', tone: 'bg-[rgba(255,138,61,0.14)] text-[var(--color-secondary)]' },
  { icon: Target, title: '今日最短提分路径', detail: '首页任务直接跟着 state-summary 和错题主线走，先干最值的那一题。', tone: 'bg-[rgba(61,123,255,0.14)] text-[var(--color-primary)]' },
  { icon: BookOpen, title: '练习不是堆量', detail: '错题、知识图谱、剧场分支会互相回流，让每次交互都留下可用证据。', tone: 'bg-[rgba(51,209,160,0.14)] text-[var(--color-accent-green)]' },
];

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
  targetErrorId?: string | null;
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

interface FocusRecommendation {
  matchedError?: any;
  subject: SubjectKey;
  node: string;
  painPoint?: string;
  rule?: string;
}

interface ErrorBookFocusContext {
  subject: SubjectKey;
  node: string;
  errorId?: string | null;
  source: 'map' | 'graph' | 'task';
}

type KnowledgeGraphNoticeTone = 'info' | 'success' | 'warning';

interface ErrorExploreRecommendation {
  mistakeTitle: string;
  mistakeDescription: string;
  repairAction: string;
  primaryNode: {
    key: string;
    label: string;
    engineKey: ExploreEngineKey;
    engineTitle: string;
    engineSubtitle: string;
    accentColor: string;
  };
  secondaryNodes: {
    key: string;
    label: string;
    engineTitle: string;
  }[];
}

function getYufengStatusDotClass(status?: string) {
  switch (status) {
    case 'started':
      return 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.72)]';
    case 'evidence-submitted':
    case 'snapshot-ready':
      return 'bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.72)]';
    case 'completed':
      return 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.72)]';
    default:
      return '';
  }
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

const normalizeKnowledgeKey = (value?: string | null) => (
  (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[·•\-—_/\\()（）【】\[\]'"“”‘’,.，。:：;；!?！？]/g, '')
);

const resolveNodeTargetErrorId = (
  subject: SubjectKey,
  nodeName: string,
  errors: any[],
) => {
  const normalizedNodeName = normalizeKnowledgeKey(nodeName);
  if (!normalizedNodeName) return null;

  let bestMatch: { id: string; score: number } | null = null;

  for (const errorItem of errors) {
    if (!errorItem?.id) continue;

    const meta = getErrorMeta(errorItem);
    if (meta.subject !== subject) continue;

    const normalizedMetaNode = normalizeKnowledgeKey(meta.node);
    const normalizedCorpus = normalizeKnowledgeKey(
      [errorItem.painPoint, errorItem.rule, errorItem.questionText]
        .filter(Boolean)
        .join(' '),
    );

    const score =
      normalizedMetaNode === normalizedNodeName
        ? 100
        : normalizedCorpus.includes(normalizedNodeName)
          ? 60
          : 0;

    if (!score) continue;

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { id: errorItem.id, score };
    }
  }

  return bestMatch?.id ?? null;
};

const formatKnowledgeGraphErrorMessage = (error: unknown, hasFallbackGraph: boolean) => {
  const message = error instanceof Error ? error.message : 'Unknown error';

  if (message.includes('403')) {
    return hasFallbackGraph
      ? '图谱刷新失败：当前账号没有读取这份图谱的权限，已先保留上一次结果。'
      : '图谱刷新失败：当前账号没有读取这份图谱的权限。';
  }

  if (message.includes('503')) {
    return hasFallbackGraph
      ? '图谱刷新失败：图谱服务暂时不可用，已先保留上一次结果，可稍后重试。'
      : '图谱刷新失败：图谱服务暂时不可用，可稍后重试。';
  }

  if (message.includes('500')) {
    return hasFallbackGraph
      ? '图谱刷新失败：服务端生成图谱时出错，已先保留上一次结果，可继续重试。'
      : '图谱刷新失败：服务端生成图谱时出错，可继续重试。';
  }

  return hasFallbackGraph
    ? '图谱刷新失败：当前先保留上一次可用结果，你可以继续点击重试。'
    : '图谱刷新失败：当前还没有拿到可用图谱，你可以继续点击重试。';
};

const getErrorRecencyLabel = (index: number) => {
  if (index === 0) return '刚刚录入';
  if (index < 3) return '24h 内高危';
  if (index < 6) return '72h 巩固';
  return '待回访';
};

const clampMapProgress = (value: number, min: number = 24, max: number = 96) => (
  Math.max(min, Math.min(max, Math.round(value)))
);

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const parseExploreRouteFromPath = (): ExploreRouteState | null => {
  if (typeof window === 'undefined') return null;
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts[0] !== 'explore') return null;
  if (parts[1] === 'cockpit') return null;
  return {
    engineKey: parts[1] ? decodeURIComponent(parts[1]) : undefined,
    nodeKey: parts[2] ? decodeURIComponent(parts[2]) : undefined,
  };
};

const parseExploreCockpitPath = () => {
  if (typeof window === 'undefined') return false;
  return window.location.pathname === '/explore/cockpit' || window.location.pathname === '/yufeng';
};

const buildExplorePath = (route: ExploreRouteState) => {
  const parts = ['explore'];
  if (route.engineKey) parts.push(encodeURIComponent(route.engineKey));
  if (route.engineKey && route.nodeKey) parts.push(encodeURIComponent(route.nodeKey));
  return `/${parts.join('/')}`;
};

const mapErrorToAIActiveMistake = (errorItem: any): LightweightMistakeRecord => ({
  id: errorItem?.id,
  mistakeKey: errorItem?.mistakeKey ?? errorItem?.mistakePatternKey,
  painPoint: errorItem?.painPoint,
  rule: errorItem?.rule,
  questionText: errorItem?.questionText,
  node: errorItem?.node ?? errorItem?.knowledgeNode,
  diagnosedMistakes: errorItem?.diagnosedMistakes,
  isResolved: Boolean(errorItem?.isResolved ?? errorItem?.resolvedAt ?? errorItem?.status === 'resolved'),
  createdAt: errorItem?.createdAt,
});

export default function App() {
  const todayKey = getTodayKey();
  const [currentScreen, setCurrentScreen] = useState<ScreenState>(() => {
    if (parseExploreCockpitPath()) return 'explore-cockpit';
    return parseExploreRouteFromPath() ? 'explore' : 'welcome';
  });
  const [exploreRoute, setExploreRoute] = useState<ExploreRouteState>(() => parseExploreRouteFromPath() ?? {});
  const [timeSaved, setTimeSaved] = useState(0);
  const [targetScore, setTargetScore] = useState(115);
  
  // Auth state
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [welcomeError, setWelcomeError] = useState<string | null>(null);

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
          if (profile.cognitiveState) setCogState(normalizeCognitiveState(profile.cognitiveState));
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
        await refreshKnowledgeGraph(u.uid);
      } else {
        setTaskStatus({});
        setTaskStatusDate('');
        setKnowledgeProgressState(null);
        setPracticeQueue([]);
        setPracticeIndex(0);
        setStudentStateSummary(null);
        setStudentStateSummaryStatus('idle');
        setKnowledgeGraph(null);
        setKnowledgeGraphStatus('idle');
        setKnowledgeGraphError(null);
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
  const [cogState, setCogState] = useState<CognitiveState>(() => createDefaultCognitiveState());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dehydrateInputRef = useRef<HTMLInputElement>(null);
  const errorCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
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
  const [studentStateSummaryStatus, setStudentStateSummaryStatus] = useState<AsyncSurfaceState>('idle');
  const [knowledgeGraph, setKnowledgeGraph] = useState<KnowledgeGraphSnapshot | null>(null);
  const [knowledgeGraphStatus, setKnowledgeGraphStatus] = useState<AsyncSurfaceState>('idle');
  const [knowledgeGraphError, setKnowledgeGraphError] = useState<string | null>(null);
  const [knowledgeGraphNotice, setKnowledgeGraphNotice] = useState<{ tone: KnowledgeGraphNoticeTone; message: string } | null>(null);
  const [graphFocusedErrorId, setGraphFocusedErrorId] = useState<string | null>(null);
  const [errorBookFocus, setErrorBookFocus] = useState<ErrorBookFocusContext | null>(null);
  const [errorExploreRecommendations, setErrorExploreRecommendations] = useState<Record<string, ErrorExploreRecommendation | null>>({});
  const [yufengTaskState, setYufengTaskState] = useState<YufengDailyTaskState | null>(() => getYufengDailyTaskState());
  const [foundationFocusKey, setFoundationFocusKey] = useState<string | null>(null);
  const [socraticReplyDraft, setSocraticReplyDraft] = useState('');
  const [socraticReplyPending, setSocraticReplyPending] = useState(false);

  const pushBrowserPath = (path: string) => {
    if (typeof window === 'undefined') return;
    if (window.location.pathname === path) return;
    window.history.pushState(null, '', path);
  };

  const navigateScreen = (screen: ScreenState) => {
    setCurrentScreen(screen);
    if (screen === 'explore') {
      setExploreRoute({});
      pushBrowserPath('/explore');
      return;
    }
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/explore')) {
      pushBrowserPath('/');
    }
  };

  const navigateExplore = (route: ExploreRouteState) => {
    setExploreRoute(route);
    setCurrentScreen('explore');
    pushBrowserPath(buildExplorePath(route));
  };

  const navigateExploreCockpit = () => {
    setExploreRoute({});
    setCurrentScreen('explore-cockpit');
    pushBrowserPath('/explore/cockpit');
  };

  useEffect(() => {
    const handlePopState = () => {
      if (parseExploreCockpitPath()) {
        setExploreRoute({});
        setCurrentScreen('explore-cockpit');
        return;
      }

      const parsedExploreRoute = parseExploreRouteFromPath();
      if (parsedExploreRoute) {
        setExploreRoute(parsedExploreRoute);
        setCurrentScreen('explore');
        return;
      }
      setExploreRoute({});
      setCurrentScreen(user || demoMode ? 'dashboard' : 'welcome');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [demoMode, user]);

  const refreshStudentStateSummary = async (studentId: string) => {
    setStudentStateSummaryStatus(studentStateSummary ? 'refreshing' : 'loading');
    try {
      const { getMobiusStudentStateSummary } = await loadMobiusApi();
      const summary = await getMobiusStudentStateSummary(studentId);
      setStudentStateSummary(summary);
      setStudentStateSummaryStatus('ready');
    } catch (error) {
      setStudentStateSummary(null);
      if ((error as Error).message.includes('404')) {
        setStudentStateSummaryStatus('ready');
        return;
      }
      setStudentStateSummaryStatus('error');
      console.warn('Mobius state summary refresh failed.', error);
    }
  };

  const refreshKnowledgeGraph = async (studentId: string, options?: { manual?: boolean }) => {
    setKnowledgeGraphStatus(knowledgeGraph ? 'refreshing' : 'loading');
    setKnowledgeGraphError(null);
    if (options?.manual) {
      setKnowledgeGraphNotice({
        tone: 'info',
        message: '正在重构知识图谱，节点和连边会在刷新完成后更新。',
      });
    }

    try {
      const { getKnowledgeGraph } = await loadMobiusApi();
      const snapshot = await getKnowledgeGraph(studentId);
      setKnowledgeGraph(snapshot);
      setKnowledgeGraphStatus('ready');
      setKnowledgeGraphError(null);
      setKnowledgeGraphNotice({
        tone: snapshot.nodes.length ? 'success' : 'warning',
        message: snapshot.nodes.length
          ? `图谱已更新：${snapshot.nodes.length} 个节点，${snapshot.edges.length} 条连边。`
          : '图谱已刷新，但当前还没有足够错题沉淀出可用节点。',
      });
    } catch (error) {
      if ((error as Error).message.includes('404')) {
        setKnowledgeGraph(null);
        setKnowledgeGraphStatus('ready');
        setKnowledgeGraphNotice({
          tone: 'warning',
          message: '当前还没有可用图谱，继续沉淀错题后会自动长出节点。',
        });
        return;
      }
      setKnowledgeGraphStatus('error');
      setKnowledgeGraphError(formatKnowledgeGraphErrorMessage(error, Boolean(knowledgeGraph)));
      setKnowledgeGraphNotice({
        tone: 'warning',
        message: '你可以继续点击“刷新图谱”重试，系统会优先保留上一次可用结果。',
      });
      console.warn('Knowledge graph refresh failed.', error);
    }
  };

  useEffect(() => {
    if (!user && demoMode) {
      void refreshStudentStateSummary('demo-student');
      void refreshKnowledgeGraph('demo-student');
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
        const { refreshMobiusMediaJob } = await loadMobiusApi();
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
            lastMediaSyncAt: new Date().toISOString(),
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
    if (currentScreen !== 'error-book' || !graphFocusedErrorId) return;

    const target = errorCardRefs.current[graphFocusedErrorId];
    if (!target) return;

    const timeoutId = window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [currentScreen, errorFilter, graphFocusedErrorId, errorList.length]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('liezi-theater-cue-enabled', String(theaterCueEnabled));
  }, [theaterCueEnabled]);

  useEffect(() => {
    const refreshYufengTaskState = () => {
      setYufengTaskState(getYufengDailyTaskState());
    };

    refreshYufengTaskState();
    const unsubscribe = subscribeYufengDailyTaskUpdated(refreshYufengTaskState);
    window.addEventListener('storage', refreshYufengTaskState);

    return () => {
      unsubscribe();
      window.removeEventListener('storage', refreshYufengTaskState);
    };
  }, []);

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
      void refreshKnowledgeGraph('demo-student');
      return;
    }
    if (!user) return;
    try {
      const errs = await getActiveErrors(user.uid);
      setErrorList(errs);
      await refreshKnowledgeGraph(user.uid);
    } catch (e) {
      console.error(e);
    }
  };

  const enterDemoMode = () => {
    setWelcomeError(null);
    setDemoMode(true);
    setGrade((prev) => prev || '四年级');
    setTargetScore(115);
    setTimeSaved(26);
    setTextbooks({ zh: '部编版(人教)', ma: '人教版', en: '人教PEP' });
    setErrorList(DEMO_ERRORS);
    setTaskStatus({});
    setTaskStatusDate(todayKey);
    setCurrentScreen('dashboard');
    void refreshStudentStateSummary('demo-student');
    void refreshKnowledgeGraph('demo-student');
  };

  const handleEnterCamp = async () => {
    if (authChecking) return;

    setWelcomeError(null);

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
      const message = err instanceof Error ? err.message : '';
      const code = (err as { code?: string } | null)?.code ?? '';
      if (code === 'auth/popup-blocked' || message.includes('popup-blocked')) {
        enterDemoMode();
        return;
      }

      console.error("Login Error:", err);
      setWelcomeError('登录没有完成。可以重试进入营地，或先用 3 分钟 Demo 继续体验。');
    }
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

  useEffect(() => {
    if (currentScreen !== 'error-book') return;
    if (!filteredErrors.length) {
      setErrorExploreRecommendations({});
      return;
    }

    let cancelled = false;

    const loadRecommendations = async () => {
      const {
        getEngineByKey,
        recommendExploreNodesForMistake,
      } = await loadExploreRecommendationTools();
      const nextRecommendations: Record<string, ErrorExploreRecommendation | null> = {};

      filteredErrors.forEach((err, idx) => {
        const cardId = err.id || `error-${idx}`;
        const { subject, node } = getErrorMeta(err);
        const exploreRecommendation = recommendExploreNodesForMistake({
          mistakeKey: err.mistakeKey ?? err.mistakePatternKey,
          mistakeCategory: err.mistakeCategory ?? err.category,
          diagnosedMistakes: err.diagnosedMistakes,
          subject,
          node,
          painPoint: err.painPoint,
          rule: err.rule,
          questionText: err.questionText,
          summary: err.summary,
        });
        const primaryExploreNode = exploreRecommendation.primaryNode;
        const primaryExploreEngine = primaryExploreNode
          ? getEngineByKey(primaryExploreNode.engineKey)
          : undefined;

        nextRecommendations[cardId] =
          exploreRecommendation.mapping && primaryExploreNode && primaryExploreEngine
            ? {
                mistakeTitle: exploreRecommendation.mapping.title,
                mistakeDescription: exploreRecommendation.mapping.description,
                repairAction: exploreRecommendation.mapping.repairAction,
                primaryNode: {
                  key: primaryExploreNode.key,
                  label: primaryExploreNode.label,
                  engineKey: primaryExploreNode.engineKey,
                  engineTitle: primaryExploreEngine.title,
                  engineSubtitle: primaryExploreEngine.subtitle,
                  accentColor: primaryExploreEngine.accentColor,
                },
                secondaryNodes: exploreRecommendation.secondaryNodes.map((secondaryNode) => {
                  const secondaryEngine = getEngineByKey(secondaryNode.engineKey);
                  return {
                    key: secondaryNode.key,
                    label: secondaryNode.label,
                    engineTitle: secondaryEngine?.title ?? secondaryNode.engineKey,
                  };
                }),
              }
            : null;
      });

      if (!cancelled) {
        setErrorExploreRecommendations(nextRecommendations);
      }
    };

    loadRecommendations().catch((error) => {
      console.warn('Explore recommendation loading failed.', error);
      if (!cancelled) {
        setErrorExploreRecommendations({});
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentScreen, errorFilter, errorList]);

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

  const graphLinkedErrors: LinkedKnowledgeGraphError[] = errorList.map((errorItem, index) => {
    const meta = getErrorMeta(errorItem);
    return {
      id: errorItem.id,
      title: errorItem.painPoint || errorItem.rule || meta.node,
      detail: errorItem.rule || errorItem.questionText || '等待补充错题上下文。',
      subject: meta.subject,
      subjectLabel: SUBJECT_META[meta.subject].short,
      node: meta.node,
      statusLabel: getErrorRecencyLabel(index),
    };
  });

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

  const focusRecommendation: FocusRecommendation = (() => {
    const recommendedDefaults = studentStateSummary?.recommendedSessionDefaults;
    const recommendedText = [recommendedDefaults?.painPoint, recommendedDefaults?.rule]
      .filter(Boolean)
      .join(' ')
      .trim();

    if (recommendedText) {
      const matchedError = errorList.find((errorItem) => {
        const candidates = [errorItem.painPoint, errorItem.rule, errorItem.questionText]
          .filter(Boolean)
          .map((item: string) => item.toLowerCase());
        const fragments = [recommendedDefaults?.painPoint, recommendedDefaults?.rule]
          .filter(Boolean)
          .map((item) => item!.toLowerCase());
        return fragments.some((fragment) => candidates.some((candidate) => candidate.includes(fragment) || fragment.includes(candidate)));
      });
      const subject = inferSubjectFromText(recommendedText);
      return {
        matchedError,
        subject,
        node: inferKnowledgeNode(recommendedText, subject),
        painPoint: recommendedDefaults?.painPoint,
        rule: recommendedDefaults?.rule,
      };
    }

    if (stateDrivenError) {
      const meta = getErrorMeta(stateDrivenError);
      return {
        matchedError: stateDrivenError,
        subject: meta.subject,
        node: meta.node,
        painPoint: stateDrivenError.painPoint,
        rule: stateDrivenError.rule,
      };
    }

    const graphNode = [...(knowledgeGraph?.nodes ?? [])]
      .sort((left, right) => right.weight - left.weight)[0];
    if (graphNode) {
      const subject = inferSubjectFromText(graphNode.label);
      return {
        subject,
        node: graphNode.label,
        painPoint: graphNode.label,
      };
    }

    return {
      subject: (studentStateSummary?.recommendedSessionDefaults?.knowledgeActionType === 'sequence' ? 'en' : 'ma') as SubjectKey,
      node: '',
    };
  })();

  const preferredFocus = {
    subject: focusRecommendation.subject,
    node: focusRecommendation.node,
  };
  const recommendedErrorId = focusRecommendation.matchedError?.id;

  const todayPlan: TaskCardData[] = (() => {
    const plan: TaskCardData[] = [];
    const expectedMinutes = Math.max(15, Math.ceil((targetScore - 85) * 1.5));
    const topError = focusRecommendation.matchedError;
    const topSignal = focusRecommendation.rule || focusRecommendation.painPoint;
    const lastOutcome = studentStateSummary?.interactionStats.lastOutcome;
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

    const recentPainPoints = studentStateSummary?.recentPainPoints ?? [];
    const activeRules = studentStateSummary?.activeRules ?? [];

    const graphDrivenBySubject = (['zh', 'ma', 'en'] as SubjectKey[]).reduce((acc, subject) => {
      const subjectNodes = (knowledgeGraph?.nodes ?? [])
        .filter((node) => inferSubjectFromText(node.label) === subject)
        .sort((left, right) => right.weight - left.weight || right.lastSeenAt.localeCompare(left.lastSeenAt))
        .slice(0, 6)
        .map((node) => {
          const appearsInPainPoint = recentPainPoints.some((item) => item.includes(node.label) || node.label.includes(item));
          const appearsInRule = activeRules.some((item) => item.includes(node.label) || node.label.includes(item));
          const riskPressure = (node.weight - 1) * 14 + (appearsInPainPoint ? 12 : 0) + (appearsInRule ? 8 : 0);
          return {
            name: node.label,
            progress: clampMapProgress(84 - riskPressure, 28, 82),
            state: 'learning' as const,
            targetErrorId: resolveNodeTargetErrorId(subject, node.label, errorList),
          };
        });

      acc[subject] = subjectNodes;
      return acc;
    }, { zh: [] as KnowledgeNode[], ma: [] as KnowledgeNode[], en: [] as KnowledgeNode[] });

    return (['zh', 'ma', 'en'] as SubjectKey[]).reduce((acc, subject) => {
      const merged = new Map<string, KnowledgeNode>();

      for (const node of graphDrivenBySubject[subject]) {
        merged.set(node.name, node);
      }

      for (const node of fallback[subject].nodes) {
        if (merged.has(node.name)) continue;
        merged.set(node.name, {
          name: node.name,
          progress: node.progress,
          state: node.progress >= 80 ? 'mastered' : node.progress >= 45 ? 'learning' : 'locked',
          targetErrorId: resolveNodeTargetErrorId(subject, node.name, errorList),
        });
      }

      const prioritizedNodes = Array.from(merged.values()).sort((left, right) => {
        if (left.name === preferredFocus.node) return -1;
        if (right.name === preferredFocus.node) return 1;
        if (left.state !== right.state) {
          const statePriority = { learning: 0, mastered: 1, locked: 2 };
          return statePriority[left.state] - statePriority[right.state];
        }
        return left.progress - right.progress;
      });

      acc[subject] = prioritizedNodes.slice(0, 6);
      return acc;
    }, {} as Record<SubjectKey, KnowledgeNode[]>);
  })();

  const allKnowledgeNodes = (['zh', 'ma', 'en'] as SubjectKey[]).flatMap((subject) => knowledgeMap[subject]);
  const masteredNodes = allKnowledgeNodes.filter((node) => node.state === 'mastered').length;
  const learningNodes = allKnowledgeNodes.filter((node) => node.state === 'learning').length;
  const successCount = studentStateSummary?.interactionStats.successCount ?? 0;
  const failureCount = studentStateSummary?.interactionStats.failureCount ?? 0;
  const currentCognitiveState = normalizeCognitiveState(studentStateSummary?.currentCognitiveState ?? cogState);
  const currentCognitiveProjection = projectDashboardRadarState(currentCognitiveState);
  const uniquePainPoints = Array.from(
    new Set([
      ...(studentStateSummary?.recentPainPoints ?? []),
      ...errorList.map((item) => item.painPoint).filter(Boolean),
    ]),
  ).slice(0, 3);
  const dashboardLoading = (studentStateSummaryStatus === 'loading' || knowledgeGraphStatus === 'loading')
    && !studentStateSummary
    && !knowledgeGraph;

  const dashboardState: DashboardViewState = (() => {
    return buildDashboardViewState({
      targetScore,
      timeSavedMinutes: timeSaved,
      successCount,
      failureCount,
      activeIssuesCount: errorStats.total,
      painPoints: uniquePainPoints,
      cognitiveState: currentCognitiveState,
    });
  })();

  const overviewState = (() => {
    return buildOverviewViewState({
      timeSavedMinutes: timeSaved,
      masteredNodes,
      learningNodes,
      successCount,
      failureCount,
      activeIssueCount: errorStats.total,
      cognitiveState: currentCognitiveState,
      currentFocus: focusRecommendation.rule || focusRecommendation.painPoint || preferredFocus.node,
      activeSignals: [
        ...(studentStateSummary?.recentPainPoints ?? []),
        ...(studentStateSummary?.activeRules ?? []),
      ],
    });
  })();

  const openErrorBookFocus = ({
    subject,
    node,
    errorId,
    source,
  }: ErrorBookFocusContext) => {
    setMapSubject(subject);
    setErrorFilter(subject);
    setGraphFocusedErrorId(errorId ?? null);
    setErrorBookFocus({
      subject,
      node,
      errorId: errorId ?? null,
      source,
    });
    setCurrentScreen('error-book');
  };

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

    if (task.focusSubject && task.focusNode) {
      openErrorBookFocus({
        subject: task.focusSubject,
        node: task.focusNode,
        errorId: resolveNodeTargetErrorId(task.focusSubject, task.focusNode, errorList),
        source: 'task',
      });
      return;
    }

    setErrorBookFocus(null);
    setGraphFocusedErrorId(null);
    setErrorFilter(task.focusSubject ?? 'all');
    if (task.focusSubject) {
      setMapSubject(task.focusSubject);
    }
    setCurrentScreen('error-book');
  };

  const handleMapNodePress = (subject: SubjectKey, nodeName: string, targetErrorId?: string | null) => {
    markTaskComplete('knowledge-map').catch((error) => console.error(error));
    openErrorBookFocus({
      subject,
      node: nodeName,
      errorId: targetErrorId ?? null,
      source: 'map',
    });
  };

  const handleGraphErrorFocus = (errorId: string) => {
    const matchedError = errorList.find((errorItem) => errorItem.id === errorId);
    if (!matchedError) return;

    const meta = getErrorMeta(matchedError);
    openErrorBookFocus({
      subject: meta.subject,
      node: meta.node,
      errorId,
      source: 'graph',
    });
  };

  const handleSocraticReply = async () => {
    const threadId = theaterMeta?.diagnosticThread?.id;
    if (!threadId || !socraticReplyDraft.trim() || socraticReplyPending) return;

    try {
      setSocraticReplyPending(true);
      const { replySocraticThread } = await loadMobiusApi();
      const thread = await replySocraticThread(threadId, { content: socraticReplyDraft.trim() });
      setTheaterMeta((current) => current ? { ...current, diagnosticThread: thread } : current);
      setSocraticReplyDraft('');
    } catch (error) {
      console.error('Socratic reply failed.', error);
    } finally {
      setSocraticReplyPending(false);
    }
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
        const { analyzeQuestionImage } = await loadMobiusApi();
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
      const { generateCloneQuestion: generateCloneQuestionViaApi } = await loadMobiusApi();
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
    const { generateTheaterScript: generateTheaterScriptViaApi } = await loadMobiusApi();
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
    setSocraticReplyDraft('');
    setTheaterDecisionPending(false);
    setTheaterActionCompleted(true);
    setTheaterSelfCheck('aligned');
    setTheaterConfidence('medium');
    setTheaterSelectedOption('rule-first');
    setTheaterSequence(SEQUENCE_ACTION_STEPS);
    setTheaterDrawCheckpoints([]);

    try {
      const errorMeta = getErrorMeta(errorItem);
      const {
        createMobiusSession,
        getMobiusStudentStateSummary,
        resolveMobiusContent,
      } = await loadMobiusApi();
      let contentResolution: Awaited<ReturnType<MobiusApi['resolveMobiusContent']>> | null = null;

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
      const primaryFoundationNode = contentResolution?.recommendedFoundationNodes?.[0];
      const relatedQuestionSummary = contentResolution?.relatedQuestions.slice(0, 2).map(({ question }) =>
        `${question.year} ${question.region} ${question.questionType}`,
      );
      const studentId = user?.uid || 'demo-student';
      let stateSummary: Awaited<ReturnType<MobiusApi['getMobiusStudentStateSummary']>> | null = null;

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
        previousState: normalizeCognitiveState(
          stateSummary?.currentCognitiveState
          ?? sessionDefaults?.previousState
          ?? cogState,
        ),
        learningSignals: {
          attempts: 1,
          correctStreak: 0,
          wrongStreak: stateSummary?.interactionStats.lastOutcome === 'failure' ? 2 : 1,
          timeSavedMinutes: timeSaved,
        },
      });

      setCogState(normalizeCognitiveState(mobiusSession.cognitiveState));

      if (user) {
        await updateCognitiveState(user.uid, mobiusSession.cognitiveState);
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
        foundationNodeKey: primaryFoundationNode?.node.key,
        foundationNodeLabel: primaryFoundationNode?.node.label,
        foundationNodeReason: primaryFoundationNode?.reasons[0],
        relatedQuestionSummary,
        diagnosedMistakeLabels: mobiusSession.errorProfile.diagnosedMistakes.map((item) => item.label),
        knowledgeActionLabel: mobiusSession.errorProfile.knowledgeAction.label,
        knowledgeActionType: mobiusSession.errorProfile.knowledgeAction.actionType,
        knowledgeActionId: mobiusSession.errorProfile.knowledgeAction.id,
        strategyDecision: mobiusSession.strategyDecision ?? mobiusSession.story.strategyDecision,
        lastMediaSyncAt: new Date().toISOString(),
      });
      setTheaterMode('playing');
      scheduleTheaterInteraction();
    } catch (mobiusError) {
      console.warn('Mobius orchestration failed, falling back to DeepSeek.', mobiusError);

      try {
        const script = await generateFallbackTheaterScript(errorItem);
        setTheaterScript(script);
        setTheaterMeta({
          source: 'deepseek',
          provider: 'fallback',
          videoStatus: 'failed',
          errorMessage: 'Mobius unavailable, using DeepSeek local fallback.',
          lastMediaSyncAt: new Date().toISOString(),
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
        const { resolveMobiusInteraction } = await loadMobiusApi();
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
          strategyDecision: resolution.strategyDecision,
          adjudicationRationale: resolution.adjudication?.rationale,
          diagnosticThread: resolution.diagnosticThread ?? current.diagnosticThread,
          errorMessage: undefined,
          lastMediaSyncAt: new Date().toISOString(),
        } : current);
        setTheaterMode('resolution');
        void refreshStudentStateSummary(user?.uid || 'demo-student');
        void refreshKnowledgeGraph(user?.uid || 'demo-student');
      } catch (error) {
        console.warn('Mobius interaction resolve failed, falling back to local resolution.', error);
        setTheaterMeta((current) => current ? {
          ...current,
          errorMessage: '交互裁决请求失败，已回退到本地分支结果。',
          lastMediaSyncAt: new Date().toISOString(),
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
        const { dehydrateHomework: dehydrateHomeworkViaApi } = await loadMobiusApi();
        const data = await dehydrateHomeworkViaApi({
          imageBase64: base64String,
          mimeType,
          targetScore,
          studentId: user?.uid || (demoMode ? 'demo-student' : undefined),
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
      className="absolute inset-0 w-full h-full overflow-y-auto welcome-aurora"
    >
      <div className="pointer-events-none absolute left-6 top-10 text-[var(--color-primary)]/20 sm:left-12">
        <Zap size={84} />
      </div>
      <div className="pointer-events-none absolute bottom-24 right-6 text-[var(--color-secondary)]/20 sm:right-12">
        <SparkleIcon size={104} />
      </div>
      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-6xl flex-col justify-center px-4 py-6 sm:px-8 sm:py-8">
        <div className="desktop-shell-shadow overflow-hidden rounded-[36px] border border-white/80 bg-white/86 backdrop-blur-xl sm:rounded-[44px]">
          <div className="grid min-h-[calc(100vh-3rem)] grid-cols-1 sm:min-h-0 lg:grid-cols-[minmax(0,1.06fr)_minmax(360px,0.94fr)]">
            <div className="relative flex flex-col justify-between px-6 pb-8 pt-8 sm:px-10 sm:pb-10 sm:pt-10 lg:px-12 lg:py-12">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_16%_12%,rgba(61,123,255,0.14),transparent_42%),radial-gradient(circle_at_70%_10%,rgba(255,213,74,0.12),transparent_26%)]" />
              <div className="relative">
                <div className="wind-pill">
                  <BrainCircuit size={16} />
                  御风冒险已接入长期学习状态
                </div>
                <div className="mt-6 flex items-center gap-4">
                  <motion.div 
                    animate={{ rotate: [0, -5, 4, 0], y: [0, -4, 0] }}
                    transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                    className="wind-sparkle-ring flex h-20 w-20 items-center justify-center rounded-[28px] border-4 border-[#1a1a2e] bg-white shadow-[0_18px_28px_rgba(61,123,255,0.16)] sm:h-24 sm:w-24"
                  >
                    <img src="https://api.dicebear.com/7.x/bottts/svg?seed=liezi-yufeng" alt="列子御风 AI 伙伴" className="h-14 w-14 sm:h-16 sm:w-16" />
                  </motion.div>
                  <div className="text-left">
                    <p className="text-sm font-black uppercase tracking-[0.24em] text-gray-400">Liezi Yufeng</p>
                    <p className="text-base font-bold text-[#1a1a2e] sm:text-lg">把刷题改造成有奖励的闯关旅程</p>
                  </div>
                </div>

                <h1 className="mt-8 max-w-2xl text-left text-4xl font-display font-bold leading-[1.03] text-[#1a1a2e] sm:text-5xl lg:text-6xl">
                  让今天的提分主线
                  <br />
                  <span className="text-[var(--color-primary)]">像玩冒险游戏一样推进。</span>
                </h1>

                <p className="mt-5 max-w-2xl text-left text-base font-medium leading-7 text-gray-600 sm:text-lg">
                  列子御风会先判断你最近最容易失手的规则和痛点，再把首页任务、知识地图、错题修复和剧场演练都串成同一条主线，减少分心，放大奖励感。
                </p>

                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  {WELCOME_OUTCOMES.map((item, index) => (
                    <div key={item.label} className="wind-quest-card px-4 py-4 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">{item.label}</p>
                        <span className="wind-mini-badge bg-[var(--color-accent-yellow)]/30 text-[#7a4b00]">Lv.{index + 1}</span>
                      </div>
                      <p className={`mt-3 text-base font-black leading-6 ${item.accent}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative mt-10 flex w-full flex-col gap-4 sm:max-w-xl">
                <button 
                  onClick={handleEnterCamp}
                  disabled={authChecking}
                  className="game-btn flex w-full items-center justify-center gap-2 bg-[linear-gradient(180deg,#4d8dff_0%,#2b5bde_100%)] py-4 text-lg text-white sm:text-xl"
                >
                  <Play fill="currentColor" size={24} /> {authChecking ? '连接风场中...' : '进入御风营地'}
                </button>

                {welcomeError ? (
                  <div className="rounded-2xl border border-[var(--color-secondary)]/20 bg-[rgba(255,138,61,0.12)] px-4 py-3 text-sm font-bold leading-6 text-[#7a3d00]">
                    {welcomeError}
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    onClick={() => setCurrentScreen('overview')}
                    className="game-btn flex items-center justify-center gap-2 border border-white/40 bg-white/92 px-5 py-3 font-bold text-gray-700 shadow-[0_10px_22px_rgba(39,67,145,0.08)]"
                  >
                    <Clock size={18} /> 先看看战利品
                  </button>
                  <button
                    onClick={enterDemoMode}
                    className="game-btn flex items-center justify-center gap-2 bg-[linear-gradient(180deg,#ffd86c_0%,#ffb52f_100%)] px-5 py-3 font-bold text-[#6a4200] shadow-[0_12px_20px_rgba(255,181,47,0.18)]"
                  >
                    <Zap size={18} /> 试玩 3 分钟 Demo
                  </button>
                </div>
              </div>
            </div>

            <div className="relative border-t border-[#1a1a2e]/8 bg-[linear-gradient(180deg,#21315f_0%,#293b7d_52%,#3d2e72_100%)] px-5 py-6 text-white sm:px-8 sm:py-8 lg:border-l lg:border-t-0">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,138,61,0.18),transparent_30%)]" />
              <div className="relative flex h-full flex-col">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200/70">World Preview</p>
                    <h2 className="mt-2 text-2xl font-black text-white">今天的冒险地图会怎么生成</h2>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-cyan-100">
                    主线已锁定
                  </div>
                </div>

                <div className="space-y-3">
                  {WELCOME_SIGNALS.map(({ icon: Icon, title, detail, tone }) => (
                    <div key={title} className="rounded-[26px] border border-white/10 bg-white/8 p-4 backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}>
                          <Icon size={20} />
                        </div>
                        <div>
                          <p className="text-base font-black text-white">{title}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-300">{detail}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-[30px] border border-white/12 bg-black/18 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200/70">今日首个关卡</p>
                      <h3 className="mt-2 text-xl font-black">数学 · 几何辅助线</h3>
                    </div>
                    <div className="rounded-full bg-[var(--color-secondary)] px-3 py-1 text-xs font-black text-[#1a1a2e]">
                      Boss 点位
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">最近失手</p>
                      <p className="mt-2 text-base font-bold text-white">几何中点辅助线选择失误</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">推荐路线</p>
                      <p className="mt-2 text-base font-bold text-white">先错题修复，再进剧场挑战</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--color-secondary)]/20 bg-[var(--color-secondary)]/12 p-4">
                    <Target size={18} className="text-[var(--color-secondary)]" />
                    <p className="text-sm font-bold leading-6 text-orange-50">
                      不是多做题，而是先打掉今天最会掉血的那一个点。
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs font-bold text-cyan-100">
                    <Star size={14} className="text-[var(--color-accent-yellow)]" />
                    完成主线后会同步点亮知识地图、错题图鉴和战报结算。
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderProfileSetup = () => (
    <motion.div 
      key="profile-setup"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="wind-page absolute inset-0 z-10 flex h-full w-full min-h-0 flex-col p-5 sm:p-6"
    >
      <div className="wind-panel mt-2 flex flex-1 min-h-0 flex-col px-5 pb-5 pt-6 sm:px-6 sm:pt-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="wind-pill">
              <MapIcon size={16} />
              第 1 步 / 建立冒险档案
            </div>
            <h2 className="mt-4 text-3xl font-display font-bold text-[#1a1a2e]">先告诉我，你现在在哪一张地图</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-gray-500">
              我会根据年级与教材版本，给你匹配对应的闯关路线、知识节点和剧场脚本，不会动你的核心学习模块。
            </p>
          </div>
          <div className="hidden rounded-[24px] bg-[linear-gradient(180deg,rgba(61,123,255,0.14),rgba(255,213,74,0.16))] p-3 text-[var(--color-primary)] sm:block">
            <SparkleIcon className="h-8 w-8" />
          </div>
        </div>
        
        <div className="mt-6 flex-1 min-h-0 space-y-6 overflow-y-auto pb-4 touch-pan-y">
          <div className="game-card p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-lg font-black text-[#1a1a2e]">选择当前年级</h3>
              <span className="wind-mini-badge bg-[var(--color-primary)]/12 text-[var(--color-primary)]">角色等级</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级'].map(g => (
                <button 
                  key={g}
                  onClick={() => setGrade(g)}
                  className={`rounded-2xl border px-3 py-3 text-sm font-black transition-all ${
                    grade === g 
                      ? 'border-[var(--color-primary)] bg-[linear-gradient(180deg,rgba(61,123,255,0.16),rgba(61,123,255,0.08))] text-[var(--color-primary)] shadow-[0_12px_20px_rgba(61,123,255,0.12)]' 
                      : 'border-[#dce6ff] bg-white text-gray-500 hover:border-[#bdd2ff]'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="game-card p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-lg font-black text-[#1a1a2e]">选择三科教材</h3>
              <span className="wind-mini-badge bg-[var(--color-secondary)]/12 text-[var(--color-secondary)]">世界规则</span>
            </div>
            <div className="space-y-3">
              {[{id: 'zh', name: '丹青语文', color: 'var(--color-subj-zh)', opts: ['部编版(人教)', '苏教版', '语文版']}, 
                {id: 'ma', name: '极光数学', color: 'var(--color-subj-ma)', opts: ['人教版', '北师大版', '苏教版']}, 
                {id: 'en', name: '阳光英语', color: 'var(--color-subj-en)', opts: ['人教PEP', '外研社', '牛津版']}].map(subj => (
                <div key={subj.id} className="wind-quest-card flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: subj.color }} />
                    <div>
                      <p className="font-black text-[#1a1a2e]">{subj.name}</p>
                      <p className="text-xs font-bold text-gray-400">决定对应题库与地图节点</p>
                    </div>
                  </div>
                  <select 
                    className="wind-select max-w-[150px] text-sm"
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
          className="game-btn mt-4 flex w-full items-center justify-center gap-2 bg-[linear-gradient(180deg,#4d8dff_0%,#2b5bde_100%)] py-4 text-xl text-white"
        >
          <MapIcon size={24} /> 启动第一次巡航诊断
        </button>
      </div>
    </motion.div>
  );

  const renderDiagnosticLoading = () => (
    <motion.div 
      key="diag"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#2a4cc6_0%,#355ce2_42%,#5d79ea_100%)] px-6 text-white"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.22),transparent_22%),radial-gradient(circle_at_78%_14%,rgba(255,213,74,0.16),transparent_20%),radial-gradient(circle_at_50%_80%,rgba(255,255,255,0.14),transparent_26%)]" />
      <div className="relative z-10 mb-4 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-100">
        风场校准中
      </div>
      <motion.div
        animate={{ rotate: 360, scale: [1, 1.1, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="relative z-10"
      >
        <BrainCircuit size={64} />
      </motion.div>
      <h2 className="relative z-10 mt-6 text-center text-3xl font-display font-bold tracking-wider">正在为你拼接今天的主线地图</h2>
      
      <div className="relative z-10 mt-8 w-72 space-y-3 rounded-[28px] border border-white/12 bg-white/10 p-5 backdrop-blur-sm">
        {[
          { text: "扫描你当前学段的核心关卡...", delay: 0 },
          { text: "比对近 3 年高频考点的掉分点...", delay: 0.8 },
          { text: "生成最短提分与修复路线...", delay: 1.6 }
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: item.delay }}
            className="flex items-center gap-2 text-sm font-bold opacity-90"
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
        className="wind-page absolute inset-0 z-10 flex h-full w-full min-h-0 flex-col p-5 sm:p-6"
      >
        <div className="wind-panel mt-2 flex flex-1 min-h-0 flex-col px-5 pb-5 pt-6 sm:px-6 sm:pt-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="wind-pill">
                <Sliders size={16} />
                第 2 步 / 设定今天终点
              </div>
              <h2 className="mt-4 text-3xl font-display font-bold text-[#1a1a2e]">告诉我你今天想打到哪一关</h2>
              <p className="mt-2 text-sm font-bold text-gray-500">
                AI 会把目标分拆成可以一步步完成的小任务，不删核心模块，只调整出击顺序和奖励节奏。
              </p>
            </div>
            <div className="hidden rounded-[24px] bg-[linear-gradient(180deg,rgba(255,138,61,0.16),rgba(255,213,74,0.2))] p-3 text-[var(--color-secondary)] sm:block">
              <Trophy size={28} />
            </div>
          </div>

          <div className="mt-6 wind-quest-card px-5 py-5">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-gray-400">今日目标分</p>
                <p className="mt-2 text-sm font-bold text-gray-500">向右拖动，决定今天的挑战终点。</p>
              </div>
              <span className="text-5xl font-display font-bold tracking-tight text-[var(--color-primary)]">
                {targetScore}<span className="ml-1 text-lg text-gray-400">/150</span>
              </span>
            </div>
            
            <input 
              type="range" 
              min={85} 
              max={145} 
              value={targetScore} 
              onChange={(e) => setTargetScore(Number(e.target.value))}
              className="wind-slider h-4 w-full cursor-pointer appearance-none rounded-full bg-[#dbe8ff] outline-none"
              style={{ backgroundImage: `linear-gradient(to right, var(--color-primary) ${(targetScore - 85) / 60 * 100}%, #dbe8ff 0)` }}
            />
            
            <div className="mt-3 flex justify-between text-xs font-black text-gray-400">
              <span>85 当前基线</span>
              <span>145 冲刺上限</span>
            </div>
          </div>

          <div className="mt-5 mb-auto grid grid-cols-2 gap-3">
            <div className="game-card bg-[linear-gradient(180deg,#22305b_0%,#283b75_100%)] p-4 text-white border-0">
              <div className="mb-3 flex items-center gap-2 text-cyan-100">
                <SparkleIcon className="h-5 w-5" />
                <p className="text-sm font-black">路径重组</p>
              </div>
              <p className="text-sm font-bold text-slate-300">净提分需求</p>
              <p className="mt-2 text-3xl font-black text-white">+{ptsNeeded}</p>
              <p className="mt-2 text-xs font-bold text-slate-400">分数越高，主线越需要聚焦高价值节点。</p>
            </div>

            <div className="game-card bg-[linear-gradient(180deg,#fff6ea_0%,#fffef9_100%)] p-4">
              <div className="mb-2 flex items-center gap-2 text-[var(--color-secondary)]">
                <Star size={18} />
                <p className="text-sm font-black">关卡数量</p>
              </div>
              <motion.p 
                key={tasksNeeded} 
                initial={{ scale: 1.15 }}
                animate={{ scale: 1 }}
                className="text-3xl font-black text-[var(--color-secondary)]"
              >
                {tasksNeeded} 个
              </motion.p>
              <p className="mt-2 text-xs font-bold text-gray-500">这是今晚需要真正打透的高频考点数。</p>
            </div>

            <div className="game-card bg-[linear-gradient(180deg,#ebfff7_0%,#fafffd_100%)] p-4">
              <div className="mb-2 flex items-center gap-2 text-[var(--color-accent-green)]">
                <Clock size={18} />
                <p className="text-sm font-black">预计耗时</p>
              </div>
              <motion.p 
                key={timeNeeded} 
                initial={{ scale: 1.15 }}
                animate={{ scale: 1 }}
                className="text-3xl font-black text-[var(--color-accent-green)]"
              >
                {timeNeeded} 分钟
              </motion.p>
              <p className="mt-2 text-xs font-bold text-gray-500">把时间留给真正能涨分的主线关卡。</p>
            </div>

            <div className="game-card bg-[linear-gradient(180deg,#f7f3ff_0%,#fff9ff_100%)] p-4">
              <div className="mb-2 flex items-center gap-2 text-[var(--color-accent-pink)]">
                <Cpu size={18} />
                <p className="text-sm font-black">路线命中率</p>
              </div>
              <p className="text-3xl font-black text-[var(--color-accent-pink)]">96.8%</p>
              <p className="mt-2 text-xs font-bold text-gray-500">会优先安排最稳、最短、最容易获得正反馈的任务。</p>
            </div>
          </div>

          <button 
            onClick={async () => {
               await saveProfileData({ targetScore });
               setCurrentScreen('dashboard');
            }}
            className="game-btn mt-6 flex w-full items-center justify-center gap-2 bg-[linear-gradient(180deg,#4d8dff_0%,#2b5bde_100%)] py-4 text-xl text-white"
          >
            <MapIcon fill="currentColor" size={24} /> 生成今日主线地图
          </button>
        </div>
      </motion.div>
    );
  };

  const renderSubjectMap = () => {
    const activeMeta = SUBJECT_META[mapSubject];
    const activeNodes = knowledgeMap[mapSubject];
    const learningCount = activeNodes.filter((node) => node.state === 'learning').length;
    const masteredCount = activeNodes.filter((node) => node.state === 'mastered').length;
    const activeTextbook = textbooks[mapSubject as keyof typeof textbooks];
    const overallProgress = Math.round(activeNodes.reduce((sum, node) => sum + node.progress, 0) / Math.max(activeNodes.length, 1));
    const recommendedNodeActive = mapSubject === preferredFocus.subject ? preferredFocus.node : '';

    return (
      <Suspense
        fallback={renderFeatureLoading('知识地图装配中', '正在挂载学科节点、推荐主线和地图交互...')}
      >
        <SubjectMapView
          mapSubject={mapSubject}
          activeMeta={activeMeta}
          activeTextbook={activeTextbook}
          overallProgress={overallProgress}
          subjectTabs={(['zh', 'ma', 'en'] as SubjectKey[]).map((subject) => ({
            key: subject,
            label: SUBJECT_META[subject].name,
          }))}
          recommendedNodeActive={recommendedNodeActive}
          lastOutcome={studentStateSummary?.interactionStats?.lastOutcome}
          masteredCount={masteredCount}
          learningCount={learningCount}
          inactiveCount={activeNodes.length - learningCount - masteredCount}
          nodes={activeNodes.map((node) => ({
            ...node,
            isRecommended: Boolean(recommendedNodeActive && node.name === recommendedNodeActive),
          }))}
          onSubjectChange={(subject) => setMapSubject(subject)}
          onNodePress={(nodeName, targetErrorId) => handleMapNodePress(mapSubject, nodeName, targetErrorId)}
        />
      </Suspense>
    );
  };

  const renderErrorBook = () => (
    <Suspense
      fallback={renderFeatureLoading('错题本装配中', '正在挂载知识图谱摘要、筛选器和错题卡片...')}
    >
      <ErrorBookView
        studentStateSummary={studentStateSummary}
        knowledgeGraph={knowledgeGraph}
        knowledgeGraphStatus={knowledgeGraphStatus}
        knowledgeGraphError={knowledgeGraphError}
        knowledgeGraphNotice={knowledgeGraphNotice}
        focusContext={errorBookFocus}
        graphLinkedErrors={graphLinkedErrors}
        recommendedErrorId={recommendedErrorId}
        onRefreshKnowledgeGraph={() => { void refreshKnowledgeGraph(user?.uid || 'demo-student', { manual: true }); }}
        onFocusGraphError={handleGraphErrorFocus}
        errorStats={errorStats}
        errorFilter={errorFilter}
        onFilterChange={(value) => {
          setErrorFilter(value);
          if (errorBookFocus && value !== 'all' && value !== errorBookFocus.subject) {
            setErrorBookFocus(null);
            setGraphFocusedErrorId(null);
          }
        }}
        errorCards={filteredErrors.map((err, idx) => {
          const cardId = err.id || `error-${idx}`;
          const { subject, node } = getErrorMeta(err);
          const meta = SUBJECT_META[subject];

          return {
            id: cardId,
            subject,
            subjectName: meta.name,
            subjectShort: meta.short,
            subjectColor: meta.color,
            subjectBadgeTextColor: subject === 'en' ? '#1a1a2e' : '#fff',
            node,
            summary: err.rule || err.painPoint || err.questionText?.substring(0, 60) || '',
            recencyLabel: getErrorRecencyLabel(idx),
            isRecommended: Boolean(recommendedErrorId && err.id === recommendedErrorId),
            isGraphFocused: Boolean(graphFocusedErrorId && err.id === graphFocusedErrorId),
            exploreRecommendation: errorExploreRecommendations[cardId] ?? null,
          };
        })}
        registerCardRef={(id, node) => {
          errorCardRefs.current[id] = node;
        }}
        onStartContinuousPractice={(index) => {
          void startContinuousPractice(filteredErrors, index);
        }}
        onGenerateTheater={(errorId) => {
          const targetError = filteredErrors.find((item) => item.id === errorId);
          if (!targetError) return;
          setPracticeQueue([]);
          setPracticeIndex(0);
          void generateTheaterScript(targetError);
        }}
        onMarkMastered={(errorId) => {
          void (async () => {
            if (demoMode) {
              setErrorList((current) => current.filter((item) => item.id !== errorId));
            } else {
              if (!user) return;
              await resolveError(user.uid, errorId);
              await refreshKnowledgeGraph(user.uid);
            }
            await markTaskComplete('error-revive');
            await markTaskComplete('stability-round');
            if (!demoMode) {
              await loadErrors();
            }
          })();
        }}
        onOpenExploreNode={(engineKey: ExploreEngineKey, nodeKey: string) => {
          navigateExplore({ engineKey, nodeKey });
        }}
      />
    </Suspense>
  );

  const renderOverview = () => (
    <Suspense
      fallback={renderFeatureLoading('总览装配中', '正在挂载周效率、近期进展和体验偏好面板...')}
    >
      <OverviewView
        timeSaved={timeSaved}
        theaterCueEnabled={theaterCueEnabled}
        onToggleCue={() => { void toggleTheaterCueEnabled(); }}
        overview={overviewState}
      />
    </Suspense>
  );

  const [combatAnswer, setCombatAnswer] = useState('');

  const renderFeatureLoading = (title: string, detail: string) => (
    <div className="wind-page absolute inset-0 flex items-center justify-center px-6">
      <div className="wind-panel px-8 py-7 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,rgba(61,123,255,0.18),rgba(61,123,255,0.08))] text-[var(--color-primary)]">
          <SparkleIcon className="h-7 w-7" />
        </div>
        <p className="text-lg font-black text-[#1a1a2e]">{title}</p>
        <p className="mt-2 text-sm font-medium text-gray-500">{detail}</p>
      </div>
    </div>
  );

  const renderCombat = (phase: 'question' | 'feedback') => {
    const isAiContent = aiMode === 'ready' && aiData;
    const isCorrect = isAiContent ? combatAnswer === aiData.correctAnswer : combatAnswer === '延长 CD 至 E，使 DE = CD，连接 AE, BE';
    const continueLabel =
      practiceQueue.length > 1 && practiceIndex < practiceQueue.length - 1
        ? '进入下一题'
        : '收下战利品';

    return (
      <Suspense
        fallback={renderFeatureLoading(
          phase === 'question' ? '作战模块装配中' : '结算面板装配中',
          phase === 'question' ? '正在挂载新的战斗流界面...' : '正在同步本次战斗结果...',
        )}
      >
        <CombatFlow
          phase={phase}
          aiMode={aiMode}
          aiData={aiData}
          combatAnswer={combatAnswer}
          practiceQueueLength={practiceQueue.length}
          practiceIndex={practiceIndex}
          isCorrect={isCorrect}
          continueLabel={continueLabel}
          onAnswerChange={setCombatAnswer}
          onExit={() => setCurrentScreen('dashboard')}
          onSubmit={() => setCurrentScreen('combat-feedback')}
          onRetry={() => {
            void (async () => {
              if (isAiContent && user) {
                await saveErrorRecord(user.uid, aiData);
                await refreshKnowledgeGraph(user.uid);
              } else if (isAiContent && demoMode) {
                setErrorList((current) => [{ ...aiData, id: `demo-added-${Date.now()}`, status: 'active' }, ...current]);
              }
              setCurrentScreen('combat');
              setCombatAnswer('');
            })();
          }}
          onContinue={() => {
            void (async () => {
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
            })();
          }}
        />
      </Suspense>
    );
  };

  const renderDehydrator = () => {
    return (
      <Suspense
        fallback={renderFeatureLoading('脱水模块装配中', '正在挂载脱水流、战略规划卡和执行确认面板...')}
      >
        <DehydratorFlow
          dehydrateMode={dehydrateMode}
          dehydrateData={dehydrateData}
          targetScore={targetScore}
          onExit={() => setCurrentScreen('dashboard')}
          onApprove={() => {
            void (async () => {
              await markTaskComplete('dehydrate-homework');
              setCurrentScreen('dashboard');
              setDehydrateMode('idle');
              setDehydrateData(null);
            })();
          }}
        />
      </Suspense>
    );
  };

  const renderInteractiveTheater = () => {
    return (
      <Suspense
        fallback={renderFeatureLoading('剧场世界线装配中', '正在加载分支播放器、裁决面板与异步状态卡片...')}
      >
        <InteractiveTheater
          theaterMode={theaterMode}
          theaterScript={theaterScript}
          theaterResolution={theaterResolution}
          theaterMeta={theaterMeta}
          cognitiveProjection={currentCognitiveProjection}
          theaterCueEnabled={theaterCueEnabled}
          theaterCutFxActive={theaterCutFxActive}
          theaterReadyCueActive={theaterReadyCueActive}
          theaterDecisionPending={theaterDecisionPending}
          theaterActionCompleted={theaterActionCompleted}
          theaterSelfCheck={theaterSelfCheck}
          theaterConfidence={theaterConfidence}
          theaterSelectedOption={theaterSelectedOption}
          theaterSequence={theaterSequence}
          theaterDrawCheckpoints={theaterDrawCheckpoints}
          socraticReplyDraft={socraticReplyDraft}
          socraticReplyPending={socraticReplyPending}
          onExit={() => setCurrentScreen('dashboard')}
          onToggleCue={() => { void toggleTheaterCueEnabled(); }}
          onVideoError={() => {
            setTheaterMeta((current) => current ? {
              ...current,
              videoStatus: 'failed',
              errorMessage: '视频流化失败，已启动大列表长缓冲池自动回退到极客文本剧场。',
              lastMediaSyncAt: new Date().toISOString(),
            } : current);
          }}
          onToggleActionCompleted={() => setTheaterActionCompleted((value) => !value)}
          onSelfCheckChange={setTheaterSelfCheck}
          onConfidenceChange={setTheaterConfidence}
          onSelectOption={setTheaterSelectedOption}
          onRotateSequenceStep={rotateSequenceStep}
          onToggleDrawCheckpoint={toggleDrawCheckpoint}
          onSubmitAction={() => { void handleTheaterResolution(); }}
          onForceFailure={() => { void handleTheaterResolution('failure'); }}
          onSocraticReplyDraftChange={setSocraticReplyDraft}
          onSubmitSocraticReply={() => { void handleSocraticReply(); }}
          onOpenFoundationNode={(nodeKey) => {
            setFoundationFocusKey(nodeKey);
            const targetEngineKey = nodeKey.startsWith('neuroscience.')
              ? 'mind-engine'
              : nodeKey.startsWith('language.')
                ? 'meaning-engine'
                : 'world-engine';
            navigateExplore({ engineKey: targetEngineKey, nodeKey });
          }}
        />
      </Suspense>
    );
  };
  const renderReport = () => (
    <Suspense
      fallback={renderFeatureLoading('战报装配中', '正在挂载回收时长海报和结算动作...')}
    >
      <ReportView
        timeSaved={timeSaved}
        onReturnHome={() => setCurrentScreen('dashboard')}
      />
    </Suspense>
  );

  const renderFoundationScience = () => (
    <Suspense
      fallback={renderFeatureLoading('基础科学双引擎装配中', '正在挂载物理学、神经科学拓扑卡和跨学科节点...')}
    >
      <FoundationScienceView
        studentId={user?.uid || 'demo-student'}
        initialNodeKey={foundationFocusKey}
        onBack={() => setCurrentScreen('dashboard')}
        onExplorationRecorded={() => {
          void refreshStudentStateSummary(user?.uid || 'demo-student');
        }}
      />
    </Suspense>
  );

  const renderExplore = () => (
    <Suspense
      fallback={renderFeatureLoading('探索模块装配中', '正在挂载三引擎、机制实验室和跨引擎节点...')}
    >
      <ExploreView
        engineKey={exploreRoute.engineKey}
        nodeKey={exploreRoute.nodeKey}
        mistakes={errorList.map(mapErrorToAIActiveMistake)}
        onNavigate={navigateExplore}
        onOpenCockpit={navigateExploreCockpit}
        onBackHome={() => navigateScreen('dashboard')}
        onOpenErrorBook={() => navigateScreen('error-book')}
      />
    </Suspense>
  );

  const renderExploreCockpit = () => (
    <Suspense
      fallback={renderFeatureLoading('御风舱装配中', '正在挂载 ASI、模型指数和御风轨迹...')}
    >
      <ExploreCockpitView
        onOpenExploreHome={() => navigateScreen('explore')}
        onOpenNode={(engineKey, nodeKey) => {
          navigateExplore({ engineKey, nodeKey });
        }}
      />
    </Suspense>
  );
  const yufengStatusDotClass = getYufengStatusDotClass(yufengTaskState?.status);

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-x-hidden bg-[linear-gradient(180deg,#eaf4ff_0%,#edf5ff_48%,#fff7ef_100%)] font-sans">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_12%,rgba(61,123,255,0.18),transparent_24%),radial-gradient(circle_at_82%_14%,rgba(255,138,61,0.16),transparent_22%),radial-gradient(circle_at_58%_84%,rgba(255,213,74,0.14),transparent_18%)]" />
      <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleUploadQuestion} />
      <input type="file" accept="image/*" ref={dehydrateInputRef} className="hidden" onChange={handleDehydrateHomework} />
      {/* Mobile container constraint for web view */}
      <div className={`${currentScreen === 'welcome' ? 'relative h-[100svh] w-full max-w-none overflow-hidden bg-transparent' : 'wind-mobile-shell relative h-[100svh] w-full max-w-md overflow-hidden sm:h-[90vh] sm:rounded-[40px] sm:border-[6px] sm:border-white/70'}`}>
        <AnimatePresence mode="wait">
          {currentScreen === 'welcome' && (
            <Suspense fallback={renderFeatureLoading('风场入口装配中', '正在准备御风营地...')}>
              <WelcomeScreen
                authChecking={authChecking}
                welcomeError={welcomeError}
                onEnterCamp={handleEnterCamp}
                onShowOverview={() => setCurrentScreen('overview')}
                onEnterDemo={enterDemoMode}
              />
            </Suspense>
          )}
          {currentScreen === 'profile-setup' && (
            <Suspense fallback={renderFeatureLoading('冒险档案装配中', '正在准备年级与教材设置...')}>
              <ProfileSetupScreen
                grade={grade}
                textbooks={textbooks}
                onGradeChange={setGrade}
                onTextbooksChange={setTextbooks}
                onContinue={async () => {
                  await saveProfileData({ grade, textbooks });
                  setCurrentScreen('diagnostic-loading');
                  setTimeout(() => setCurrentScreen('target-setter'), 3000);
                }}
              />
            </Suspense>
          )}
          {currentScreen === 'diagnostic-loading' && (
            <Suspense fallback={renderFeatureLoading('巡航诊断装配中', '正在准备主线地图...')}>
              <DiagnosticLoadingScreen />
            </Suspense>
          )}
          {currentScreen === 'target-setter' && (
            <Suspense fallback={renderFeatureLoading('目标设置装配中', '正在准备今日目标控件...')}>
              <TargetSetterScreen
                targetScore={targetScore}
                onTargetScoreChange={setTargetScore}
                onSubmit={async () => {
                  await saveProfileData({ targetScore });
                  setCurrentScreen('dashboard');
                }}
              />
            </Suspense>
          )}
          {currentScreen === 'dashboard' && (
            <Suspense
              fallback={renderFeatureLoading('作战面板装配中', '正在挂载今日主线、雷达图和任务卡片...')}
            >
              <Dashboard
                data={dashboardState}
                loading={dashboardLoading}
                onNavigate={(s) => setCurrentScreen(s as ScreenState)}
                onReturnHome={() => { setDemoMode(false); setCurrentScreen('welcome'); }}
                onTriggerUpload={() => fileInputRef.current?.click()}
                onTriggerDehydrate={() => dehydrateInputRef.current?.click()}
              />
            </Suspense>
          )}
          {currentScreen === 'subject-map' && renderSubjectMap()}
          {currentScreen === 'error-book' && renderErrorBook()}
          {currentScreen === 'overview' && renderOverview()}
          {currentScreen === 'foundation-science' && renderFoundationScience()}
          {currentScreen === 'explore' && renderExplore()}
          {currentScreen === 'explore-cockpit' && renderExploreCockpit()}
          {currentScreen === 'dehydrator' && renderDehydrator()}
          {currentScreen === 'combat' && renderCombat('question')}
          {currentScreen === 'combat-feedback' && renderCombat('feedback')}
          {currentScreen === 'theater' && renderInteractiveTheater()}
          {currentScreen === 'report' && renderReport()}
        </AnimatePresence>

        {/* E.M.A Companion Sprite Floating Overlay */}
        {['subject-map'].includes(currentScreen) && (
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1, y: [0, -10, 0] }}
            transition={{ y: { repeat: Infinity, duration: 3, ease: 'easeInOut' } }}
            className="absolute top-20 right-6 z-40 pointer-events-none"
          >
            <div className="relative">
              <div className={`w-12 h-12 rounded-full border-2 border-white shadow-lg flex items-center justify-center ${currentCognitiveProjection.emotion < 40 ? 'bg-red-500/80 animate-pulse' : currentCognitiveProjection.signalNoiseRatio > 70 ? 'bg-blue-500/80' : currentCognitiveProjection.time < 45 ? 'bg-orange-500/80' : 'bg-fuchsia-500/80'}`}>
                {currentCognitiveProjection.emotion < 40 ? <AlertTriangle size={20} className="text-white" /> : currentCognitiveProjection.signalNoiseRatio > 70 ? <Zap size={20} className="text-white" /> : <Orbit size={20} className="text-white relative z-10" />}
              </div>
              <div className="absolute top-14 right-0 w-max bg-black/60 backdrop-blur-sm text-[10px] text-white px-2 py-1 rounded-full border border-white/20">
                E.M.A. 陪伴中
              </div>
            </div>
          </motion.div>
        )}
        
        {['dashboard', 'subject-map', 'error-book', 'overview', 'foundation-science', 'explore', 'explore-cockpit'].includes(currentScreen) && (
          <div className="wind-bottom-nav absolute bottom-0 left-0 right-0 z-20 flex items-center justify-around px-3 pb-3 pt-3 sm:bottom-3 sm:left-3 sm:right-3 sm:rounded-[28px]">
            <NavButton onClick={() => navigateScreen('dashboard')} icon={<Sword />} label="背包" active={currentScreen === 'dashboard'} />
            <NavButton onClick={() => navigateScreen('subject-map')} icon={<MapIcon />} label="主线" active={currentScreen === 'subject-map'} />
            <NavButton onClick={() => navigateScreen('explore')} icon={<Compass />} label="探索" active={currentScreen === 'explore'} />
            <NavButton onClick={() => navigateScreen('error-book')} icon={<BookOpen />} label="图鉴" active={currentScreen === 'error-book'} />
            <NavButton
              onClick={navigateExploreCockpit}
              icon={<Navigation />}
              label="御风"
              active={currentScreen === 'explore-cockpit'}
              statusDotClass={yufengStatusDotClass}
              statusDotState={yufengTaskState?.status}
            />
          </div>
        )}
      </div>
    </div>
  );
}

const NavButton = ({
  icon,
  label,
  active = false,
  onClick,
  statusDotClass = '',
  statusDotState,
}: {
  icon: React.ReactNode,
  label: string,
  active?: boolean,
  onClick?: () => void,
  statusDotClass?: string,
  statusDotState?: string,
}) => (
  <button onClick={onClick} className={`wind-nav-btn relative flex flex-col items-center gap-1 transition-colors ${active ? 'wind-nav-btn-active text-[var(--color-primary)]' : 'text-gray-400 hover:text-gray-600'}`}>
    {statusDotClass ? (
      <span
        aria-hidden="true"
        data-testid="yufeng-status-dot"
        data-yufeng-status-dot={statusDotState}
        className={`absolute right-2 top-1 h-2 w-2 rounded-full ring-2 ring-white/80 ${statusDotClass}`}
      />
    ) : null}
    {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: active ? 24 : 22, strokeWidth: active ? 3 : 2.2 }) : icon}
    <span className={`text-[10px] font-black ${active ? 'opacity-100' : 'opacity-85'}`}>{label}</span>
  </button>
);

const SparkleIcon = (props: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    <path d="M5 3v4M3 5h4M19 3v4M17 5h4M5 17v4M3 19h4M19 17v4M17 19h4"/>
  </svg>
);
