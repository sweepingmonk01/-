import React from 'react';
import { motion } from 'motion/react';
import {
  BookOpen,
  Check,
  Compass,
  Feather,
  Flame,
  Gem,
  Lock,
  ScrollText,
  Sparkles,
  Star,
  Target,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type SubjectKey = 'zh' | 'ma' | 'en';
type NodeState = 'mastered' | 'learning' | 'locked';
type InteractionOutcome = 'success' | 'failure' | null | undefined;

const SUBJECT_ISLAND_ASSETS: Record<SubjectKey, string> = {
  zh: new URL('../../../app/assets/generated/subject-islands/zh-island-reference.png', import.meta.url).href,
  ma: new URL('../../../app/assets/generated/subject-islands/ma-island-reference.png', import.meta.url).href,
  en: new URL('../../../app/assets/generated/subject-islands/en-island-reference.png', import.meta.url).href,
};

interface SubjectMeta {
  name: string;
  color: string;
  textbookLabel: string;
}

interface SubjectNodeView {
  name: string;
  progress: number;
  state: NodeState;
  isRecommended: boolean;
  targetErrorId?: string | null;
}

interface SubjectMapViewProps {
  mapSubject: SubjectKey;
  activeMeta: SubjectMeta;
  activeTextbook: string;
  overallProgress: number;
  subjectTabs: Array<{ key: SubjectKey; label: string }>;
  recommendedNodeActive: string;
  lastOutcome?: InteractionOutcome;
  masteredCount: number;
  learningCount: number;
  inactiveCount: number;
  nodes: SubjectNodeView[];
  onSubjectChange: (subject: SubjectKey) => void;
  onNodePress: (nodeName: string, targetErrorId?: string | null) => void;
}

interface SubjectVisual {
  islandName: string;
  routeName: string;
  Icon: LucideIcon;
  accent: string;
  deep: string;
  surface: string;
  panel: string;
  scenery: string;
  shortLabel: string;
  english: string;
}

const SUBJECT_VISUALS: Record<SubjectKey, SubjectVisual> = {
  zh: {
    islandName: '语文岛',
    routeName: '丹青航线',
    Icon: ScrollText,
    accent: '#ff6b6b',
    deep: '#a7343d',
    surface: 'linear-gradient(160deg, rgba(255,107,107,0.2), rgba(255,246,227,0.84))',
    panel: 'rgba(255,107,107,0.14)',
    scenery: '竹影卷轴',
    shortLabel: '文',
    english: 'CHINESE ISLAND',
  },
  ma: {
    islandName: '数学岛',
    routeName: '晶体航线',
    Icon: Gem,
    accent: '#38c7df',
    deep: '#0e8197',
    surface: 'linear-gradient(160deg, rgba(56,199,223,0.22), rgba(230,250,255,0.86))',
    panel: 'rgba(56,199,223,0.14)',
    scenery: '几何晶塔',
    shortLabel: '数',
    english: 'MATH ISLAND',
  },
  en: {
    islandName: '英语岛',
    routeName: '日冕航线',
    Icon: BookOpen,
    accent: '#ffc857',
    deep: '#b77a00',
    surface: 'linear-gradient(160deg, rgba(255,200,87,0.25), rgba(255,248,225,0.86))',
    panel: 'rgba(255,200,87,0.16)',
    scenery: '金色书页',
    shortLabel: '英',
    english: 'ENGLISH ISLAND',
  },
};

const NODE_STATE_META: Record<NodeState, { label: string; Icon: LucideIcon; accent: string; deep: string; surface: string }> = {
  mastered: {
    label: '已完成',
    Icon: Check,
    accent: '#7edba8',
    deep: '#1c9b70',
    surface: 'linear-gradient(160deg, rgba(126,219,168,0.22), rgba(240,255,249,0.92))',
  },
  learning: {
    label: '进行中',
    Icon: Flame,
    accent: '#ffb84d',
    deep: '#d26b1e',
    surface: 'linear-gradient(160deg, rgba(255,184,77,0.28), rgba(255,246,227,0.92))',
  },
  locked: {
    label: '未解锁',
    Icon: Lock,
    accent: '#cbd5e1',
    deep: '#64748b',
    surface: 'linear-gradient(160deg, rgba(226,232,240,0.72), rgba(248,250,252,0.86))',
  },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getMissionLine = (recommendedNodeActive: string, lastOutcome: InteractionOutcome) => {
  if (!recommendedNodeActive) return '今日航线保持开放，优先点亮最近的活跃岛。';
  if (lastOutcome === 'failure') return `上一轮偏航，主线回到「${recommendedNodeActive}」。`;
  return `主线停靠「${recommendedNodeActive}」，先把这座岛打穿。`;
};

export default function SubjectMapView({
  mapSubject,
  activeMeta,
  activeTextbook,
  overallProgress,
  subjectTabs,
  recommendedNodeActive,
  lastOutcome,
  masteredCount,
  learningCount,
  inactiveCount,
  nodes,
  onSubjectChange,
  onNodePress,
}: SubjectMapViewProps) {
  const subjectVisual = SUBJECT_VISUALS[mapSubject];
  const hubName = recommendedNodeActive && nodes.some((node) => node.name === recommendedNodeActive)
    ? recommendedNodeActive
    : nodes.find((node) => node.state === 'learning')?.name ?? nodes[0]?.name;
  const hubNode = nodes.find((node) => node.name === hubName) ?? nodes[0];
  const clampedProgress = clamp(overallProgress, 0, 100);
  const activeNodeList = nodes.slice(0, 4);
  const islandOrder: Array<{ key: SubjectKey; x: number; y: number; size: 'large' | 'medium'; rotate: number }> = [
    { key: 'zh', x: 51, y: 27, size: 'large', rotate: -2 },
    { key: 'ma', x: 41, y: 55, size: 'large', rotate: 1 },
    { key: 'en', x: 64, y: 78, size: 'medium', rotate: -1 },
  ];
  const stationPoints = [
    { x: 56, y: 40 },
    { x: 62, y: 49 },
    { x: 58, y: 61 },
    { x: 67, y: 68 },
  ];

  return (
    <motion.div
      key="subject-map"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="subject-island-page yufeng-map-page absolute inset-0 flex h-full w-full min-h-0 flex-col overflow-hidden pb-24"
    >
      <div className="absolute inset-0 yufeng-cloud-sea" />
      <div className="relative z-10 mx-auto flex h-full w-full max-w-lg min-h-0 flex-col overflow-hidden px-3 pb-3 pt-3">
        <div className="yufeng-player-bar">
          <div className="flex min-w-0 items-center gap-2">
            <div className="yufeng-avatar">
              <Feather size={18} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[12px] font-black text-white drop-shadow">御风学者</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[10px] font-black text-white/90">Lv.18</span>
                <span className="h-2 w-20 overflow-hidden rounded-full bg-[#17375f]/40">
                  <span className="block h-full rounded-full bg-[linear-gradient(90deg,#ffe485,#ffc857)]" style={{ width: `${Math.max(28, clampedProgress)}%` }} />
                </span>
              </div>
            </div>
          </div>
          <div className="yufeng-gem-pill">
            <Gem size={14} />
            1280
            <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-[#2d6fb7]">+</span>
          </div>
        </div>

        <section className="yufeng-main-map relative mt-2 flex-1 min-h-0">
          <div className="yufeng-left-tools">
            <button className="yufeng-side-icon" type="button"><ScrollText size={17} /><span>任务</span></button>
            <button className="yufeng-side-icon" type="button"><Compass size={17} /><span>探索</span></button>
          </div>

          <div className="yufeng-progress-card">
            <p className="text-[10px] font-black text-[#6d5632]">主线进度</p>
            <div className="mt-2 grid place-items-center">
              <div className="yufeng-ring" style={{ ['--ring-value' as string]: `${clampedProgress}%` }}>
                <span>{clampedProgress}%</span>
              </div>
            </div>
          </div>

          <div className="yufeng-tab-ribbon">
            {subjectTabs.map((subject) => {
              const visual = SUBJECT_VISUALS[subject.key];
              const TabIcon = visual.Icon;
              const active = mapSubject === subject.key;
              return (
                <button
                  key={subject.key}
                  type="button"
                  className={`yufeng-vertical-tab ${active ? 'is-active' : ''}`}
                  onClick={() => onSubjectChange(subject.key)}
                  style={{ ['--tab-accent' as string]: visual.accent, ['--tab-deep' as string]: visual.deep } as React.CSSProperties}
                >
                  <TabIcon size={15} />
                  <span>{visual.islandName}</span>
                </button>
              );
            })}
          </div>

          <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 z-[2] h-full w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="yufeng-main-route" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ff6b6b" />
                <stop offset="45%" stopColor="#ffd36a" />
                <stop offset="100%" stopColor="#38c7df" />
              </linearGradient>
            </defs>
            <path d="M 51 35 C 57 40, 58 44, 48 50 C 38 56, 45 64, 56 63 C 68 62, 71 70, 64 77" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.62" />
            <path className="island-route" d="M 51 35 C 57 40, 58 44, 48 50 C 38 56, 45 64, 56 63 C 68 62, 71 70, 64 77" stroke="url(#yufeng-main-route)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 3" fill="none" />
          </svg>

          {stationPoints.map((point, index) => {
            const node = activeNodeList[index];
            const stateMeta = node ? NODE_STATE_META[node.state] : NODE_STATE_META.locked;
            const StationIcon = node?.isRecommended ? Star : stateMeta.Icon;

            return (
              <button
                key={`${point.x}-${point.y}`}
                type="button"
                className="yufeng-route-station"
                style={{ left: `${point.x}%`, top: `${point.y}%`, ['--station-accent' as string]: node?.isRecommended ? subjectVisual.accent : stateMeta.accent } as React.CSSProperties}
                onClick={() => node && onNodePress(node.name, node.targetErrorId)}
                aria-label={node?.name ?? '待启航节点'}
              >
                <StationIcon size={13} />
              </button>
            );
          })}

          {islandOrder.map((island, index) => {
            const visual = SUBJECT_VISUALS[island.key];
            const IslandIcon = visual.Icon;
            const isActive = mapSubject === island.key;
            const subjectNode = island.key === mapSubject ? hubNode : undefined;

            return (
              <motion.button
                key={island.key}
                type="button"
                initial={{ opacity: 0, y: 18, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: isActive ? 1.06 : 1 }}
                transition={{ duration: 0.36, delay: index * 0.08 }}
                className={`yufeng-subject-island yufeng-subject-${island.key} ${island.size === 'large' ? 'is-large' : 'is-medium'} ${isActive ? 'is-active' : ''}`}
                style={{
                  left: `${island.x}%`,
                  top: `${island.y}%`,
                  transform: `translate(-50%, -50%) rotate(${island.rotate}deg)`,
                  ['--subject-accent' as string]: visual.accent,
                  ['--subject-deep' as string]: visual.deep,
                  ['--subject-panel' as string]: visual.panel,
                } as React.CSSProperties}
                onClick={() => {
                  if (island.key !== mapSubject) {
                    onSubjectChange(island.key);
                    return;
                  }
                  onNodePress(subjectNode?.name ?? hubNode?.name ?? visual.islandName, subjectNode?.targetErrorId ?? hubNode?.targetErrorId);
                }}
              >
                <span className="yufeng-island-glow" />
                <img className="yufeng-island-bitmap" src={SUBJECT_ISLAND_ASSETS[island.key]} alt="" />
                <span className="yufeng-island-label">
                  <span className="yufeng-island-mini-icon">
                    <IslandIcon size={13} />
                  </span>
                  <span className="yufeng-island-title">
                    <strong>{visual.islandName}</strong>
                    <em>{visual.english}</em>
                  </span>
                  <span className="yufeng-island-progress">
                    <Star size={12} fill="currentColor" />
                    {island.key === mapSubject ? `${Math.max(1, learningCount)}/${Math.max(3, masteredCount + learningCount + inactiveCount)}` : island.key === 'zh' ? '5/15' : island.key === 'ma' ? '3/12' : '8/15'}
                  </span>
                </span>
              </motion.button>
            );
          })}

          <div className="yufeng-mission-scroll">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#64748b]">{subjectVisual.routeName}</p>
                <p className="mt-1 truncate text-[11px] font-black text-[#122344]">
                  {hubNode?.name || activeMeta.textbookLabel} · {getMissionLine(recommendedNodeActive, lastOutcome)}
                </p>
              </div>
              <div
                className="flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[10px] font-black text-white shadow-[0_10px_18px_rgba(30,60,100,0.18)]"
                style={{ background: `linear-gradient(180deg, ${subjectVisual.accent}, ${subjectVisual.deep})` }}
              >
                <Zap size={12} />
                探索
              </div>
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );
}
