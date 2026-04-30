import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Atom,
  BrainCircuit,
  ChevronRight,
  Network,
  Play,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import {
  createKnowledgeNodeVideo,
  listFoundationKnowledgeEdges,
  listFoundationKnowledgeNodes,
  recordFoundationExploration,
  refreshMobiusMediaJob,
  type FoundationKnowledgeEdge,
  type FoundationKnowledgeNode,
  type FoundationScienceDomain,
  type MobiusMediaJobResponse,
} from '../../lib/mobius';

const PHYSICS_MAP = new URL('../../../app/assets/foundation-science/physics-foundation-map.png', import.meta.url).href;
const NEUROSCIENCE_MAP = new URL('../../../app/assets/foundation-science/neuroscience-foundation-map.png', import.meta.url).href;

interface FoundationScienceViewProps {
  studentId: string;
  onBack: () => void;
  initialNodeKey?: string | null;
  onExplorationRecorded?: () => void;
}

const DOMAIN_META: Record<FoundationScienceDomain, {
  title: string;
  label: string;
  subtitle: string;
  promise: string;
  image: string;
  icon: React.ReactNode;
  accent: string;
  glow: string;
}> = {
  physics: {
    title: 'World Engine',
    label: '物理学',
    subtitle: '世界如何运行',
    promise: '因果、模型、尺度、守恒、对称性',
    image: PHYSICS_MAP,
    icon: <Atom size={18} />,
    accent: '#4cc9f0',
    glow: 'rgba(76,201,240,0.28)',
  },
  neuroscience: {
    title: 'Mind Engine',
    label: '神经科学',
    subtitle: '我如何学习',
    promise: '注意、记忆、情绪、决策、错因修复',
    image: NEUROSCIENCE_MAP,
    icon: <BrainCircuit size={18} />,
    accent: '#ffb84d',
    glow: 'rgba(255,184,77,0.26)',
  },
};

const compactNode = (node: FoundationKnowledgeNode) => ({
  ...node,
  shortSummary: node.summary.length > 42 ? `${node.summary.slice(0, 42)}...` : node.summary,
});

const buildExplorationTasks = (node: FoundationKnowledgeNode) => [
  {
    id: 'global-position',
    label: '定位全局位置',
    actionType: 'select' as const,
    detail: `把「${node.label}」放回 ${node.domain === 'physics' ? 'World Engine' : 'Mind Engine'} 的全局地图。`,
  },
  {
    id: 'mechanism-chain',
    label: '完成机制链',
    actionType: 'sequence' as const,
    detail: node.mediaPromptSeed.seedanceStoryboard[1] ?? node.coreQuestion,
  },
  {
    id: 'bridge-curriculum',
    label: '连接课内/错因',
    actionType: 'drag' as const,
    detail: node.relatedCurriculumNodes.length
      ? `连接到 ${node.relatedCurriculumNodes.slice(0, 2).join(' / ')}。`
      : `连接到 ${node.relatedMistakePatterns.slice(0, 2).join(' / ') || '当前学习动作'}。`,
  },
];

