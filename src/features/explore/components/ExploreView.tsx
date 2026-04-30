import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Compass,
  FlaskConical,
  Map,
  Network,
  Navigation,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import {
  exploreEngines,
  exploreNodes,
  getEngineByKey,
  getNodeByEngineAndKey,
  getNodeByKey,
  getNodesByEngine,
  upcomingGameTopologyNodes,
  type ExploreEngine,
  type ExploreEngineKey,
  type ExploreNode,
} from '../data/exploreData';
import { exploreStorage } from '../storage';
import { emitExploreProgressUpdated, subscribeExploreProgressUpdated } from '../utils/exploreStateEvents';
import type { LightweightMistakeRecord } from '../utils/aiActiveStateFromExplore';
import { ExploreAuditPanel } from './ExploreAuditPanel';
import { ExploreRemoteDebugPanel } from './ExploreRemoteDebugPanel';
import { ExploreLearningProfilePanel } from './ExploreLearningProfilePanel';
import { ExploreLearningProfileHistoryPanel } from './ExploreLearningProfileHistoryPanel';
import { AIActiveStatePanel } from './AIActiveStatePanel';
import { ExploreActiveRadar } from './ExploreActiveRadar';
import { ExploreMediaWorkbench } from './ExploreMediaWorkbench';
import { ExploreTaskCompletionPanel } from './ExploreTaskCompletionPanel';

const AIDiagnosisDebugWorkbench = lazy(() =>
  import('../../errors/diagnosis/AIDiagnosisDebugWorkbench').then((module) => ({
    default: module.AIDiagnosisDebugWorkbench,
  })),
);

interface ExploreRoute {
  engineKey?: string;
  nodeKey?: string;
}

interface ExploreViewProps extends ExploreRoute {
  mistakes?: LightweightMistakeRecord[];
  onNavigate: (route: ExploreRoute) => void;
  onOpenCockpit: () => void;
  onBackHome: () => void;
  onOpenErrorBook: () => void;
}

const engineTone: Record<ExploreEngineKey, string> = {
  'world-engine': 'text-cyan-100 border-cyan-200/20 bg-cyan-300/10',
  'mind-engine': 'text-violet-100 border-violet-200/20 bg-violet-300/10',
  'meaning-engine': 'text-pink-100 border-pink-200/20 bg-pink-300/10',
  'game-topology-engine': 'text-amber-100 border-amber-200/20 bg-amber-300/10',
};

const crossExamples = [
  {
    title: '数学等式平衡',
    world: '守恒与平衡',
    mind: '工作记忆保持等式两边',
    meaning: '符号规则与等价变形',
    game: '规则层决定有效行动',
  },
  {
    title: '英语阅读主旨题',
    world: '事件结构',
    mind: '注意力抗干扰',
    meaning: '语境与意义生成',
    game: '反馈回路修复错因',
  },
  {
    title: '错题反复出现',
    world: '系统边界不清',
    mind: '错误神经回路被强化',
    meaning: '题型规则没有识别',
    game: '成长层让修复可见',
  },
];

const healthPrinciples = [
  '不制造强迫性上线焦虑。',
  '不用公开比较作为核心刺激。',
  '不用随机抽奖驱动学习。',
  '不用 FOMO 逼迫上线。',
  '所有反馈必须服务能力成长。',
  '游戏机制必须解释清楚，让学生知道自己为什么行动。',
];

function readCompletedNodes() {
  return exploreStorage.getCompletedNodes();
}

function areNodeKeyListsEqual(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
}

function getEstimatedMinutes(node: ExploreNode) {
  return node.explorationTasks.reduce((sum, task) => sum + task.estimatedMinutes, 0) || 3;
}

