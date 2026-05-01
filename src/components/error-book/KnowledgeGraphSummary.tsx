import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Image, Loader2, Network, Play, RefreshCw, Sparkles } from 'lucide-react';
import {
  createKnowledgeNodeVideo,
  generateKnowledgeMapAsset,
  listKnowledgeMapAssets,
  refreshMobiusMediaJob,
  type GeneratedKnowledgeMapAsset,
  type KnowledgeGraphSnapshot,
  type MobiusMediaJobResponse,
} from '../../lib/mobius';
import GameButton from '../ui/GameButton';
import MissionBadge from '../ui/MissionBadge';
import ParchmentPanel from '../ui/ParchmentPanel';

export interface LinkedKnowledgeGraphError {
  id: string;
  title: string;
  detail: string;
  subject: 'zh' | 'ma' | 'en';
  subjectLabel: string;
  node: string;
  statusLabel: string;
}

interface KnowledgeGraphSummaryProps {
  knowledgeGraph: KnowledgeGraphSnapshot | null;
  status: 'idle' | 'loading' | 'refreshing' | 'ready' | 'error';
  errorMessage?: string | null;
  notice?: {
    tone: 'info' | 'success' | 'warning';
    message: string;
  } | null;
  linkedErrors: LinkedKnowledgeGraphError[];
  recommendedErrorId?: string | null;
  onRefresh: () => void;
  onFocusError?: (errorId: string) => void;
}

const formatTimestamp = (value?: string) => {
  if (!value) return '尚未同步';

  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
};

