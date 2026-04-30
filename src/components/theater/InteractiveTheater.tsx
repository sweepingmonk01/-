import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Orbit, Volume2, VolumeX } from 'lucide-react';
import type { DashboardCognitiveProjection } from '../../../shared/cognitive-state';
import type { InteractionConfidence, StrategyCandidate, TheaterScript } from '../../lib/mobius';
import SocraticDiagnosticPanel from './SocraticDiagnosticPanel';
import { DRAW_ACTION_CHECKPOINTS, SELECT_ACTION_OPTIONS } from './theater-constants';
import type { TheaterMeta, TheaterMode } from './theater-types';

const isHlsStream = (value: string) => /\.m3u8($|\?)/i.test(value);

function TheaterVideo({
  src,
  onError,
}: {
  src: string;
  onError: () => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [hlsReady, setHlsReady] = React.useState(() => !isHlsStream(src));
  const [hlsFailed, setHlsFailed] = React.useState(false);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setHlsReady(!isHlsStream(src));
    setHlsFailed(false);

    if (!isHlsStream(src)) {
      video.src = src;
      return;
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      setHlsReady(true);
      return;
    }

    let cancelled = false;
    let hlsInstance: { destroy: () => void } | null = null;

    void import('hls.js')
      .then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) {
          setHlsFailed(true);
          onError();
          return;
        }

        const instance = new Hls();
        hlsInstance = instance;
        instance.loadSource(src);
        instance.attachMedia(video);
        instance.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!cancelled) {
            setHlsReady(true);
          }
        });
        instance.on(Hls.Events.ERROR, (_event, data) => {
          if (data?.fatal) {
            setHlsFailed(true);
            onError();
          }
        });
      })
      .catch(() => {
        if (!cancelled) {
          setHlsFailed(true);
          onError();
        }
      });

    return () => {
      cancelled = true;
      hlsInstance?.destroy();
    };
  }, [onError, src]);

  return (
    <>
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full"
        autoPlay
        muted
        loop
        playsInline
        controls
        onError={onError}
      />
      {!hlsReady && !hlsFailed ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#162144]/76 text-center text-xs font-bold text-white">
          视频播放器装配中...
        </div>
      ) : null}
    </>
  );
}