export default function FoundationScienceView({
  studentId,
  onBack,
  initialNodeKey,
  onExplorationRecorded,
}: FoundationScienceViewProps) {
  const [activeDomain, setActiveDomain] = useState<FoundationScienceDomain>('physics');
  const [nodes, setNodes] = useState<FoundationKnowledgeNode[]>([]);
  const [edges, setEdges] = useState<FoundationKnowledgeEdge[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Record<string, 'success' | 'failure'>>({});
  const [explorationStatus, setExplorationStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [explorationMessage, setExplorationMessage] = useState<string | null>(null);
  const [videoJob, setVideoJob] = useState<MobiusMediaJobResponse | null>(null);
  const [videoStatus, setVideoStatus] = useState<'idle' | 'creating' | 'error'>('idle');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (initialNodeKey?.startsWith('neuroscience.')) {
      setActiveDomain('neuroscience');
    } else if (initialNodeKey?.startsWith('physics.')) {
      setActiveDomain('physics');
    }
  }, [initialNodeKey]);

  useEffect(() => {
    let mounted = true;
    setStatus('loading');
    setErrorMessage(null);

    Promise.all([
      listFoundationKnowledgeNodes({ domain: activeDomain }),
      listFoundationKnowledgeEdges({ domain: activeDomain }),
    ])
      .then(([nodeResponse, edgeResponse]) => {
        if (!mounted) return;
        setNodes(nodeResponse.items);
        setEdges(edgeResponse.items);
        setSelectedKey((current) => (
          initialNodeKey && nodeResponse.items.some((node) => node.key === initialNodeKey)
            ? initialNodeKey
            : current && nodeResponse.items.some((node) => node.key === current)
            ? current
            : nodeResponse.items[0]?.key ?? null
        ));
        setStatus('ready');
      })
      .catch((error) => {
        if (!mounted) return;
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : '基础科学节点加载失败');
      });

    return () => {
      mounted = false;
    };
  }, [activeDomain, initialNodeKey, reloadKey]);

  const meta = DOMAIN_META[activeDomain];
  const selectedNode = useMemo(
    () => nodes.find((node) => node.key === selectedKey) ?? nodes[0],
    [nodes, selectedKey],
  );
  const visibleNodes = nodes.map(compactNode);
  const nodeEdges = selectedNode
    ? edges.filter((edge) => edge.source === selectedNode.key || edge.target === selectedNode.key).slice(0, 3)
    : [];
  const explorationTasks = selectedNode ? buildExplorationTasks(selectedNode) : [];
  const completedCount = selectedNode
    ? explorationTasks.filter((task) => completedTasks[`${selectedNode.key}:${task.id}`] === 'success').length
    : 0;

  useEffect(() => {
    setVideoJob(null);
    setVideoStatus('idle');
    setExplorationMessage(null);
  }, [selectedKey]);

  useEffect(() => {
    if (!videoJob?.id || videoJob.status === 'ready' || videoJob.status === 'failed') return;
    const timeout = window.setTimeout(() => {
      refreshMobiusMediaJob(videoJob.id)
        .then(setVideoJob)
        .catch(() => {
          setVideoJob((current) => current ? {
            ...current,
            status: 'failed',
            errorMessage: '视频状态刷新失败。',
          } : current);
        });
    }, 2600);

    return () => window.clearTimeout(timeout);
  }, [videoJob]);

  const handleCompleteTask = async (task: ReturnType<typeof buildExplorationTasks>[number], outcome: 'success' | 'failure' = 'success') => {
    if (!selectedNode) return;
    setExplorationStatus('saving');
    setExplorationMessage(null);
    try {
      const result = await recordFoundationExploration(studentId, {
        nodeKey: selectedNode.key,
        nodeLabel: selectedNode.label,
        domain: selectedNode.domain,
        coreQuestion: selectedNode.coreQuestion,
        taskId: task.id,
        taskLabel: task.label,
        actionType: task.actionType,
        outcome,
        note: task.detail,
      });
      setCompletedTasks((current) => ({
        ...current,
        [`${selectedNode.key}:${task.id}`]: result.outcome,
      }));
      setExplorationMessage(`已写入 learning cycle：${result.stateVectorVersion ?? result.cycleId}`);
      onExplorationRecorded?.();
      setExplorationStatus('idle');
    } catch (error) {
      setExplorationStatus('error');
      setExplorationMessage(error instanceof Error ? error.message : '探索记录写入失败');
    }
  };

  const handleCreateFoundationVideo = async () => {
    if (!selectedNode) return;
    setVideoStatus('creating');
    setExplorationMessage(null);
    try {
      const job = await createKnowledgeNodeVideo(studentId, selectedNode.key, {
        nodeLabel: selectedNode.label,
        domain: selectedNode.domain,
        coreQuestion: selectedNode.coreQuestion,
        curriculumNode: selectedNode.relatedCurriculumNodes[0],
        storyboardSeed: selectedNode.mediaPromptSeed.seedanceStoryboard,
        relatedConcepts: selectedNode.keywords.slice(0, 6),
        relatedErrors: selectedNode.relatedMistakePatterns,
        firstFrameUrl: meta.image,
      });
      setVideoJob(job);
      setVideoStatus('idle');
    } catch (error) {
      setVideoStatus('error');
      setExplorationMessage(error instanceof Error ? error.message : '知识点漫剧任务创建失败');
    }
  };

  return (
    <motion.div
      key="foundation-science"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      className="absolute inset-0 flex h-full w-full flex-col overflow-hidden bg-[#07111f] pb-24 text-white"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(76,201,240,0.22),transparent_30%),radial-gradient(circle_at_82%_20%,rgba(255,184,77,0.18),transparent_28%),radial-gradient(circle_at_50%_92%,rgba(120,119,255,0.2),transparent_32%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:28px_28px]" />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-3 pt-3">
        <header className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="grid h-10 w-10 place-items-center rounded-2xl border border-white/14 bg-white/10 text-white shadow-[0_12px_24px_rgba(0,0,0,0.22)]"
            aria-label="返回"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/70">Foundation Science</p>
            <h1 className="truncate text-[22px] font-black leading-tight">基础科学双引擎</h1>
          </div>
          <div className="flex h-10 items-center gap-1.5 rounded-2xl border border-white/14 bg-white/10 px-3 text-[11px] font-black text-cyan-50">
            <Network size={15} />
            {nodes.length || 18}
          </div>
        </header>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {(['physics', 'neuroscience'] as FoundationScienceDomain[]).map((domain) => {
            const item = DOMAIN_META[domain];
            const active = domain === activeDomain;
            return (
              <button
                key={domain}
                type="button"
                onClick={() => setActiveDomain(domain)}
                className={`min-h-[74px] rounded-2xl border px-3 py-2 text-left transition ${
                  active ? 'border-white/28 bg-white/16 shadow-[0_16px_34px_rgba(0,0,0,0.22)]' : 'border-white/10 bg-white/7'
                }`}
                style={{ boxShadow: active ? `0 0 28px ${item.glow}` : undefined }}
              >
                <div className="flex items-center gap-2" style={{ color: item.accent }}>
                  {item.icon}
                  <span className="text-[10px] font-black uppercase tracking-[0.14em]">{item.title}</span>
                </div>
                <p className="mt-1 text-[16px] font-black text-white">{item.label}</p>
                <p className="mt-0.5 text-[10px] font-bold text-white/58">{item.subtitle}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-[26px] border border-white/10 bg-white/[0.06] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <section className="overflow-hidden rounded-[22px] border border-white/10 bg-[#020817]">
            <div className="relative aspect-[1.18] overflow-hidden">
              <img
                src={meta.image}
                alt={`${meta.label}基础框架`}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(2,8,23,0.94))] px-3 pb-3 pt-10">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: meta.accent }}>{meta.title}</p>
                    <h2 className="mt-1 text-[23px] font-black leading-none">{meta.subtitle}</h2>
                    <p className="mt-1 max-w-[240px] text-[11px] font-bold leading-4 text-white/70">{meta.promise}</p>
                  </div>
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/14 bg-white/12" style={{ color: meta.accent }}>
                    {meta.icon}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {status === 'error' ? (
            <div className="mt-3 rounded-2xl border border-red-300/20 bg-red-400/10 px-3 py-3">
              <p className="text-sm font-black text-red-100">基础科学节点暂未加载</p>
              <p className="mt-1 text-xs font-bold text-red-100/70">{errorMessage}</p>
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white/12 px-3 py-2 text-xs font-black text-white"
              >
                <RefreshCw size={13} />
                重试
              </button>
            </div>
          ) : null}

          <section className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/10 bg-white/9 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/46">Nodes</p>
              <p className="mt-1 text-xl font-black">{nodes.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/9 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/46">Links</p>
              <p className="mt-1 text-xl font-black">{edges.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/9 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/46">Mode</p>
              <p className="mt-1 text-sm font-black leading-6">全局先行</p>
            </div>
          </section>

          <section className="mt-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/60">一级节点</p>
              <span className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-[10px] font-black text-white/64">先全局后局部</span>
            </div>
            <div className="grid gap-2">
              {(status === 'loading' ? Array.from({ length: 4 }) : visibleNodes).map((node, index) => {
                if (!('key' in node)) {
                  return <div key={index} className="h-20 animate-pulse rounded-2xl bg-white/8" />;
                }
                const active = selectedNode?.key === node.key;
                return (
                  <button
                    key={node.key}
                    type="button"
                    onClick={() => setSelectedKey(node.key)}
                    className={`rounded-2xl border px-3 py-3 text-left transition ${
                      active ? 'border-white/24 bg-white/16' : 'border-white/8 bg-white/7'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-xl text-[11px] font-black text-[#07111f]" style={{ backgroundColor: meta.accent }}>
                            {index + 1}
                          </span>
                          <p className="truncate text-[14px] font-black text-white">{node.label}</p>
                        </div>
                        <p className="mt-2 text-[11px] font-bold leading-4 text-white/62">{node.shortSummary}</p>
                      </div>
                      <ChevronRight size={16} className={`mt-1 shrink-0 ${active ? 'text-white' : 'text-white/36'}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {selectedNode ? (
            <section className="mt-3 rounded-[22px] border border-white/10 bg-[#f8fbff] px-3 py-3 text-[#111827]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">当前探索节点</p>
                  <h3 className="mt-1 text-[18px] font-black leading-tight">{selectedNode.label}</h3>
                </div>
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white" style={{ backgroundColor: meta.accent }}>
                  <Sparkles size={17} />
                </div>
              </div>
              <p className="mt-2 text-sm font-bold leading-5 text-gray-700">{selectedNode.coreQuestion}</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-gray-500">{selectedNode.summary}</p>

              <div className="mt-3 rounded-2xl border border-gray-200 bg-white px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">Seedance 分镜种子</p>
                <div className="mt-2 space-y-1.5">
                  {selectedNode.mediaPromptSeed.seedanceStoryboard.map((beat, index) => (
                    <p key={beat} className="text-[11px] font-bold leading-4 text-gray-600">
                      {index + 1}. {beat}
                    </p>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {selectedNode.keywords.slice(0, 5).map((keyword) => (
                  <span key={keyword} className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-black text-gray-600">
                    {keyword}
                  </span>
                ))}
              </div>

              <div className="mt-3 grid gap-2">
                {nodeEdges.map((edge) => (
                  <div key={`${edge.source}-${edge.target}-${edge.kind}`} className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">{edge.kind}</p>
                    <p className="mt-1 text-[11px] font-bold leading-4 text-gray-600">{edge.rationale}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-2xl border border-gray-200 bg-white px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">探索任务</p>
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-black text-gray-500">
                    {completedCount}/{explorationTasks.length}
                  </span>
                </div>
                <div className="mt-2 grid gap-2">
                  {explorationTasks.map((task) => {
                    const taskState = completedTasks[`${selectedNode.key}:${task.id}`];
                    return (
                      <button
                        key={task.id}
                        type="button"
                        disabled={explorationStatus === 'saving'}
                        onClick={() => { void handleCompleteTask(task); }}
                        className={`rounded-2xl border px-3 py-2 text-left transition ${
                          taskState === 'success'
                            ? 'border-emerald-200 bg-emerald-50'
                            : 'border-gray-200 bg-gray-50 active:scale-[0.99]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-black text-gray-800">{task.label}</p>
                            <p className="mt-1 text-[11px] font-semibold leading-4 text-gray-500">{task.detail}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-black text-gray-500">
                            {taskState === 'success' ? '已记录' : task.actionType}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {explorationMessage ? (
                <p className={`mt-3 rounded-2xl px-3 py-2 text-[11px] font-bold ${
                  explorationStatus === 'error' || videoStatus === 'error'
                    ? 'bg-red-50 text-red-600'
                    : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {explorationMessage}
                </p>
              ) : null}

              {videoJob ? (
                <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">Seedance 任务</p>
                  <p className="mt-1 text-xs font-bold text-gray-700">
                    {videoJob.status === 'ready' ? '视频已就绪' : videoJob.status === 'failed' ? '视频生成失败' : '视频生成中'}
                    {videoJob.provider ? ` // ${videoJob.provider}` : ''}
                  </p>
                  {videoJob.playbackUrl ? (
                    <video
                      className="mt-2 aspect-[9/16] w-full rounded-2xl bg-black"
                      src={videoJob.playbackUrl}
                      controls
                      playsInline
                    />
                  ) : null}
                  {videoJob.errorMessage ? (
                    <p className="mt-1 text-[11px] font-semibold text-red-500">{videoJob.errorMessage}</p>
                  ) : null}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => { void handleCreateFoundationVideo(); }}
                disabled={videoStatus === 'creating'}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#111827] px-4 py-3 text-sm font-black text-white disabled:opacity-60"
              >
                <Play size={15} />
                {videoStatus === 'creating' ? '正在创建漫剧任务' : '生成知识点漫剧'}
              </button>
            </section>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
