import React from 'react';
import { motion } from 'motion/react';
import { Check, ChevronRight, Compass, Play, RefreshCw, ScrollText, Sparkles } from 'lucide-react';
import type { ExploreEngineKey } from '../../features/explore/data/exploreTypes';
import KnowledgeGraphSummary, { type LinkedKnowledgeGraphError } from '../error-book/KnowledgeGraphSummary';
import type { KnowledgeGraphSnapshot } from '../../lib/mobius';
import WindPage from '../layout/WindPage';
import GameButton from '../ui/GameButton';
import MissionBadge from '../ui/MissionBadge';
import ParchmentPanel from '../ui/ParchmentPanel';

type SubjectKey = 'zh' | 'ma' | 'en';
type ErrorFilter = 'all' | SubjectKey;
type InteractionOutcome = 'success' | 'failure' | null | undefined;

interface StudentStateSummaryLite {
  interactionStats?: {
    lastOutcome?: InteractionOutcome;
    successCount?: number;
    failureCount?: number;
  };
  recentPainPoints?: string[];
}

interface ErrorBookCardView {
  id: string;
  subject: SubjectKey;
  subjectName: string;
  subjectShort: string;
  subjectColor: string;
  subjectBadgeTextColor: string;
  node: string;
  summary: string;
  recencyLabel: string;
  isRecommended: boolean;
  isGraphFocused: boolean;
  exploreRecommendation?: {
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
  } | null;
}

interface ErrorBookFocusContextView {
  subject: SubjectKey;
  node: string;
  errorId?: string | null;
  source: 'map' | 'graph' | 'task';
}

interface KnowledgeGraphNoticeView {
  tone: 'info' | 'success' | 'warning';
  message: string;
}

interface ErrorBookViewProps {
  studentStateSummary: StudentStateSummaryLite | null;
  knowledgeGraph: KnowledgeGraphSnapshot | null;
  knowledgeGraphStatus: 'idle' | 'loading' | 'refreshing' | 'ready' | 'error';
  knowledgeGraphError: string | null;
  knowledgeGraphNotice: KnowledgeGraphNoticeView | null;
  focusContext: ErrorBookFocusContextView | null;
  graphLinkedErrors: LinkedKnowledgeGraphError[];
  recommendedErrorId?: string | null;
  onRefreshKnowledgeGraph: () => void;
  onFocusGraphError: (errorId: string) => void;
  errorStats: { total: number; zh: number; ma: number; en: number };
  errorFilter: ErrorFilter;
  onFilterChange: (value: ErrorFilter) => void;
  errorCards: ErrorBookCardView[];
  registerCardRef: (id: string, node: HTMLDivElement | null) => void;
  onStartContinuousPractice: (index: number) => void;
  onGenerateTheater: (errorId: string) => void;
  onMarkMastered: (errorId: string) => void;
  onOpenExploreNode: (engineKey: ExploreEngineKey, nodeKey: string) => void;
}