export default function ExploreView({
  engineKey,
  nodeKey,
  mistakes = [],
  onNavigate,
  onOpenCockpit,
  onBackHome,
  onOpenErrorBook,
}: ExploreViewProps) {
  const [completedNodes, setCompletedNodes] = useState<string[]>(() => readCompletedNodes());

  useEffect(() => {
    exploreStorage.setCompletedNodes(completedNodes);
    emitExploreProgressUpdated();
  }, [completedNodes]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const refreshCompletedNodes = () => {
      const nextCompletedNodes = readCompletedNodes();
      setCompletedNodes((current) => (
        areNodeKeyListsEqual(current, nextCompletedNodes) ? current : nextCompletedNodes
      ));
    };

    const unsubscribe = subscribeExploreProgressUpdated(refreshCompletedNodes);
    window.addEventListener('storage', refreshCompletedNodes);

    return () => {
      unsubscribe();
      window.removeEventListener('storage', refreshCompletedNodes);
    };
  }, []);

  const engine = engineKey ? getEngineByKey(engineKey) : undefined;
  const node = engine && nodeKey ? getNodeByEngineAndKey(engine.key, nodeKey) : undefined;

  const markNodeCompleted = (targetKey: string) => {
    setCompletedNodes((current) => (
      current.includes(targetKey) ? current : [...current, targetKey]
    ));
  };

  const content = (() => {
    if (engineKey && !engine) {
      return (
        <EmptyState
          title="没有找到这个探索引擎"
          detail="当前探索地图中还没有这个路径。"
          actionLabel="返回探索首页"
          onAction={() => onNavigate({})}
        />
      );
    }

    if (engine && nodeKey && !node) {
      return (
        <EmptyState
          title="没有找到这个探索节点"
          detail="这个节点可能尚未开放，先回到对应引擎地图。"
          actionLabel="返回引擎地图"
          onAction={() => onNavigate({ engineKey: engine.key })}
        />
      );
    }

    if (engine && node) {
      return (
        <NodeDetail
          engine={engine}
          node={node}
          completed={completedNodes.includes(node.key)}
          onBack={() => onNavigate({ engineKey: engine.key })}
          onOpenNode={(targetEngineKey, targetNodeKey) => onNavigate({ engineKey: targetEngineKey, nodeKey: targetNodeKey })}
          onMarkCompleted={() => markNodeCompleted(node.key)}
        />
      );
    }

    if (engine) {
      return (
        <EngineDetail
          engine={engine}
          completedNodes={completedNodes}
          onBack={() => onNavigate({})}
          onOpenNode={(targetNode) => onNavigate({ engineKey: engine.key, nodeKey: targetNode.key })}
          onOpenEngine={(targetEngineKey) => onNavigate({ engineKey: targetEngineKey })}
        />
      );
    }

    return (
      <ExploreHome
        completedNodes={completedNodes}
        mistakes={mistakes}
        onOpenEngine={(targetEngineKey) => onNavigate({ engineKey: targetEngineKey })}
        onOpenNode={(targetEngineKey, targetNodeKey) => onNavigate({ engineKey: targetEngineKey, nodeKey: targetNodeKey })}
        onOpenNodeByKey={(targetNodeKey) => {
          const targetNode = getNodeByKey(targetNodeKey);
          if (!targetNode) return;
          onNavigate({ engineKey: targetNode.engineKey, nodeKey: targetNode.key });
        }}
        onOpenCockpit={onOpenCockpit}
        onOpenErrorBook={onOpenErrorBook}
      />
    );
  })();

  return (
    <motion.div
      key={`explore-${engineKey ?? 'home'}-${nodeKey ?? 'map'}`}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      className="absolute inset-0 flex h-full w-full flex-col overflow-hidden bg-[#07111f] pb-24 text-white"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_12%,rgba(56,189,248,0.22),transparent_30%),radial-gradient(circle_at_84%_18%,rgba(244,114,182,0.16),transparent_26%),radial-gradient(circle_at_48%_92%,rgba(245,158,11,0.16),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-3 pt-3">
        <header className="mb-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={engineKey ? () => onNavigate({}) : onBackHome}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/14 bg-white/10 text-white shadow-[0_12px_24px_rgba(0,0,0,0.22)]"
            aria-label={engineKey ? '返回探索首页' : '返回首页'}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/70">Explore Topology</p>
            <h1 className="truncate text-[22px] font-black leading-tight">{node?.label ?? engine?.title ?? '探索'}</h1>
          </div>
          <div className="flex h-10 items-center gap-1.5 rounded-2xl border border-white/14 bg-white/10 px-3 text-[11px] font-black text-cyan-50">
            <Network size={15} />
            {completedNodes.length}/{exploreNodes.length}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-[26px] border border-white/10 bg-white/[0.06] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          {content}
        </div>
      </div>
    </motion.div>
  );
}

