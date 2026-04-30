import React from 'react';
import { motion } from 'motion/react';
import { Lock, Map as MapIcon, UploadCloud, Zap } from 'lucide-react';

interface ReportViewProps {
  timeSaved: number;
  onReturnHome: () => void;
}

export default function ReportView({
  timeSaved,
  onReturnHome,
}: ReportViewProps) {
  return (
    <motion.div
      key="report"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="wind-page absolute inset-0 flex h-full w-full flex-col items-center justify-center overflow-hidden px-5 py-6 text-[#1a1a2e]"
    >
      <div className="absolute left-1/2 top-8 h-72 w-72 -translate-x-1/2 rounded-full bg-[var(--color-secondary)]/15 blur-[96px]" />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-sm flex-col overflow-y-auto pb-5">
        <div className="flex flex-1 flex-col justify-center pt-8">
          <div className="wind-pill mb-5 w-fit self-center border-[var(--color-secondary)]/20 text-[var(--color-secondary)]">
            今日成果结算
          </div>

          <div className="wind-panel mb-8 rounded-[30px] border border-[var(--color-secondary)]/24 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(255,244,228,0.88))] p-7 text-center">
            <div className="absolute -right-3 -top-3 rotate-6 rounded-full border-2 border-white bg-[linear-gradient(180deg,#4d8dff_0%,#2b5bde_100%)] px-3 py-1 text-[10px] font-black text-white shadow-[0_10px_20px_rgba(61,123,255,0.24)]">
              超越 95% 同龄人
            </div>

            <p className="mb-1 text-sm font-bold text-[var(--color-ink-soft)]">今日已收回学习时长</p>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="mb-6 flex items-end justify-center font-display text-6xl leading-none font-black text-[var(--color-secondary)]"
            >
              +{timeSaved || 26}<span className="ml-1 pb-2 text-2xl text-[var(--color-ink)]">min</span>
            </motion.div>

            <div className="game-card mb-4 rounded-2xl border border-white/60 bg-white/78 p-4 text-left shadow-[0_16px_28px_rgba(61,123,255,0.1)]">
              <p className="mb-1 text-sm font-bold text-[var(--color-ink-soft)]">
                <Zap size={14} className="mr-1 inline text-[var(--color-primary)]" /> 击碎无用题海：
                <span className="float-right text-[var(--color-ink)]">15 题</span>
              </p>
              <p className="text-sm font-bold text-[var(--color-ink-soft)]">
                <MapIcon size={14} className="mr-1 inline text-[var(--color-accent-green)]" /> 突破薄弱知识：
                <span className="float-right text-[var(--color-ink)]">3 个</span>
              </p>
            </div>

            <div className="mt-2 flex items-center justify-center gap-1 text-xs font-bold text-[var(--color-ink-soft)]/80">
              <Lock size={12} /> Powered by 列子御风 AI
            </div>
          </div>

          <div className="mb-auto text-center">
            <p className="mb-2 text-lg leading-relaxed font-black text-[#1a1a2e]">
              “今天省下来的时间，
              <br />
              属于你自己。”
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-3">
          <button className="game-btn flex w-full items-center justify-center gap-2 bg-[linear-gradient(180deg,#4d8dff_0%,#2b5bde_100%)] py-4 text-xl text-white">
            <UploadCloud size={20} /> 生成炫耀海报
          </button>

          <button
            onClick={onReturnHome}
            className="game-btn flex w-full items-center justify-center gap-2 border border-white/80 bg-white py-4 text-lg text-[#1a1a2e]"
          >
            返回营地继续休息
          </button>
        </div>
      </div>
    </motion.div>
  );
}