export default function KnowledgeGraphSummary({
  knowledgeGraph,
  status,
  errorMessage,
  notice,
  linkedErrors,
  recommendedErrorId,
  onRefresh,
  onFocusError,
}: KnowledgeGraphSummaryProps) {
  const nodes = knowledgeGraph?.nodes ?? [];
  const edges = knowledgeGraph?.edges ?? [];
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(nodes[0]?.key ?? null);
  const [selectedSubject, setSelectedSubject] = useState<'all' | 'zh' | 'ma' | 'en'>('all');
  const [assets, setAssets] = useState<GeneratedKnowledgeMapAsset[]>([]);
  const [assetStatus, setAssetStatus] = useState<'idle' | 'loading' | 'generating' | 'error'>('idle');
  const [assetError, setAssetError] = useState<string | null>(null);
  const [videoJobs, setVideoJobs] = useState<Record<string, MobiusMediaJobResponse>>({});
  const [videoLoadingNodeKey, setVideoLoadingNodeKey] = useState<string | null>(null);

  useEffect(() => {
    if (!nodes.length) {
      setSelectedNodeKey(null);
      return;
    }

    if (!selectedNodeKey || !nodes.some((node) => node.key === selectedNodeKey)) {
      setSelectedNodeKey(nodes[0].key);
    }
  }, [nodes, selectedNodeKey]);

  useEffect(() => {
    if (!knowledgeGraph?.studentId) {
      setAssets([]);
      return;
    }

    let cancelled = false;
    setAssetStatus('loading');
    listKnowledgeMapAssets(knowledgeGraph.studentId)
      .then((items) => {
        if (cancelled) return;
        setAssets(items);
        setAssetStatus('idle');
        setAssetError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setAssetStatus('error');
        setAssetError(error instanceof Error ? error.message : '知识地图资产加载失败');
      });

    return () => {
      cancelled = true;
    };
  }, [knowledgeGraph?.studentId, knowledgeGraph?.updatedAt]);

  const selectedNode = nodes.find((node) => node.key === selectedNodeKey) ?? nodes[0];
  const nodeCardAsset = useMemo(
    () =>
      selectedNode
        ? assets.find((asset) =>
            asset.kind === 'node-card' &&
            asset.status === 'ready' &&
            asset.promptJson.nodeKey === selectedNode.key &&
            asset.urlOrBlobRef)
        : undefined,
    [assets, selectedNode],
  );
  const subjectOptions = useMemo(
    () =>
      [
        { key: 'all' as const, label: '全部' },
        ...(['zh', 'ma', 'en'] as const)
          .filter((subject) => linkedErrors.some((item) => item.subject === subject))
          .map((subject) => ({
            key: subject,
            label: linkedErrors.find((item) => item.subject === subject)?.subjectLabel ?? subject,
          })),
      ],
    [linkedErrors],
  );

  const subjectFilteredErrors = useMemo(() => {
    if (selectedSubject === 'all') return linkedErrors;
    return linkedErrors.filter((item) => item.subject === selectedSubject);
  }, [linkedErrors, selectedSubject]);

  const relatedEdges = useMemo(() => {
    if (!selectedNode) return [];
    return edges
      .filter((edge) => edge.source === selectedNode.key || edge.target === selectedNode.key)
      .sort((left, right) => right.weight - left.weight)
      .slice(0, 5);
  }, [edges, selectedNode]);

  const relatedConceptLabels = useMemo(() => {
    if (!selectedNode) return [];
    return relatedEdges.map((edge) => {
      const counterpartKey = edge.source === selectedNode.key ? edge.target : edge.source;
      return nodes.find((node) => node.key === counterpartKey)?.label ?? counterpartKey;
    });
  }, [nodes, relatedEdges, selectedNode]);

  const relatedErrors = useMemo(() => {
    if (!selectedNode) return [];
    return subjectFilteredErrors.filter((item) => item.node === selectedNode.label).slice(0, 4);
  }, [selectedNode, subjectFilteredErrors]);

  const nextStepError = useMemo(() => {
    return (
      relatedErrors.find((item) => item.id === recommendedErrorId) ??
      relatedErrors[0] ??
      subjectFilteredErrors.find((item) => item.id === recommendedErrorId) ??
      subjectFilteredErrors[0] ??
      null
    );
  }, [recommendedErrorId, relatedErrors, subjectFilteredErrors]);

  const mapLayout = useMemo(() => {
    const visibleNodes = nodes.slice().sort((left, right) => right.weight - left.weight).slice(0, 10);
    const centerX = 180;
    const centerY = 140;
    const radiusX = 130;
    const radiusY = 88;

    return visibleNodes.map((node, index) => {
      if (index === 0) {
        return { node, x: centerX, y: centerY, r: 32 };
      }
      const angle = ((index - 1) / Math.max(1, visibleNodes.length - 1)) * Math.PI * 2 - Math.PI / 2;
      return {
        node,
        x: centerX + Math.cos(angle) * radiusX,
        y: centerY + Math.sin(angle) * radiusY,
        r: 18 + Math.min(12, node.weight * 2),
      };
    });
  }, [nodes]);

  const handleGenerateNodeCard = async () => {
    if (!knowledgeGraph?.studentId || !selectedNode) return;
    setAssetStatus('generating');
    setAssetError(null);
    try {
      const asset = await generateKnowledgeMapAsset(knowledgeGraph.studentId, {
        kind: 'node-card',
        nodeKey: selectedNode.key,
        relatedErrors: relatedErrors.map((item) => item.title),
      });
      setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      setAssetStatus('idle');
    } catch (error) {
      setAssetStatus('error');
      setAssetError(error instanceof Error ? error.message : '节点卡图生成失败');
    }
  };

  const handleCreateNodeVideo = async () => {
    if (!knowledgeGraph?.studentId || !selectedNode) return;
    setVideoLoadingNodeKey(selectedNode.key);
    try {
      const firstFrame = nodeCardAsset ?? await generateKnowledgeMapAsset(knowledgeGraph.studentId, {
        kind: 'video-first-frame',
        nodeKey: selectedNode.key,
        relatedErrors: relatedErrors.map((item) => item.title),
      });
      setAssets((current) => [firstFrame, ...current.filter((item) => item.id !== firstFrame.id)]);
      const job = await createKnowledgeNodeVideo(knowledgeGraph.studentId, selectedNode.key, {
        nodeLabel: selectedNode.label,
        relatedConcepts: relatedConceptLabels,
        relatedErrors: relatedErrors.map((item) => item.title),
        firstFrameAssetId: firstFrame.id,
      });
      setVideoJobs((current) => ({ ...current, [selectedNode.key]: job }));
    } catch (error) {
      setAssetError(error instanceof Error ? error.message : '节点视频任务创建失败');
    } finally {
      setVideoLoadingNodeKey(null);
    }
  };

  const currentVideoJob = selectedNode ? videoJobs[selectedNode.key] : undefined;

  useEffect(() => {
    if (!currentVideoJob?.id || currentVideoJob.status === 'ready' || currentVideoJob.status === 'failed' || !selectedNode) return;
    const timeout = window.setTimeout(() => {
      refreshMobiusMediaJob(currentVideoJob.id)
        .then((job) => {
          setVideoJobs((current) => ({ ...current, [selectedNode.key]: job }));
        })
        .catch(() => {
          setVideoJobs((current) => ({
            ...current,
            [selectedNode.key]: {
              ...currentVideoJob,
              status: 'failed',
              errorMessage: '视频状态刷新失败，已保留文本剧场降级。',
            },
          }));
        });
    }, 2500);

    return () => window.clearTimeout(timeout);
  }, [currentVideoJob, selectedNode]);

  const statusLabel = (() => {
    if (status === 'loading') return '图谱首次加载中';
    if (status === 'refreshing') return '图谱编织刷新中';
    if (status === 'error') return '图谱同步异常';
    if (nodes.length) return '图谱已联通';
    return '等待图谱沉淀';
  })();

  const statusTone = (() => {
    if (status === 'error') return 'border-red-200 bg-red-50 text-red-600';
    if (status === 'loading' || status === 'refreshing') return 'border-[var(--color-secondary)]/20 bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]';
    return 'border-[var(--color-primary)]/20 bg-[var(--color-primary)]/10 text-[var(--color-primary)]';
  })();

  const noticeTone = (() => {
    if (!notice) return '';
    if (notice.tone === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (notice.tone === 'warning') return 'border-amber-200 bg-amber-50 text-amber-700';
    return 'border-[var(--color-secondary)]/20 bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]';
  })();

  return (
    <ParchmentPanel className="mb-5 rounded-[24px] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-[var(--color-primary)] mb-1">知识星图编织结果</p>
          <p className="text-sm font-bold text-[#1a1a2e] leading-relaxed">
            {nodes.length
              ? '这里不再只是告诉你“有图谱”，而是把当前最缠绕的知识团、相邻概念和对应错题直接摊开。'
              : '当前还没有足够的图谱节点。继续沉淀错题后，这里会自动长出高频概念网络。'}
          </p>
        </div>
        <GameButton
          onClick={onRefresh}
          disabled={status === 'loading' || status === 'refreshing'}
          variant="parchment"
          className="min-h-0 px-3 py-1.5 text-[11px] text-[var(--color-primary)]"
        >
          <RefreshCw size={12} className={status === 'loading' || status === 'refreshing' ? 'animate-spin' : ''} />
          {status === 'loading' || status === 'refreshing' ? '编织中...' : '刷新星图'}
        </GameButton>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className={`rounded-full border px-3 py-1 text-[11px] font-black ${statusTone}`}>{statusLabel}</span>
        <span className="rounded-full border border-[#1a1a2e]/10 bg-white px-3 py-1 text-[11px] font-black text-[#1a1a2e]">
          节点 {nodes.length}
        </span>
        <span className="rounded-full border border-[#1a1a2e]/10 bg-white px-3 py-1 text-[11px] font-black text-[#1a1a2e]">
          连边 {edges.length}
        </span>
        <span className="rounded-full border border-[#1a1a2e]/10 bg-white px-3 py-1 text-[11px] font-black text-gray-500">
          更新时间 {formatTimestamp(knowledgeGraph?.updatedAt)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {subjectOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setSelectedSubject(option.key)}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-black transition ${
              selectedSubject === option.key
                ? 'border-[#1a1a2e] bg-[#1a1a2e] text-white'
                : 'border-[#1a1a2e]/10 bg-white text-gray-500'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {errorMessage ? (
        <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-bold text-red-600">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>{errorMessage}</p>
          </div>
        </div>
      ) : null}

      {!errorMessage && notice ? (
        <div className={`mt-3 rounded-2xl border px-3 py-3 text-sm font-bold ${noticeTone}`}>
          <div className="flex items-start gap-2">
            <Sparkles size={16} className="mt-0.5 shrink-0" />
            <p>{notice.message}</p>
          </div>
        </div>
      ) : null}

      {nodes.length ? (
        <div className="mt-4 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <div className="crystal-panel vl-surface relative overflow-hidden rounded-[22px]">
              {nodeCardAsset?.urlOrBlobRef ? (
                <img
                  src={nodeCardAsset.urlOrBlobRef}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-25"
                />
              ) : null}
              <svg viewBox="0 0 360 280" className="relative z-10 h-[280px] w-full">
                <defs>
                  <linearGradient id="knowledge-node-gradient" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stopColor="#3d7bff" />
                    <stop offset="100%" stopColor="#00b4d8" />
                  </linearGradient>
                </defs>
                {edges.slice(0, 18).map((edge) => {
                  const source = mapLayout.find((item) => item.node.key === edge.source);
                  const target = mapLayout.find((item) => item.node.key === edge.target);
                  if (!source || !target) return null;
                  const active = selectedNode?.key === edge.source || selectedNode?.key === edge.target;
                  return (
                    <line
                      key={`${edge.source}-${edge.target}`}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={active ? '#3d7bff' : '#1a1a2e'}
                      strokeWidth={active ? 3 : 1.5}
                      strokeOpacity={active ? 0.52 : 0.12}
                    />
                  );
                })}
                {mapLayout.map(({ node, x, y, r }) => {
                  const active = selectedNode?.key === node.key;
                  return (
                    <g
                      key={node.key}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedNodeKey(node.key)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') setSelectedNodeKey(node.key);
                      }}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={x}
                        cy={y}
                        r={r}
                        fill={active ? 'url(#knowledge-node-gradient)' : 'rgba(255,255,255,0.92)'}
                        stroke={active ? '#ffd36a' : '#7dd3fc'}
                        strokeWidth={active ? 3 : 2}
                      />
                      <text
                        x={x}
                        y={y + r + 18}
                        textAnchor="middle"
                        className="fill-white text-[10px] font-black"
                      >
                        {node.label.length > 7 ? `${node.label.slice(0, 7)}...` : node.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="flex flex-wrap gap-2">
              {nodes
                .slice()
                .sort((left, right) => right.weight - left.weight)
                .slice(0, 8)
                .map((node) => (
                  <button
                    key={node.key}
                    onClick={() => setSelectedNodeKey(node.key)}
                    className={`rounded-full border px-3 py-2 text-[11px] font-black transition ${
                      selectedNode?.key === node.key
                        ? 'border-[var(--vl-line)] bg-[var(--vl-line)] text-[#122344] shadow-[2px_2px_0_rgba(26,26,46,0.16)]'
                        : 'border-[var(--color-primary)]/15 bg-white text-[#1a1a2e]'
                    }`}
                  >
                    {node.label} · x{node.weight}
                  </button>
                ))}
            </div>

            {selectedNode ? (
              <ParchmentPanel className="rounded-2xl px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--color-primary)]">当前焦点节点</p>
                    <h3 className="mt-1 text-lg font-black text-[#1a1a2e]">{selectedNode.label}</h3>
                  </div>
                  <div className="rounded-full bg-[var(--color-primary)]/10 px-3 py-1 text-[11px] font-black text-[var(--color-primary)]">
                    权重 {selectedNode.weight}
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-[#1a1a2e]/8 bg-[linear-gradient(135deg,rgba(61,123,255,0.06),rgba(255,255,255,0.96))] px-3 py-3">
                  <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-gray-500">
                    <Network size={13} />
                    相邻概念
                  </div>
                  <div className="mt-3 space-y-2">
                    {relatedEdges.length ? (
                      relatedEdges.map((edge) => {
                        const counterpartKey = edge.source === selectedNode.key ? edge.target : edge.source;
                        const counterpart = nodes.find((node) => node.key === counterpartKey);
                        return (
                          <div
                            key={`${edge.source}-${edge.target}`}
                            className="rounded-xl border border-gray-100 bg-white px-3 py-2 text-[11px] font-bold text-gray-600"
                          >
                            {selectedNode.label} ↔ {counterpart?.label ?? counterpartKey} · 共现 {edge.weight} 次
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm font-bold text-gray-500">这个节点刚起势，暂时还没和更多概念连成团。</p>
                    )}
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-[#1a1a2e]/10 bg-white px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-gray-500">生成媒体</p>
                      <p className="mt-1 text-xs font-bold leading-5 text-gray-600">
                        卡图由 GPT-image-2 通道生成；节点视频走 SeeDance provider，失败时保留当前图谱和文本剧场。
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleGenerateNodeCard}
                        disabled={assetStatus === 'generating'}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--color-primary)]/20 bg-[var(--color-primary)] px-3 py-2 text-[11px] font-black text-white disabled:opacity-60"
                      >
                        {assetStatus === 'generating' ? <Loader2 size={13} className="animate-spin" /> : <Image size={13} />}
                        生成卡图
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateNodeVideo}
                        disabled={videoLoadingNodeKey === selectedNode.key}
                        className="inline-flex items-center gap-1 rounded-full border border-[#1a1a2e] bg-[#1a1a2e] px-3 py-2 text-[11px] font-black text-white disabled:opacity-60"
                      >
                        {videoLoadingNodeKey === selectedNode.key ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                        生成视频
                      </button>
                    </div>
                  </div>

                  {assetError ? (
                    <p className="mt-2 text-xs font-bold text-red-600">{assetError}</p>
                  ) : null}

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-[11px] font-bold text-gray-600">
                      卡图：{nodeCardAsset ? `${nodeCardAsset.provider} · ready` : assetStatus === 'loading' ? '加载中' : '未生成'}
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-[11px] font-bold text-gray-600">
                      视频：{currentVideoJob ? `${currentVideoJob.provider} · ${currentVideoJob.status}` : '等待显式触发'}
                    </div>
                  </div>

                  {currentVideoJob?.playbackUrl && currentVideoJob.status === 'ready' ? (
                    <video
                      className="mt-3 aspect-video w-full rounded-2xl border border-[#1a1a2e]/10 bg-black object-cover"
                      src={currentVideoJob.playbackUrl}
                      controls
                    />
                  ) : null}
                </div>

                {nextStepError ? (
                  <div className="mt-3 rounded-2xl border border-[var(--color-secondary)]/20 bg-[var(--color-secondary)]/10 px-3 py-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--color-secondary)]">下一步先修哪里</p>
                    <p className="mt-2 text-sm font-black text-[#1a1a2e]">{nextStepError.title}</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-gray-600">
                      先围绕「{selectedNode?.label ?? nextStepError.node}」收口，这张卡最接近当前图谱焦点。
                    </p>
                    <button
                      type="button"
                      onClick={() => onFocusError?.(nextStepError.id)}
                      className="mt-3 inline-flex items-center rounded-full border border-[#1a1a2e] bg-[#1a1a2e] px-3 py-2 text-[11px] font-black text-white"
                    >
                      定位到错题卡
                    </button>
                  </div>
                ) : null}
              </ParchmentPanel>
            ) : null}
          </div>

          <div className="crystal-panel vl-surface rounded-2xl px-4 py-4 text-white">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-white/60">
              <Sparkles size={13} />
              关联修复委托
            </div>
            <div className="mt-3 space-y-3">
              {relatedErrors.length ? (
                relatedErrors.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-black text-white">{item.title}</p>
                      <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[10px] font-black text-white/80">
                        {item.subjectLabel}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-bold leading-5 text-white/70">{item.detail}</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-[11px] font-black text-cyan-200">{item.statusLabel}</p>
                      <button
                        type="button"
                        onClick={() => onFocusError?.(item.id)}
                        className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-black text-white"
                      >
                        去修委托
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-3 py-4">
                  <p className="text-sm font-bold leading-6 text-white/70">
                    {selectedNode
                      ? `在当前筛选下，还没有直接挂在「${selectedNode.label}」上的错题卡片。可以切回“全部”，或先沿相邻概念展开。`
                      : '当前还没有可挂接到图谱的错题。'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-[var(--color-primary)]/15 bg-white/70 px-4 py-5">
          <p className="text-sm font-bold text-gray-500 leading-6">
            错题还没积累到能织成关系网的程度。继续产生新的错题、完成一次失败分支或刷新图谱后，这里会开始出现高频节点与共现链路。
          </p>
        </div>
      )}
    </ParchmentPanel>
  );
}