function ExploreHome({
  completedNodes,
  mistakes,
  onOpenEngine,
  onOpenNode,
  onOpenNodeByKey,
  onOpenCockpit,
  onOpenErrorBook,
}: {
  completedNodes: string[];
  mistakes: LightweightMistakeRecord[];
  onOpenEngine: (engineKey: ExploreEngineKey) => void;
  onOpenNode: (engineKey: ExploreEngineKey, nodeKey: string) => void;
  onOpenNodeByKey: (nodeKey: string) => void;
  onOpenCockpit: () => void;
  onOpenErrorBook: () => void;
}) {
  const foundationEngines = exploreEngines.filter((engine) => engine.layer === 'foundation-science');
  const mechanismEngine = exploreEngines.find((engine) => engine.key === 'game-topology-engine')!;
  const showAudit =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('debug') === '1';

  return (
    <div className="space-y-3">
      <section className="relative overflow-hidden rounded-[24px] border border-white/12 bg-[#020817] px-4 py-5 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(56,189,248,0.18),transparent_34%),radial-gradient(circle_at_82%_12%,rgba(167,139,250,0.16),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.06),transparent_45%)]" />
        <div className="relative">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-100/18 bg-cyan-200/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
            <Compass size={13} />
            Foundation + Mechanism
          </div>
          <h2 className="text-[34px] font-black leading-none">探索</h2>
          <p className="mt-2 text-[16px] font-black leading-6 text-white/88">看懂世界，看懂自己，看懂意义，再把理解转化为行动。</p>
          <p className="mt-3 text-xs font-bold leading-5 text-white/58">
            所有学科都是信息拓扑的不同切面；所有学习都是在重建这些拓扑结构；所有提分只是局部结果；真正目标是获得跨学科、跨规则、跨 AI 时代的结构化理解力。
          </p>
        </div>
      </section>

      <SectionTitle
        icon={<Sparkles size={15} />}
        title="基础科学三引擎"
        subtitle="世界模型 x 心智模型 x 意义模型"
      />
      <div className="grid gap-2">
        {foundationEngines.map((engine) => (
          <EngineCard key={engine.key} engine={engine} onOpen={() => onOpenEngine(engine.key)} />
        ))}
      </div>

      <SectionTitle
        icon={<FlaskConical size={15} />}
        title="机制科学实验室"
        subtitle="把知识变成行动，把行动变成反馈，把反馈变成成长。"
      />
      <EngineCard
        engine={mechanismEngine}
        featured
        onOpen={() => onOpenEngine(mechanismEngine.key)}
      />
      <p className="rounded-2xl border border-amber-200/14 bg-amber-300/10 px-3 py-2 text-[11px] font-bold leading-5 text-amber-50/76">
        游戏机制科学不是娱乐化装饰，而是行动组织科学。它不是第四基础科学，而是三引擎之上的机制转化层。
      </p>

      <button
        type="button"
        onClick={onOpenCockpit}
        className="group relative w-full overflow-hidden rounded-[24px] border border-cyan-100/18 bg-white/[0.08] px-4 py-4 text-left transition active:scale-[0.99]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_14%,rgba(56,189,248,0.20),transparent_34%),radial-gradient(circle_at_84%_22%,rgba(16,185,129,0.16),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_44%)] opacity-90 transition group-hover:opacity-100" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/66">Free Flight Dashboard</p>
            <h3 className="mt-1 text-[20px] font-black leading-tight text-white">进入御风舱</h3>
            <p className="mt-2 text-xs font-bold leading-5 text-white/62">
              查看 ASI、四大模型指数、御风轨迹与下一步飞行方向。
            </p>
          </div>
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-100/18 bg-cyan-200/10 text-cyan-100">
            <Navigation size={19} />
          </div>
        </div>
        <div className="relative mt-3 inline-flex items-center gap-1.5 text-xs font-black text-cyan-50">
          打开驾驶舱
          <ChevronRight size={14} />
        </div>
      </button>

      <ExploreActiveRadar />
      <AIActiveStatePanel mistakes={mistakes} onOpenNode={onOpenNodeByKey} />

      <SectionTitle icon={<Network size={15} />} title="今日跨引擎连接" subtitle="同一个学习问题，可以从四层结构一起看。" />
      <div className="grid gap-2">
        {crossExamples.map((item) => (
          <article key={item.title} className="rounded-[22px] border border-white/10 bg-white/[0.07] px-3 py-3">
            <h3 className="text-sm font-black text-white">{item.title}</h3>
            <div className="mt-2 grid gap-1.5 text-[11px] font-bold leading-4 text-white/66">
              <p><span className="text-cyan-200">World：</span>{item.world}</p>
              <p><span className="text-violet-200">Mind：</span>{item.mind}</p>
              <p><span className="text-pink-200">Meaning：</span>{item.meaning}</p>
              <p><span className="text-amber-200">Game：</span>{item.game}</p>
            </div>
          </article>
        ))}
      </div>

      <section className="rounded-[24px] border border-white/12 bg-[#f8fbff] px-4 py-4 text-[#111827]">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#111827] text-white">
            <BookOpen size={17} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">从错题进入基础原理</p>
            <h3 className="mt-1 text-[18px] font-black">上传一道错题，进入四层解释</h3>
          </div>
        </div>
        <ol className="mt-3 space-y-1.5 text-xs font-bold leading-5 text-gray-600">
          <li>1. 课本知识点</li>
          <li>2. World Engine 世界模型</li>
          <li>3. Mind Engine 心智模型</li>
          <li>4. Meaning Engine 意义模型</li>
        </ol>
        <p className="mt-2 text-xs font-bold leading-5 text-gray-500">系统会推荐一个机制修复任务，本次先使用本地 mock 映射字段。</p>
        <button
          type="button"
          onClick={onOpenErrorBook}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#111827] px-4 py-3 text-sm font-black text-white"
        >
          进入错题诊断
          <ChevronRight size={15} />
        </button>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/[0.07] px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/42">我的全局地图</p>
            <h3 className="mt-1 text-lg font-black">从刷题到御风</h3>
          </div>
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-emerald-200/16 bg-emerald-300/10 text-emerald-100">
            <Map size={19} />
          </div>
        </div>
        <p className="mt-2 text-xs font-bold leading-5 text-white/60">让孩子掌握知识背后的运行规则。</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#38bdf8,#a78bfa,#f472b6,#f59e0b)]"
            style={{ width: `${Math.max(8, Math.round((completedNodes.length / exploreNodes.length) * 100))}%` }}
          />
        </div>
      </section>

      {showAudit ? (
        <>
          <ExploreAuditPanel />
          <ExploreRemoteDebugPanel />
          <Suspense
            fallback={(
              <section className="rounded-[24px] border border-amber-200/16 bg-[#020817] px-4 py-4 text-xs font-black text-amber-50/72">
                加载 AI 诊断工作台...
              </section>
            )}
          >
            <AIDiagnosisDebugWorkbench onOpenNode={onOpenNode} />
          </Suspense>
          <ExploreLearningProfilePanel onOpenNode={onOpenNode} />
          <ExploreLearningProfileHistoryPanel />
        </>
      ) : null}
    </div>
  );
}

