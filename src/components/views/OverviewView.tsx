import React from 'react';
import { motion } from 'motion/react';
import { Compass, Volume2, VolumeX } from 'lucide-react';
import type { OverviewMetric, OverviewViewState } from '../../../shared/overview-metrics';

interface OverviewViewProps {
  timeSaved: number;
  theaterCueEnabled: boolean;
  onToggleCue: () => void;
  overview: OverviewViewState;
}

const toneClassMap: Record<OverviewMetric['tone'], string> = {
  primary: 'text-[var(--color-primary)]',
  secondary: 'text-[var(--color-secondary)]',
  green: 'text-[var(--color-accent-green)]',
  neutral: 'text-[#1a1a2e]',
};

export default function OverviewView({
  timeSaved,
  theaterCueEnabled,
  onToggleCue,
  overview,
}: OverviewViewProps) {
  const {
    efficiencyGrade,
    efficiencyLabel,
    efficiencySummary,
    currentFocus,
    activeSignals,
    metrics,
  } = overview;
  const signalPreview = activeSignals.slice(0, 2);
  const hiddenSignalCount = Math.max(0, activeSignals.length - signalPreview.length);

  return (
    <motion.div
      key="overview"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="wind-page absolute inset-0 flex h-full w-full min-h-0 flex-col overflow-hidden"
    >
      <div className="flex-1 min-h-0 overflow-y-auto p-3 pb-[5.6rem] pt-3 touch-pan-y">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-2 pb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="wind-pill">
              <Compass size={14} />
              御风总览
            </div>
            <span className="wind-mini-badge bg-[var(--color-primary)]/12 px-2 py-1 text-[9px] text-[var(--color-primary)]">轨迹整理中</span>
          </div>

          <section className="dashboard-night-grid relative overflow-hidden rounded-[20px] border border-cyan-200/12 px-3 py-2 text-white shadow-[0_12px_24px_rgba(37,49,113,0.2)]">
            <div className="absolute right-2 top-2 opacity-10"><Compass size={40} /></div>
            <p className="relative z-10 text-[9px] font-black uppercase tracking-[0.14em] text-cyan-200/80">Flight Trace</p>
            <div className="relative z-10 mt-1 flex items-end gap-1.5">
              <span className="text-[26px] font-display font-bold leading-none text-[var(--color-accent-yellow)]">{efficiencyGrade}</span>
              <span className="text-[11px] font-bold">{efficiencyLabel}</span>
            </div>
            <p className="relative z-10 mt-1 text-[10px] font-medium leading-4 text-gray-200">
              本周省回 <span className="font-black text-[var(--color-secondary)]">{timeSaved} 分钟</span> 低效训练时间，{efficiencySummary}
            </p>
          </section>

          <section className="grid grid-cols-2 gap-2">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-[18px] border border-[#1a1a2e]/10 bg-white/90 px-2.5 py-2 shadow-[0_10px_20px_rgba(61,123,255,0.08)]">
                <div className="text-[9px] font-bold text-gray-500">{metric.label}</div>
                <div className={`mt-1 text-lg font-display font-bold leading-tight ${toneClassMap[metric.tone]}`}>{metric.value}</div>
                <div className="mt-1 text-[10px] font-medium leading-4 text-gray-500">{metric.detail}</div>
              </div>
            ))}
          </section>

          <div className="grid grid-cols-2 gap-2">
            <section className="flex flex-col rounded-[18px] border border-[#1a1a2e]/10 bg-white/88 px-2.5 py-2 shadow-[0_10px_20px_rgba(61,123,255,0.08)]">
              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-500">长期状态</div>
              <div className="mt-1 rounded-xl bg-[linear-gradient(180deg,#f7faff_0%,#fff6ef_100%)] px-2 py-1.5">
                <p className="text-[9px] font-bold text-gray-500">当前主线</p>
                <p className="mt-0.5 text-[11px] font-bold leading-4 text-[#1a1a2e]">{currentFocus}</p>
              </div>
              <div className="mt-1.5 space-y-1">
                {signalPreview.length ? signalPreview.map((signal) => (
                  <div key={signal} className="rounded-xl border border-[#7aa7ff]/18 bg-[linear-gradient(180deg,#f7faff_0%,#fff6ef_100%)] px-2 py-1 text-[10px] font-bold leading-4 text-[#1a1a2e]">
                    {signal}
                  </div>
                )) : (
                  <div className="rounded-xl border border-[#7aa7ff]/18 bg-[linear-gradient(180deg,#f7faff_0%,#fff6ef_100%)] px-2 py-1 text-[10px] font-medium leading-4 text-gray-500">
                    先完成 1 次真实诊断和 1 次裁决。
                  </div>
                )}
                {hiddenSignalCount > 0 && (
                  <div className="text-[9px] font-bold text-gray-500">另有 {hiddenSignalCount} 条信号在持续跟踪</div>
                )}
              </div>
            </section>

            <section className="flex flex-col rounded-[18px] border border-[#1a1a2e]/10 bg-white/88 px-2.5 py-2 shadow-[0_10px_20px_rgba(61,123,255,0.08)]">
              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-500">体验偏好</div>
              <div className="mt-1 rounded-xl border border-[#1a1a2e]/10 bg-[linear-gradient(180deg,#f8fbff_0%,#fff7f1_100%)] px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-black text-[#1a1a2e]">剧场分支 Cue 音效</p>
                    <p className="mt-0.5 text-[9px] font-medium leading-4 text-gray-500">控制分支视频 ready 时的短音效提示。</p>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleCue}
                    className={`game-btn inline-flex items-center gap-1 px-2 py-1 text-[9px] font-black transition ${
                      theaterCueEnabled
                        ? 'bg-[linear-gradient(180deg,#4d8dff_0%,#2b5bde_100%)] text-white'
                        : 'bg-white text-gray-600'
                    }`}
                  >
                    {theaterCueEnabled ? <Volume2 size={11} /> : <VolumeX size={11} />}
                    {theaterCueEnabled ? '开启' : '静音'}
                  </button>
                </div>
              </div>
              <div className="mt-1.5 rounded-xl bg-[linear-gradient(180deg,#f7faff_0%,#fff6ef_100%)] px-2 py-1.5 text-[10px] font-medium leading-4 text-gray-600">
                视觉切换会始终保留，仅提示音开关受这里控制。
              </div>
              <div className="mt-1.5 rounded-xl border border-[#7aa7ff]/18 bg-white px-2 py-1.5">
                <p className="text-[9px] font-bold text-gray-500">状态</p>
                <p className="text-[11px] font-black text-[#1a1a2e]">{theaterCueEnabled ? '当前为提示音开启' : '当前为提示音静音'}</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