const formatSyncTime = (value?: string) => {
  if (!value) return '等待首次同步';

  try {
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const formatStrategyContribution = (candidate: StrategyCandidate) =>
  Object.values(candidate.scoreBreakdown)
    .filter((feature) => feature.contribution !== 0)
    .sort((left, right) => Math.abs(right.contribution) - Math.abs(left.contribution))
    .slice(0, 2)
    .map((feature) => `${feature.label}${feature.contribution >= 0 ? '+' : ''}${feature.contribution}`)
    .join(' / ');

interface InteractiveTheaterProps {
  theaterMode: TheaterMode;
  theaterScript: TheaterScript | null;
  theaterResolution: 'success' | 'failure' | null;
  theaterMeta: TheaterMeta | null;
  cognitiveProjection: DashboardCognitiveProjection;
  theaterCueEnabled: boolean;
  theaterCutFxActive: boolean;
  theaterReadyCueActive: boolean;
  theaterDecisionPending: boolean;
  theaterActionCompleted: boolean;
  theaterSelfCheck: 'aligned' | 'partial' | 'guess';
  theaterConfidence: InteractionConfidence;
  theaterSelectedOption: string;
  theaterSequence: string[];
  theaterDrawCheckpoints: string[];
  socraticReplyDraft: string;
  socraticReplyPending: boolean;
  onExit: () => void;
  onToggleCue: () => void;
  onVideoError: () => void;
  onToggleActionCompleted: () => void;
  onSelfCheckChange: (value: 'aligned' | 'partial' | 'guess') => void;
  onConfidenceChange: (value: InteractionConfidence) => void;
  onSelectOption: (value: string) => void;
  onRotateSequenceStep: (index: number) => void;
  onToggleDrawCheckpoint: (checkpoint: string) => void;
  onSubmitAction: () => void;
  onForceFailure: () => void;
  onSocraticReplyDraftChange: (value: string) => void;
  onSubmitSocraticReply: () => void;
  onOpenFoundationNode?: (nodeKey: string) => void;
}

export default function InteractiveTheater({
  theaterMode,
  theaterScript,
  theaterResolution,
  theaterMeta,
  cognitiveProjection,
  theaterCueEnabled,
  theaterCutFxActive,
  theaterReadyCueActive,
  theaterDecisionPending,
  theaterActionCompleted,
  theaterSelfCheck,
  theaterConfidence,
  theaterSelectedOption,
  theaterSequence,
  theaterDrawCheckpoints,
  socraticReplyDraft,
  socraticReplyPending,
  onExit,
  onToggleCue,
  onVideoError,
  onToggleActionCompleted,
  onSelfCheckChange,
  onConfidenceChange,
  onSelectOption,
  onRotateSequenceStep,
  onToggleDrawCheckpoint,
  onSubmitAction,
  onForceFailure,
  onSocraticReplyDraftChange,
  onSubmitSocraticReply,
  onOpenFoundationNode,
}: InteractiveTheaterProps) {
  if (theaterMode === 'generating') {
    return (
      <motion.div
        key="theater-gen"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="wind-page absolute inset-0 flex h-full w-full flex-col items-center justify-center p-6 text-[#1a1a2e]"
      >
        <div className="wind-panel w-full max-w-md rounded-[28px] px-6 py-8 text-center">
          <div className="wind-pill mb-4 border-[var(--color-secondary)]/22 text-[var(--color-secondary)]">
            剧场引擎准备中
          </div>
          <motion.div
            animate={{ rotate: 360, scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="mb-6 flex justify-center text-[var(--color-primary)]"
          >
            <Orbit size={80} strokeWidth={1} />
          </motion.div>
          <h2 className="mb-3 bg-[linear-gradient(90deg,#2b5bde_0%,#ff8a3d_100%)] bg-clip-text font-display text-2xl font-black tracking-wider text-transparent">
            MOBIUS THEATER START
          </h2>
          <p className="text-xs font-bold text-[var(--color-ink-soft)]">正在生成剧情分支视频与动作判定场景...</p>
          <p className="mt-2 text-[11px] font-semibold text-[var(--color-ink-soft)]/80">
            Time {cognitiveProjection.time} | SNR {cognitiveProjection.signalNoiseRatio} | Emotion {cognitiveProjection.emotion}
          </p>
          {theaterMeta && (
            <p className="mt-2 text-[11px] font-semibold text-[var(--color-ink-soft)]/80">
              Source {theaterMeta.source}
              {theaterMeta.provider ? ` | Provider ${theaterMeta.provider}` : ''}
            </p>
          )}
        </div>
      </motion.div>
    );
  }

  if (!theaterScript) return null;

  const displayVideoUrl = theaterMeta?.activeVideoUrl;
  const hasReadyVideo = Boolean(theaterMeta?.source === 'mobius' && displayVideoUrl);
  const isVideoPending = Boolean(
    theaterMeta?.source === 'mobius' &&
      theaterMeta.videoStatus &&
      ['queued', 'processing'].includes(theaterMeta.videoStatus),
  );
  const isBranchTransitionPending = Boolean(
    theaterMode === 'resolution' &&
      theaterMeta?.source === 'mobius' &&
      theaterMeta.branchOutcome &&
      isVideoPending,
  );
  const mediaStatusTone =
    theaterMeta?.videoStatus === 'ready'
      ? 'border-[var(--color-accent-green)]/30 bg-[var(--color-accent-green)]/10 text-[var(--color-accent-green)]'
      : theaterMeta?.videoStatus === 'failed'
        ? 'border-[var(--color-accent-pink)]/30 bg-[var(--color-accent-pink)]/10 text-[var(--color-accent-pink)]'
        : 'border-[var(--color-primary)]/26 bg-[var(--color-primary)]/10 text-[var(--color-primary)]';

  return (
    <motion.div
      key="theater-play"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="wind-page absolute inset-0 flex h-full w-full flex-col overflow-hidden"
    >
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden">
        <div
          className={`absolute inset-0 z-0 ${
            hasReadyVideo
              ? 'bg-[#0d1538]'
              : 'bg-[radial-gradient(circle_at_18%_14%,rgba(61,123,255,0.22),transparent_24%),radial-gradient(circle_at_82%_12%,rgba(255,138,61,0.18),transparent_22%),linear-gradient(180deg,#eff6ff_0%,#e8f3ff_52%,#fff6ee_100%)]'
          }`}
        />
        <div className="absolute top-5 left-5 z-40">
          <button
            type="button"
            onClick={onExit}
            className="game-btn inline-flex items-center gap-2 bg-white px-3 py-2 text-[11px] font-black text-[#1a1a2e]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
            <span>退出剧场</span>
          </button>
        </div>
        <div className="absolute top-5 right-5 z-40">
          <button
            type="button"
            onClick={onToggleCue}
            className="game-btn inline-flex items-center gap-2 bg-[linear-gradient(180deg,#4d8dff_0%,#2b5bde_100%)] px-3 py-2 text-[11px] font-black text-white"
          >
            {theaterCueEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            <span>{theaterCueEnabled ? '提示音开启' : '提示音关闭'}</span>
          </button>
        </div>
        <div className="absolute top-20 left-5 right-5 z-30 flex justify-center pointer-events-none">
          <div className="grid w-full max-w-3xl gap-3 md:grid-cols-2">
            <div className={`wind-panel rounded-2xl border px-4 py-3 ${mediaStatusTone}`}>
              <p className="text-[11px] font-black tracking-[0.14em]">媒体管线</p>
              <p className="mt-1 text-sm font-black">
                {theaterMeta?.videoStatus === 'ready'
                  ? '视频分支已就绪'
                  : theaterMeta?.videoStatus === 'failed'
                    ? '视频分支回退中'
                    : '视频分支生成中'}
              </p>
              <div className="mt-2 space-y-1 text-[11px] font-semibold">
                <p>Last sync: {formatSyncTime(theaterMeta?.lastMediaSyncAt)}</p>
                {theaterMeta?.mediaJobId ? <p>Job: {theaterMeta.mediaJobId}</p> : null}
                {theaterMeta?.branchOutcome ? <p>Branch: {theaterMeta.branchOutcome.toUpperCase()}</p> : null}
              </div>
            </div>
            <div className="wind-panel rounded-2xl border border-[var(--color-primary)]/16 bg-white/88 px-4 py-3 text-[#1a1a2e]">
              <p className="text-[11px] font-black tracking-[0.14em] text-[var(--color-primary)]">交互状态</p>
              <p className="mt-1 text-sm font-black">
                {theaterDecisionPending
                  ? '正在等待裁决结果'
                  : theaterMode === 'interaction'
                    ? '等待你提交知识动作'
                    : theaterMode === 'resolution'
                      ? '已进入分支结算'
                      : '世界线建立完成'}
              </p>
              <p className="mt-2 text-[11px] font-semibold text-[var(--color-ink-soft)]">
                {isBranchTransitionPending
                  ? '分支片段 ready 后会自动切换，不需要用户重复操作。'
                  : theaterMeta?.errorMessage ?? '当前已把异步状态显性展示，不再只靠控制台观察。'}
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 h-[90%] w-[95%] max-w-5xl rotate-1 rounded-[28px] border-4 border-white/70 p-2 shadow-[0_24px_52px_rgba(24,40,92,0.24)]">
          <div className="relative h-full overflow-hidden rounded-[24px] border-4 border-white/80 bg-[#13204a]">
            {hasReadyVideo && (
              <>
                <TheaterVideo
                  src={displayVideoUrl}
                  onError={onVideoError}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent z-10 pointer-events-none" />
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
                  <div className="absolute inset-0 bg-gradient-to-b from-[#79c9ff]/70 via-[#ff8a3d]/25 to-transparent" />
                  <motion.div
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ duration: 0.24, ease: 'easeInOut' }}
                    className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-[#a8deff]/90 to-transparent blur-md"
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
                  <p
                    className={`rounded-2xl border px-4 py-4 text-xl leading-relaxed font-black italic ${
                      hasReadyVideo
                        ? 'mx-auto max-w-xl border-white/40 bg-black/52 text-white backdrop-blur-sm'
                        : 'border-white/80 bg-white/88 text-[#1a1a2e]'
                    }`}
                  >
                    "{theaterScript.sceneIntro}"
                  </p>
                  <p
                    className={`text-sm font-black ${
                      hasReadyVideo ? 'text-[#ffd54a]' : 'text-[var(--color-secondary)]'
                    }`}
                  >
                    伙伴状态：<span className="uppercase">{theaterScript.emotion}</span>
                  </p>
                  {theaterMeta && (
                    <div
                      className={`mx-auto max-w-lg rounded-2xl border px-4 py-3 text-left text-[11px] font-semibold ${
                        hasReadyVideo
                          ? 'border-white/30 bg-black/44 text-gray-100'
                          : 'border-[var(--color-primary)]/18 bg-white/80 text-[var(--color-ink-soft)]'
                      }`}
                    >
                      <p>Source: {theaterMeta.source.toUpperCase()}</p>
                      {theaterMeta.provider && <p>Provider: {theaterMeta.provider.toUpperCase()}</p>}
                      {theaterMeta.providerJobId && <p>Provider Job ID: {theaterMeta.providerJobId}</p>}
                      {theaterMeta.videoStatus && <p>Video Status: {theaterMeta.videoStatus.toUpperCase()}</p>}
                      {theaterMeta.contentKnowledgePointTitle && (
                        <p>
                          Knowledge Point: {theaterMeta.contentKnowledgePointTitle}
                          {theaterMeta.contentKnowledgePointGrade ? ` // ${theaterMeta.contentKnowledgePointGrade}` : ''}
                        </p>
                      )}
                      {theaterMeta.foundationNodeLabel && (
                        <p>
                          Foundation Node: {theaterMeta.foundationNodeLabel}
                          {theaterMeta.foundationNodeReason ? ` // ${theaterMeta.foundationNodeReason}` : ''}
                        </p>
                      )}
                      {theaterMeta.relatedQuestionSummary?.length ? (
                        <p>Similar Questions: {theaterMeta.relatedQuestionSummary.join(' | ')}</p>
                      ) : null}
                      {theaterMeta.knowledgeActionLabel && (
                        <p>
                          Knowledge Action: {theaterMeta.knowledgeActionLabel}
                          {theaterMeta.knowledgeActionType ? ` // ${theaterMeta.knowledgeActionType}` : ''}
                        </p>
                      )}
                      {theaterMeta.diagnosedMistakeLabels?.length ? (
                        <p>Diagnosed Mistakes: {theaterMeta.diagnosedMistakeLabels.join(' | ')}</p>
                      ) : null}
                      {theaterMeta.errorMessage && <p>Note: {theaterMeta.errorMessage}</p>}
                    </div>
                  )}
                  {hasReadyVideo && <p className="text-xs font-semibold text-[#b9dfff]">视频已就绪，当前为真实播放态。</p>}
                </div>
              )}

              {theaterMode === 'interaction' && (
                <div
                  className={`w-full max-w-xl space-y-6 rounded-[30px] p-6 text-left ${
                    hasReadyVideo
                      ? 'border border-white/35 bg-white/86 backdrop-blur-md'
                      : 'wind-panel border border-[var(--color-primary)]/18 bg-white/92'
                  }`}
                >
                  <p className="text-center text-2xl font-black text-[var(--color-primary)] animate-pulse">
                    轮到你出招了
                  </p>
                  <p className="text-center text-xl font-black text-[#1a1a2e]">"{theaterScript.interactionPrompt}"</p>
                  {theaterMeta?.videoUrl && (
                    <p className="break-all text-xs font-semibold text-[var(--color-ink-soft)]">Preview Asset: {theaterMeta.videoUrl}</p>
                  )}
                  {isVideoPending && (
                    <p className="text-xs font-semibold text-[var(--color-primary)]">视频仍在生成中，前端正自动轮询最新状态...</p>
                  )}
                  {hasReadyVideo && (
                    <p className="text-xs font-semibold text-[var(--color-primary)]">视频已切入真实播放，你现在看到的是生成结果上的交互叠层。</p>
                  )}
                  <div className="game-card mx-auto max-w-md rounded-2xl border border-[var(--color-primary)]/20 bg-white/94 px-4 py-4 text-left space-y-3">
                    <p className="text-xs font-black tracking-[0.12em] text-[var(--color-primary)]">动作提交面板</p>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-semibold text-[#1a1a2e]">我完成了这个知识动作</span>
                      <button
                        type="button"
                        onClick={onToggleActionCompleted}
                        className={`game-btn px-4 py-2 text-sm ${
                          theaterActionCompleted
                            ? 'bg-[linear-gradient(180deg,#57e4b7_0%,#33d1a0_100%)] text-[#1a1a2e]'
                            : 'border-2 border-gray-300 bg-white text-gray-500'
                        }`}
                      >
                        {theaterActionCompleted ? '已完成' : '未完成'}
                      </button>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-black tracking-[0.1em] text-[var(--color-ink-soft)]">自检结果</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { key: 'aligned', label: '完全对齐' },
                          { key: 'partial', label: '部分命中' },
                          { key: 'guess', label: '更像猜测' },
                        ].map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => onSelfCheckChange(item.key as 'aligned' | 'partial' | 'guess')}
                            className={`game-btn px-3 py-2 text-xs ${
                              theaterSelfCheck === item.key
                                ? 'bg-[linear-gradient(180deg,#8fd1ff_0%,#4d8dff_100%)] text-white'
                                : 'border-2 border-gray-300 bg-white text-gray-600'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-black tracking-[0.1em] text-[var(--color-ink-soft)]">把握度</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { key: 'low', label: '低' },
                          { key: 'medium', label: '中' },
                          { key: 'high', label: '高' },
                        ].map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => onConfidenceChange(item.key as InteractionConfidence)}
                            className={`game-btn px-3 py-2 text-xs ${
                              theaterConfidence === item.key
                                ? 'bg-[linear-gradient(180deg,#ffd566_0%,#ffb252_100%)] text-[#1a1a2e]'
                                : 'border-2 border-gray-300 bg-white text-gray-600'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-black tracking-[0.1em] text-[var(--color-ink-soft)]">
                        ACTION PANEL // {theaterMeta?.knowledgeActionType?.toUpperCase() ?? 'GENERIC'}
                      </p>
                      {(theaterMeta?.knowledgeActionType ?? 'select') === 'select' && (
                        <div className="grid gap-2">
                          {SELECT_ACTION_OPTIONS.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => onSelectOption(item.id)}
                              className={`game-btn px-3 py-3 text-sm text-left ${
                                theaterSelectedOption === item.id
                                  ? 'bg-[linear-gradient(180deg,#ff9ec4_0%,#ff5fa2_100%)] text-white'
                                  : 'border-2 border-gray-300 bg-white text-gray-600'
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
                              onClick={() => onRotateSequenceStep(index)}
                              className="game-btn w-full border-2 border-gray-300 bg-white px-3 py-3 text-left text-sm text-gray-600"
                            >
                              Step {index + 1}: {step}
                            </button>
                          ))}
                          <p className="text-[11px] font-semibold text-[var(--color-ink-soft)]">点击步骤可与下一步交换顺序，排出你认为正确的动作链。</p>
                        </div>
                      )}
                      {(theaterMeta?.knowledgeActionType === 'draw' || theaterMeta?.knowledgeActionType === 'drag') && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-1 gap-2">
                            {DRAW_ACTION_CHECKPOINTS.map((checkpoint) => (
                              <button
                                key={checkpoint}
                                type="button"
                                onClick={() => onToggleDrawCheckpoint(checkpoint)}
                                className={`game-btn px-3 py-3 text-sm text-left ${
                                  theaterDrawCheckpoints.includes(checkpoint)
                                    ? 'bg-[linear-gradient(180deg,#8fd1ff_0%,#4d8dff_100%)] text-white'
                                    : 'border-2 border-gray-300 bg-white text-gray-600'
                                }`}
                              >
                                {theaterDrawCheckpoints.includes(checkpoint) ? '[ Locked ]' : '[ Tap ]'} {checkpoint}
                              </button>
                            ))}
                          </div>
                          <p className="text-[11px] font-semibold text-[var(--color-ink-soft)]">用“点亮关键节点”的方式模拟描线/拖拽路径。</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 pt-2">
                    <button
                      disabled={theaterDecisionPending}
                      onClick={onSubmitAction}
                      className="game-btn bg-[linear-gradient(180deg,#4d8dff_0%,#2b5bde_100%)] py-4 text-white"
                    >
                      {theaterDecisionPending ? '裁决中...' : '提交动作，进入裁决'}
                    </button>
                    <button
                      disabled={theaterDecisionPending}
                      onClick={onForceFailure}
                      className="game-btn border-2 border-gray-300 bg-white py-3 text-gray-600"
                    >
                      忽略规则，直接判负
                    </button>
                  </div>
                </div>
              )}

              {theaterMode === 'resolution' && (
                <div
                  className={`w-full max-w-xl space-y-5 rounded-[30px] p-6 ${
                    hasReadyVideo
                      ? 'border border-white/35 bg-white/86 text-[#1a1a2e] backdrop-blur-md'
                      : 'wind-panel border border-[var(--color-primary)]/18 bg-white/92 text-[#1a1a2e]'
                  }`}
                >
                  <p
                    className={`text-3xl font-black italic text-center ${
                      theaterResolution === 'success'
                        ? 'text-[var(--color-accent-green)]'
                        : 'text-[var(--color-accent-pink)]'
                    }`}
                  >
                    {theaterMeta?.resolutionTitle ?? (theaterResolution === 'success' ? 'MISSION ACCOMPLISHED' : 'SYSTEM COLLAPSE')}
                  </p>
                  <p className="text-xl font-black leading-relaxed text-center text-[#1a1a2e]">
                    {theaterResolution === 'success' ? theaterScript.successScene : theaterScript.failureScene}
                  </p>
                  {theaterMeta?.source === 'mobius' && theaterMeta.branchOutcome && (
                    <p className="text-center text-xs font-semibold text-[var(--color-primary)]">
                      Branch video: {theaterMeta.branchOutcome.toUpperCase()} // {theaterMeta.videoStatus?.toUpperCase() ?? 'UNKNOWN'}
                    </p>
                  )}
                  {isBranchTransitionPending && (
                    <div className="game-card mx-auto max-w-md rounded-2xl border border-[var(--color-primary)]/24 bg-[var(--color-primary)]/10 px-4 py-3 text-left">
                      <p className="text-sm font-black text-[var(--color-primary)]">
                        正在切入 {theaterMeta?.branchOutcome === 'success' ? 'SUCCESS' : 'FAILURE'} 分支片段...
                      </p>
                      <p className="mt-2 text-xs font-semibold text-[var(--color-ink-soft)]">
                        当前继续保持上一段已就绪视频播放，分支素材 ready 后会自动无缝切换。
                      </p>
                    </div>
                  )}
                  {theaterMeta?.source === 'mobius' && theaterMeta.branchOutcome && theaterMeta.videoStatus === 'ready' && (
                    <p className="text-center text-xs font-semibold text-[var(--color-accent-green)]">{theaterMeta.branchOutcome.toUpperCase()} 分支片段已切入播放。</p>
                  )}
                  {theaterCutFxActive && <p className="text-center text-xs font-black tracking-[0.22em] text-[var(--color-secondary)]">WORLDLINE SHIFT DETECTED</p>}
                  {theaterReadyCueActive && (
                    <motion.p
                      initial={{ opacity: 0.4, scale: 0.96 }}
                      animate={{ opacity: [0.4, 1, 0.65], scale: [0.96, 1.02, 1] }}
                      transition={{ duration: 0.45 }}
                      className="text-center text-xs font-black tracking-[0.2em] text-[var(--color-primary)]"
                    >
                      SYNC CUE // BRANCH LOCK ACQUIRED
                    </motion.p>
                  )}
                  {!theaterCueEnabled && <p className="text-center text-[11px] font-semibold text-gray-500">本次剧场会话已静音提示音。</p>}
                  {theaterMeta?.coachMessage && <p className="mx-auto max-w-md text-sm font-semibold text-[var(--color-primary)]">{theaterMeta.coachMessage}</p>}
                  {theaterMeta?.adjudicationRationale?.length ? (
                    <div className="game-card mx-auto max-w-md rounded-2xl border border-[var(--color-primary)]/24 bg-[var(--color-primary)]/10 px-4 py-3 text-left">
                      <p className="text-xs font-black tracking-[0.12em] text-[var(--color-primary)]">裁决依据</p>
                      <div className="mt-2 space-y-1 text-[11px] font-semibold text-[var(--color-ink-soft)]">
                        {theaterMeta.adjudicationRationale.map((item) => (
                          <p key={item}>[{item}]</p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {theaterMeta?.contentKnowledgePointTitle && (
                    <div className="game-card mx-auto max-w-md rounded-2xl border border-[var(--color-secondary)]/24 bg-[var(--color-secondary)]/10 px-4 py-3 text-left">
                      <p className="text-xs font-black text-[var(--color-secondary)]">
                        内容底座已锁定知识点：{theaterMeta.contentKnowledgePointTitle}
                        {theaterMeta.contentKnowledgePointGrade ? ` // ${theaterMeta.contentKnowledgePointGrade}` : ''}
                      </p>
                      {theaterMeta.contentEvidence?.length ? (
                        <div className="mt-2 space-y-1 text-[11px] font-semibold text-[var(--color-ink-soft)]">
                          {theaterMeta.contentEvidence.map((item) => (
                            <p key={item}>[{item}]</p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}
                  {theaterMeta?.foundationNodeKey && theaterMeta.foundationNodeLabel && (
                    <div className="game-card mx-auto max-w-md rounded-2xl border border-[var(--color-primary)]/24 bg-[var(--color-primary)]/10 px-4 py-3 text-left">
                      <p className="text-xs font-black text-[var(--color-primary)]">
                        基础科学解释节点：{theaterMeta.foundationNodeLabel}
                      </p>
                      {theaterMeta.foundationNodeReason ? (
                        <p className="mt-1 text-[11px] font-semibold leading-5 text-[var(--color-ink-soft)]">
                          {theaterMeta.foundationNodeReason}
                        </p>
                      ) : null}
                      {onOpenFoundationNode ? (
                        <button
                          type="button"
                          onClick={() => onOpenFoundationNode(theaterMeta.foundationNodeKey!)}
                          className="mt-3 rounded-xl bg-[#111827] px-3 py-2 text-[11px] font-black text-white"
                        >
                          进入基础科学漫剧
                        </button>
                      ) : null}
                    </div>
                  )}
                  {theaterMeta?.diagnosticThread && (
                    <SocraticDiagnosticPanel
                      thread={theaterMeta.diagnosticThread}
                      draft={socraticReplyDraft}
                      pending={socraticReplyPending}
                      onDraftChange={onSocraticReplyDraftChange}
                      onSubmit={onSubmitSocraticReply}
                    />
                  )}
                  {theaterMeta?.strategyDecision ? (
                    <div className="game-card mx-auto max-w-md rounded-2xl border border-[var(--color-primary)]/24 bg-[var(--color-primary)]/8 p-4 text-left text-xs text-[#1a1a2e]">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--color-primary)]/80">
                        Scheduler // {theaterMeta.strategyDecision.selectedStrategy.toUpperCase()}
                      </p>
                      <div className="mt-3 space-y-2">
                        {theaterMeta.strategyDecision.candidates.map((candidate) => (
                          <div
                            key={candidate.strategy}
                            className={`rounded-xl border px-3 py-2 ${
                              candidate.strategy === theaterMeta.strategyDecision?.selectedStrategy
                                ? 'border-[var(--color-primary)]/28 bg-[var(--color-primary)]/12'
                                : 'border-gray-200 bg-white/80'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-black">{candidate.strategy.toUpperCase()}</p>
                              <p className="font-black">score {candidate.score}</p>
                            </div>
                            <p className="mt-1 text-[11px] font-semibold text-[var(--color-ink-soft)]">{candidate.rationale}</p>
                            {formatStrategyContribution(candidate) ? (
                              <p className="mt-1 text-[11px] font-semibold text-[var(--color-primary)]/80">{formatStrategyContribution(candidate)}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {theaterMeta?.nextActions?.length ? (
                    <div className="mx-auto max-w-md space-y-1 text-xs font-semibold text-[var(--color-ink-soft)]">
                      {theaterMeta.nextActions.map((item) => (
                        <p key={item}>[{item}]</p>
                      ))}
                    </div>
                  ) : null}
                  <button
                    onClick={onExit}
                    className="game-btn mx-auto mt-4 block bg-[linear-gradient(180deg,#4d8dff_0%,#2b5bde_100%)] px-8 py-3 text-lg text-white"
                  >
                    退出剧场
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