function EngineCard({
  engine,
  featured = false,
  onOpen,
}: {
  key?: React.Key;
  engine: ExploreEngine;
  featured?: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group relative overflow-hidden rounded-[24px] border border-white/12 bg-white/[0.07] px-4 py-4 text-left transition active:scale-[0.99] ${featured ? 'min-h-[172px]' : 'min-h-[148px]'}`}
    >
      <div
        className="absolute inset-0 opacity-80 transition group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle at 10% 18%, ${engine.accentColor}33, transparent 36%), linear-gradient(135deg, rgba(255,255,255,0.08), transparent 42%)`,
        }}
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="text-3xl leading-none">{engine.icon}</div>
          <div className="rounded-full border border-white/12 bg-white/10 px-2 py-1 text-[10px] font-black text-white/70">
            {engine.layer === 'foundation-science' ? '基础科学层' : '机制转化层'}
          </div>
        </div>
        <h3 className="mt-3 text-[20px] font-black leading-tight text-white">{engine.title}</h3>
        <p className="mt-1 text-sm font-black" style={{ color: engine.accentColor }}>{engine.subtitle}</p>
        <p className="mt-2 text-xs font-bold leading-5 text-white/62">{engine.oneSentence}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {engine.keywords.map((keyword) => (
            <span key={keyword} className="rounded-full border border-white/10 bg-white/9 px-2 py-1 text-[10px] font-black text-white/62">
              {keyword}
            </span>
          ))}
        </div>
        <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-black text-white">
          进入引擎
          <ChevronRight size={14} />
        </div>
      </div>
    </button>
  );
}