export default function ErrorBookView({
  studentStateSummary,
  knowledgeGraph,
  knowledgeGraphStatus,
  knowledgeGraphError,
  knowledgeGraphNotice,
  focusContext,
  graphLinkedErrors,
  recommendedErrorId,
  onRefreshKnowledgeGraph,
  onFocusGraphError,
  errorStats,
  errorFilter,
  onFilterChange,
  errorCards,
  registerCardRef,
  onStartContinuousPractice,
  onGenerateTheater,
  onMarkMastered,
  onOpenExploreNode,
}: ErrorBookViewProps) {
  const successCount = studentStateSummary?.interactionStats?.successCount ?? 0;
  const failureCount = studentStateSummary?.interactionStats?.failureCount ?? 0;

  return (
    <motion.div
      key="error-book"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="vl-page absolute inset-0 flex h-full w-full min-h-0 flex-col overflow-hidden pb-24"
    >
      <div className="flex-1 min-h-0 overflow-y-auto p-5 pt-8 touch-pan-y">
        <MissionBadge tone="main" icon={<ScrollText size={14} />}>修复委托所</MissionBadge>
        <h2 className="mt-4 flex items-center gap-2 text-3xl font-display font-bold text-[#1a1a2e]">
          今日错题任务卷轴
        </h2>
        <p className="mb-6 mt-2 text-sm font-bold text-gray-500">每张错题都变成一个可回收的修复委托，完成后回流到知识航线。</p>

        {focusContext ? (
          <ParchmentPanel className="mb-5 rounded-[26px] p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--color-primary)]">当前节点</p>
            <div className="mt-2 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-[#1a1a2e]">
                  {focusContext.node}
                </h3>
                <p className="mt-1 text-sm font-bold leading-6 text-gray-600">
                  {focusContext.source === 'map'
                    ? '你是从学科岛点进来的，当前修复上下文已经锁定到这个节点。'
                    : focusContext.source === 'graph'
                      ? '你是从知识图谱跳过来的，当前节点已经对准这张错题卡。'
                      : '当前任务已经锁定到这个节点，直接沿这条线收口即可。'}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-[#1a1a2e]/10 bg-white px-3 py-1 text-[11px] font-black text-[#1a1a2e]">
                {focusContext.errorId ? '已锁定修复委托' : '暂无精确委托，先看关联任务'}
              </span>
            </div>
          </ParchmentPanel>
        ) : null}

        <div className="crystal-panel vl-surface mb-5 overflow-hidden rounded-[30px] p-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="mb-1 text-xs font-bold text-white/60">世界线裁决摘要</p>
              <p className="font-bold text-sm leading-relaxed">
                {studentStateSummary?.interactionStats?.lastOutcome === 'success'
                  ? '最近一次剧场裁决命中了规则，可以继续做窄提示强化。'
                  : studentStateSummary?.interactionStats?.lastOutcome === 'failure'
                    ? '最近一次剧场裁决未命中规则，当前更适合保护性引导。'
                    : '还没有足够的长期裁决数据，先从首轮剧场重构开始。'}
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xl font-display font-bold text-[var(--color-secondary)]">
                {successCount}/{successCount + failureCount}
              </div>
              <div className="text-[10px] font-bold text-white/60">航线稳定</div>
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

        <KnowledgeGraphSummary
          knowledgeGraph={knowledgeGraph}
          status={knowledgeGraphStatus}
          errorMessage={knowledgeGraphError}
          notice={knowledgeGraphNotice}
          linkedErrors={graphLinkedErrors}
          recommendedErrorId={recommendedErrorId}
          onRefresh={onRefreshKnowledgeGraph}
          onFocusError={onFocusGraphError}
        />

        <div className="mb-5 grid grid-cols-4 gap-2">
          <ParchmentPanel className="rounded-[18px] p-3 text-center">
            <div className="text-2xl font-display font-bold text-[#1a1a2e]">{errorStats.total}</div>
            <div className="mt-1 text-[10px] font-bold text-gray-500">总委托</div>
          </ParchmentPanel>
          <ParchmentPanel className="rounded-[18px] p-3 text-center" style={{ backgroundColor: 'rgba(255,93,115,0.12)' }}>
            <div className="text-2xl font-display font-bold" style={{ color: 'var(--color-subj-zh)' }}>{errorStats.zh}</div>
            <div className="text-[10px] font-bold text-gray-500 mt-1">语文</div>
          </ParchmentPanel>
          <ParchmentPanel className="rounded-[18px] p-3 text-center" style={{ backgroundColor: 'rgba(0,180,216,0.12)' }}>
            <div className="text-2xl font-display font-bold" style={{ color: 'var(--color-subj-ma)' }}>{errorStats.ma}</div>
            <div className="text-[10px] font-bold text-gray-500 mt-1">数学</div>
          </ParchmentPanel>
          <ParchmentPanel className="rounded-[18px] p-3 text-center" style={{ backgroundColor: 'rgba(255,190,11,0.14)' }}>
            <div className="text-2xl font-display font-bold" style={{ color: 'var(--color-subj-en)' }}>{errorStats.en}</div>
            <div className="text-[10px] font-bold text-gray-500 mt-1">英语</div>
          </ParchmentPanel>
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          {([
            ['all', '全部'],
            ['zh', '语文'],
            ['ma', '数学'],
            ['en', '英语'],
          ] as [ErrorFilter, string][]).map(([value, label]) => (
            <GameButton
              key={value}
              onClick={() => onFilterChange(value)}
              variant={errorFilter === value ? 'primary' : 'parchment'}
              className="whitespace-nowrap px-4 py-2 text-sm"
            >
              {label}
            </GameButton>
          ))}
        </div>

        <div className="space-y-4">
          {errorCards.length === 0 ? (
            <div className="mt-10 rounded-[24px] border-2 border-dashed border-gray-200 p-8 text-center font-bold text-gray-400">
              当前筛选下没有待修复错题，继续保持这条线的稳定输出。
            </div>
          ) : (
            errorCards.map((card, index) => (
              <div
                key={card.id || index}
                ref={(node) => registerCardRef(card.id, node)}
                className="parchment-panel vl-surface relative flex flex-col rounded-[24px] p-4"
                style={{
                  borderLeftWidth: 8,
                  borderLeftColor: card.subjectColor,
                  boxShadow: card.isGraphFocused
                    ? '0 0 0 3px rgba(61,123,255,0.22), 4px 4px 0 rgba(26,26,46,0.18)'
                    : card.isRecommended
                      ? '0 0 0 3px rgba(255,190,11,0.25), 4px 4px 0 rgba(26,26,46,0.18)'
                      : undefined,
                }}
              >
                {card.isRecommended && (
                  <div className="absolute right-3 top-3 rounded-full bg-[var(--color-secondary)] px-3 py-1 text-[10px] font-black text-[#1a1a2e] shadow-[0_10px_18px_rgba(255,138,61,0.2)]">
                    主线委托
                  </div>
                )}
                <div className="flex justify-between items-start gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold px-2 py-1 rounded border-2 border-[#1a1a2e]" style={{ backgroundColor: card.subjectColor, color: card.subjectBadgeTextColor }}>
                        {card.subjectName}
                      </span>
                      <span className="text-[11px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded border border-gray-200">
                        {card.recencyLabel}
                      </span>
                    </div>
                    <h4 className="font-bold text-lg text-[#1a1a2e] line-clamp-2">{card.node}</h4>
                  </div>
                  <MissionBadge tone="danger" className="whitespace-nowrap">待修复</MissionBadge>
                </div>

                <p className="text-sm text-gray-600 font-medium leading-relaxed mb-3">{card.summary}</p>

                {card.exploreRecommendation ? (
                  <div className="mb-4 overflow-hidden rounded-[22px] border border-[#1a1a2e]/10 bg-[linear-gradient(135deg,#f8fbff_0%,#fff7ea_100%)]">
                    <div className="border-b border-[#1a1a2e]/8 bg-white/70 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-2xl text-white shadow-[0_10px_18px_rgba(26,26,46,0.12)]"
                            style={{ backgroundColor: card.exploreRecommendation.primaryNode.accentColor }}
                          >
                            <Compass size={15} />
                          </span>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">推荐探索节点</p>
                            <h5 className="text-sm font-black leading-tight text-[#1a1a2e]">
                              {card.exploreRecommendation.primaryNode.engineTitle} / {card.exploreRecommendation.primaryNode.label}
                            </h5>
                          </div>
                        </div>
                        <Sparkles size={16} className="shrink-0 text-[var(--color-secondary)]" />
                      </div>
                    </div>
                    <div className="px-3 py-3">
                      <p className="text-[12px] font-black text-[#1a1a2e]">
                        为什么推荐：{card.exploreRecommendation.mistakeTitle}
                      </p>
                      <p className="mt-1 text-[11px] font-bold leading-4 text-gray-600">
                        {card.exploreRecommendation.mistakeDescription}
                      </p>
                      <p className="mt-2 rounded-2xl bg-white px-3 py-2 text-[11px] font-bold leading-4 text-gray-600">
                        修复动作：{card.exploreRecommendation.repairAction}
                      </p>
                      {card.exploreRecommendation.secondaryNodes.length ? (
                        <div className="mt-2 flex gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                          {card.exploreRecommendation.secondaryNodes.map((node) => (
                            <span key={node.key} className="whitespace-nowrap rounded-full border border-gray-200 bg-white px-2 py-1 text-[10px] font-black text-gray-500">
                              {node.engineTitle} / {node.label}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onOpenExploreNode(
                          card.exploreRecommendation!.primaryNode.engineKey,
                          card.exploreRecommendation!.primaryNode.key,
                        )}
                        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-[#111827] px-3 py-2.5 text-xs font-black text-white shadow-[0_12px_22px_rgba(17,24,39,0.18)]"
                      >
                        进入探索节点
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="flex gap-2 mb-4 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                  <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600 whitespace-nowrap">{card.subjectShort}薄弱点</span>
                  <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600 whitespace-nowrap">点击可重做</span>
                  <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600 whitespace-nowrap">{card.node}</span>
                  {card.isRecommended && (
                    <span className="rounded-full bg-[var(--color-secondary)]/20 px-2 py-1 text-xs font-bold text-[#1a1a2e] whitespace-nowrap">长期状态推荐</span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 mt-auto">
                  <GameButton
                    onClick={() => onStartContinuousPractice(index)}
                    variant="parchment"
                    icon={<RefreshCw size={14} />}
                    className="py-3 text-sm text-gray-700"
                  >
                    继续探索
                  </GameButton>
                  <GameButton
                    onClick={() => onGenerateTheater(card.id)}
                    variant="primary"
                    icon={<Play size={14} />}
                    className="py-3 text-sm"
                  >
                    剧场干预
                  </GameButton>
                  <GameButton
                    onClick={() => onMarkMastered(card.id)}
                    variant="success"
                    icon={<Check size={14} />}
                    className="py-3 text-sm"
                  >
                    已稳定
                  </GameButton>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}