function EngineDetail({
  engine,
  completedNodes,
  onBack,
  onOpenNode,
  onOpenEngine,
}: {
  engine: ExploreEngine;
  completedNodes: string[];
  onBack: () => void;
  onOpenNode: (node: ExploreNode) => void;
  onOpenEngine: (engineKey: ExploreEngineKey) => void;
}) {
  const nodes = getNodesByEngine(engine.key);
  const completedCount = nodes.filter((node) => completedNodes.includes(node.key)).length;

  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/8 px-3 py-2 text-xs font-black text-white/70">
        <ArrowLeft size={14} />
        返回探索首页
      </button>

      <section className="relative overflow-hidden rounded-[24px] border border-white/12 bg-[#020817] px-4 py-5">
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(circle at 14% 16%, ${engine.accentColor}38, transparent 34%), linear-gradient(135deg, rgba(255,255,255,0.07), transparent 46%)` }}
        />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="text-4xl">{engine.icon}</div>
            <span className="rounded-full border border-white/12 bg-white/10 px-2.5 py-1 text-[10px] font-black text-white/66">
              {completedCount}/{nodes.length} 已理解
            </span>
          </div>
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: engine.accentColor }}>{engine.englishTitle}</p>
          <h2 className="mt-1 text-[28px] font-black leading-none">{engine.subtitle}</h2>
          <p className="mt-2 text-sm font-black leading-5 text-white/84">{engine.coreQuestion}</p>
          <p className="mt-3 text-xs font-bold leading-5 text-white/58">{engine.description}</p>
        </div>
      </section>

      <SectionTitle icon={<Target size={15} />} title="节点网格" subtitle="先进入节点，再从核心问题回到课内错因。" />
      <div className="grid gap-2">
        {nodes.map((node, index) => (
          <NodeCard
            key={node.key}
            node={node}
            index={index}
            completed={completedNodes.includes(node.key)}
            onOpen={() => onOpenNode(node)}
          />
        ))}
      </div>

      <section className="rounded-[24px] border border-white/10 bg-white/[0.07] px-4 py-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/42">推荐探索路径</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-black text-white/70">
          {nodes.slice(0, 4).map((node, index) => (
            <React.Fragment key={node.key}>
              <button type="button" onClick={() => onOpenNode(node)} className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5">
                {node.shortLabel}
              </button>
              {index < Math.min(nodes.length, 4) - 1 ? <ChevronRight size={14} className="text-white/30" /> : null}
            </React.Fragment>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/[0.07] px-4 py-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/42">跨引擎连接提示</p>
        <p className="mt-2 text-xs font-bold leading-5 text-white/60">
          三引擎是基础科学层，Game Topology Engine 是机制转化层。节点详情会显示可教学连接。
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {exploreEngines.filter((item) => item.key !== engine.key).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onOpenEngine(item.key)}
              className={`rounded-2xl border px-3 py-2 text-left text-[11px] font-black ${engineTone[item.key]}`}
            >
              {item.title}
            </button>
          ))}
        </div>
      </section>

      {engine.key === 'game-topology-engine' ? <HealthPrinciples /> : null}

      {engine.key === 'game-topology-engine' ? (
        <section className="rounded-[24px] border border-white/10 bg-white/[0.07] px-4 py-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/42">即将开放</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {upcomingGameTopologyNodes.map((item) => (
              <span key={item} className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-[10px] font-black text-white/52">
                {item}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function NodeCard({
  node,
  index,
  completed,
  onOpen,
}: {
  key?: React.Key;
  node: ExploreNode;
  index: number;
  completed: boolean;
  onOpen: () => void;
}) {
  const engine = getEngineByKey(node.engineKey)!;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-[22px] border border-white/10 bg-white/[0.07] px-3 py-3 text-left transition active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl text-[11px] font-black text-[#07111f]" style={{ backgroundColor: engine.accentColor }}>
              {completed ? <CheckCircle2 size={14} /> : index + 1}
            </span>
            <h3 className="truncate text-[15px] font-black text-white">{node.label}</h3>
          </div>
          <p className="mt-2 text-xs font-black leading-5" style={{ color: engine.accentColor }}>{node.coreQuestion}</p>
          <p className="mt-1 line-clamp-2 text-[11px] font-bold leading-4 text-white/58">{node.summary}</p>
        </div>
        <ChevronRight size={16} className="mt-1 shrink-0 text-white/42" />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {node.relatedCurriculumNodes.slice(0, 3).map((item) => (
          <span key={item} className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-[10px] font-black text-white/54">
            {item}
          </span>
        ))}
        <span className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-[10px] font-black text-white/54">
          {getEstimatedMinutes(node)} 分钟
        </span>
      </div>
      <div className="mt-2 rounded-2xl border border-white/8 bg-black/12 px-3 py-2">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/34">常见错因</p>
        <p className="mt-1 text-[11px] font-bold leading-4 text-white/56">{node.relatedMistakePatterns.slice(0, 2).join(' / ')}</p>
      </div>
    </button>
  );
}

function NodeDetail({
  engine,
  node,
  completed,
  onBack,
  onOpenNode,
  onMarkCompleted,
}: {
  engine: ExploreEngine;
  node: ExploreNode;
  completed: boolean;
  onBack: () => void;
  onOpenNode: (engineKey: ExploreEngineKey, nodeKey: string) => void;
  onMarkCompleted: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-black text-white/54">
        <button type="button" onClick={onBack} className="rounded-full border border-white/10 bg-white/8 px-2 py-1">探索</button>
        <ChevronRight size={13} className="text-white/28" />
        <button type="button" onClick={onBack} className="rounded-full border border-white/10 bg-white/8 px-2 py-1">{engine.title}</button>
        <ChevronRight size={13} className="text-white/28" />
        <span className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-white/72">{node.label}</span>
      </div>

      <section className="relative overflow-hidden rounded-[24px] border border-white/12 bg-[#020817] px-4 py-5">
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(circle at 16% 18%, ${engine.accentColor}38, transparent 34%), linear-gradient(135deg, rgba(255,255,255,0.07), transparent 46%)` }}
        />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: engine.accentColor }}>{engine.title}</p>
              <h2 className="mt-1 text-[28px] font-black leading-none">{node.label}</h2>
            </div>
            <span className="rounded-full border border-white/12 bg-white/10 px-2.5 py-1 text-[10px] font-black text-white/66">
              {node.scale}
            </span>
          </div>
          <p className="mt-4 text-lg font-black leading-6 text-white">{node.coreQuestion}</p>
          <p className="mt-3 text-xs font-bold leading-5 text-white/60">{node.summary}</p>
        </div>
      </section>

      <InfoBlock title="直觉解释" body={node.intuition} />
      <InfoBlock title="机制解释" body={node.mechanism} />
      {node.formal ? <InfoBlock title="形式化解释" body={node.formal} /> : null}

      <TwoColumnList
        leftTitle="关联课内知识"
        leftItems={node.relatedCurriculumNodes}
        rightTitle="常见错因"
        rightItems={node.relatedMistakePatterns}
      />

      <ExploreTaskCompletionPanel node={node} />
      <ExploreMediaWorkbench node={node} />

      <section className="rounded-[24px] border border-white/10 bg-white/[0.07] px-4 py-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/42">快速完成入口</p>
        <p className="mt-2 text-xs font-bold leading-5 text-white/56">
          主流程建议提交探索证据；如果只是补录进度，可以使用快速标记。
        </p>
        <button
          type="button"
          onClick={onMarkCompleted}
          className={`mt-3 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-black ${completed ? 'bg-emerald-300/12 text-emerald-100' : 'bg-white/10 text-white'}`}
        >
          {completed ? '已完成节点' : '仅快速标记'}
        </button>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/[0.07] px-4 py-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/42">媒体生成种子 · Dev</p>
        <div className="mt-3 grid gap-2 text-[11px] font-bold leading-4 text-white/60">
          <p>视觉隐喻：{node.mediaPromptSeed.visualMetaphor}</p>
          <p>GPT Image 风格：{node.mediaPromptSeed.gptImageStyle}</p>
          <p>交互任务：{node.mediaPromptSeed.interactiveTaskType}</p>
        </div>
        <div className="mt-3 space-y-1.5">
          {node.mediaPromptSeed.seedanceStoryboard.map((beat, index) => (
            <p key={beat} className="rounded-2xl border border-white/8 bg-white/6 px-3 py-2 text-[11px] font-bold leading-4 text-white/56">
              {index + 1}. {beat}
            </p>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-white/[0.07] px-4 py-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/42">跨引擎连接</p>
        {node.crossEngineLinks.length ? (
          <div className="mt-3 grid gap-2">
            {node.crossEngineLinks.map((link) => {
              const targetEngine = getEngineByKey(link.targetEngine)!;
              const targetNode = getNodeByKey(link.targetKey);
              return (
                <button
                  key={`${link.targetEngine}-${link.targetKey}-${link.relation}`}
                  type="button"
                  onClick={() => targetNode ? onOpenNode(link.targetEngine, link.targetKey) : onOpenNode(link.targetEngine, '')}
                  className={`rounded-2xl border px-3 py-3 text-left ${engineTone[link.targetEngine]}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] opacity-70">{targetEngine.title} · {link.relation}</p>
                      <p className="mt-1 text-xs font-black leading-5">{targetNode?.label ?? link.targetKey}</p>
                      <p className="mt-1 text-[11px] font-bold leading-4 opacity-72">{link.description}</p>
                    </div>
                    <ChevronRight size={14} className="mt-1 shrink-0 opacity-70" />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 text-xs font-bold leading-5 text-white/54">这个节点暂时没有显式跨引擎连接，后续会从错题图谱自动补全。</p>
        )}
      </section>

      <button type="button" onClick={onBack} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm font-black text-white">
        返回引擎地图
      </button>
    </div>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-1 pt-1">
      <div>
        <div className="flex items-center gap-1.5 text-cyan-100/80">
          {icon}
          <h2 className="text-[16px] font-black text-white">{title}</h2>
        </div>
        <p className="mt-1 text-[11px] font-bold leading-4 text-white/48">{subtitle}</p>
      </div>
    </div>
  );
}

function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-[24px] border border-white/10 bg-white/[0.07] px-4 py-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/42">{title}</p>
      <p className="mt-2 text-sm font-bold leading-6 text-white/72">{body}</p>
    </section>
  );
}

function TwoColumnList({
  leftTitle,
  leftItems,
  rightTitle,
  rightItems,
}: {
  leftTitle: string;
  leftItems: string[];
  rightTitle: string;
  rightItems: string[];
}) {
  return (
    <section className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <ListPanel title={leftTitle} items={leftItems} />
      <ListPanel title={rightTitle} items={rightItems} />
    </section>
  );
}

function ListPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.07] px-4 py-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/42">{title}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-[10px] font-black text-white/62">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function HealthPrinciples() {
  return (
    <section className="rounded-[24px] border border-emerald-200/14 bg-emerald-300/10 px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-emerald-200/18 bg-emerald-200/12 text-emerald-100">
          <ShieldCheck size={17} />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100/56">健康机制原则</p>
          <h3 className="mt-1 text-lg font-black text-white">机制必须服务成长</h3>
          <p className="mt-2 text-xs font-bold leading-5 text-white/62">《列子御风》不是用游戏机制控制孩子，而是用机制帮助孩子恢复主动性。</p>
        </div>
      </div>
      <div className="mt-3 grid gap-1.5">
        {healthPrinciples.map((item, index) => (
          <p key={item} className="rounded-2xl border border-white/8 bg-white/6 px-3 py-2 text-[11px] font-bold leading-4 text-white/64">
            {index + 1}. {item}
          </p>
        ))}
      </div>
    </section>
  );
}

function EmptyState({
  title,
  detail,
  actionLabel,
  onAction,
}: {
  title: string;
  detail: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <section className="rounded-[24px] border border-white/10 bg-white/[0.07] px-4 py-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/12 bg-white/10 text-white">
        <Compass size={20} />
      </div>
      <h2 className="mt-4 text-xl font-black text-white">{title}</h2>
      <p className="mt-2 text-xs font-bold leading-5 text-white/58">{detail}</p>
      <button type="button" onClick={onAction} className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#111827]">
        {actionLabel}
      </button>
    </section>
  );
}
