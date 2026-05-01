import React from 'react';
import { motion } from 'motion/react';
import {
  Beaker,
  BrainCircuit,
  Camera,
  Check,
  ChevronRight,
  Sparkles,
  Target,
} from 'lucide-react';
import type { AIQuestionData } from '../../lib/mobius';

interface CombatFlowProps {
  phase: 'question' | 'feedback';
  aiMode: 'idle' | 'analyzing' | 'ready';
  aiData: AIQuestionData | null;
  combatAnswer: string;
  practiceQueueLength: number;
  practiceIndex: number;
  isCorrect: boolean;
  continueLabel: string;
  onAnswerChange: (value: string) => void;
  onExit: () => void;
  onSubmit: () => void;
  onRetry: () => void;
  onContinue: () => void;
}

const DEFAULT_OPTIONS = [
  '过 D 作 DE // BC',
  '延长 CD 至 E，使 DE = CD，连接 AE, BE',
  '过 C 作 CF ⊥ AB',
  '作 BC 的垂直平分线',
];

export default function CombatFlow({
  phase,
  aiMode,
  aiData,
  combatAnswer,
  practiceQueueLength,
  practiceIndex,
  isCorrect,
  continueLabel,
  onAnswerChange,
  onExit,
  onSubmit,
  onRetry,
  onContinue,
}: CombatFlowProps) {
  const isAiContent = aiMode === 'ready' && aiData;
  const activePainPoint = isAiContent ? aiData.painPoint : '几何辅助线切入顺序';
  const sourceLabel = isAiContent ? 'AI 生成变式' : '内置示例题';

  if (phase === 'feedback') {
    if (!isCorrect) {
      return (
        <motion.div
          key="socratic-feedback"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex h-full w-full flex-col bg-[linear-gradient(180deg,#2a315c_0%,#1e2547_100%)] p-6 text-left text-white"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(255,95,162,0.18),transparent_20%),radial-gradient(circle_at_82%_16%,rgba(61,123,255,0.16),transparent_24%)]" />

          <div className="relative z-10 mx-auto flex w-full max-w-sm flex-1 flex-col pt-12">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="wind-pill w-fit border-white/14 bg-white/10 text-pink-100 shadow-none"
            >
              这一步走偏了
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mb-6 font-bold text-slate-300"
            >
              别急，回到规则再打一遍就行。
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              className="mb-8 rounded-[28px] border border-white/12 bg-white/8 p-5 text-lg"
            >
              <p className="mb-2">
                你刚才选择了 <span className="text-[var(--color-accent-yellow)]">{combatAnswer || '错误路径'}</span>。
              </p>
              <p className="mt-4 leading-relaxed text-white">
                {isAiContent
                  ? aiData.rule
                  : '关键在“中点”。看到中点时，先问自己：倍长中线之后，图形关系会不会突然变简单？'}
              </p>
              <p className="mt-4 text-xs text-slate-400">这道题已经回收到你的修复队列，重打一遍就会更稳。</p>
            </motion.div>

            <div className="mt-auto mb-8">
              <button
                onClick={onRetry}
                className="game-btn w-full bg-[linear-gradient(180deg,#ff8ea8_0%,#ff5fa2_100%)] py-4 text-base font-black text-white"
              >
                重新挑战这一关
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
        className="absolute inset-0 flex h-full w-full flex-col items-center justify-center bg-[linear-gradient(180deg,#59e8ba_0%,#33d1a0_45%,#9cecc9_100%)] p-6 text-center text-[#1a1a2e]"
      >
        <div className="absolute top-0 right-0 p-10 opacity-20">
          <Sparkles size={120} />
        </div>

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1, rotate: [0, -10, 10, 0] }}
          transition={{ type: 'spring', stiffness: 200, damping: 10 }}
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
            onClick={onContinue}
            className="game-btn flex-1 bg-white py-4 text-lg text-[#1a1a2e]"
          >
            {continueLabel}
          </button>
        </div>
      </motion.div>
    );
  }

  if (aiMode === 'analyzing') {
    return (
      <motion.div
        key="analyze"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 flex h-full w-full flex-col items-center justify-center bg-[linear-gradient(180deg,#ffcb7a_0%,#ffb252_50%,#ff9556_100%)] px-6 text-[#1a1a2e]"
      >
        <motion.div
          animate={{ rotate: 360, scale: [1, 1.1, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="mb-8"
        >
          <Camera size={80} />
        </motion.div>
        <h2 className="mb-4 text-center text-3xl font-display font-bold">正在拆出这题的隐藏机关...</h2>
        <div className="w-72 space-y-3 rounded-[28px] border border-white/24 bg-white/18 p-5">
          <div className="flex items-center gap-2 font-bold">
            <Check size={18} /> 提取题干与迷惑图层
          </div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="flex items-center gap-2 font-bold">
            <Check size={18} /> 检索同源真题与错误母题
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} className="flex items-center gap-2 font-bold">
            <Check size={18} /> 生成定制化“一句话法则”
          </motion.div>
        </div>
      </motion.div>
    );
  }

  const options = isAiContent ? aiData.options : DEFAULT_OPTIONS;

  return (
    <motion.div
      key="combat"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="wind-page absolute inset-0 flex h-full w-full flex-col"
    >
      <div className="wind-panel mx-3 mt-3 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={onExit} className="mr-2 rounded-full bg-gray-100 p-1.5 text-gray-500 hover:text-gray-700">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <div className={`w-3 h-3 rounded-full ${isAiContent ? 'bg-[var(--color-secondary)]' : 'bg-[var(--color-subj-ma)]'}`} />
          <span className="font-bold text-sm">
            {practiceQueueLength > 1
              ? `连续练习 ${practiceIndex + 1}/${practiceQueueLength}`
              : isAiContent
                ? 'AI 多模态动态推演'
                : '极光数学 · 几何辅助线'}
          </span>
        </div>
        <div className="bg-gray-100 rounded-full h-2 w-24 overflow-hidden border border-gray-300">
          <div
            className="bg-[var(--color-primary)] h-full transition-all"
            style={{ width: `${practiceQueueLength > 1 ? ((practiceIndex + 1) / practiceQueueLength) * 100 : 50}%` }}
          />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col overflow-y-auto p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="wind-pill">
            来源: {sourceLabel}
          </span>
          <span className="wind-pill border-[var(--color-secondary)]/15 text-[var(--color-secondary)]">
            痛点: {activePainPoint}
          </span>
        </div>

        <div className="wind-quest-card mb-4 flex gap-3 overflow-hidden border border-[var(--color-secondary)]/22 bg-[linear-gradient(180deg,rgba(255,138,61,0.12),rgba(255,255,255,0.94))] p-4 relative">
          <div className="absolute -right-4 -bottom-4 opacity-10">
            <Target size={80} />
          </div>
          <div className="text-[var(--color-secondary)] z-10">
            <BrainCircuit size={24} />
          </div>
          <div className="z-10">
            <h5 className="font-bold text-sm text-[var(--color-secondary)] mb-1">AI 考向超前预判</h5>
            <p className="text-xs font-bold text-[#1a1a2e] opacity-80 leading-relaxed">
              {isAiContent
                ? `【痛点锁定】：${aiData.painPoint}。掌握规则可直接避开陷阱。`
                : '分析全国近 3 年期末真题库证实，此模型【必考频率 96%】。拿下它可直接锁定 +4 分。'}
            </p>
          </div>
        </div>

        <div className="wind-quest-card mb-6 flex gap-3 border border-[var(--color-primary)]/18 bg-[linear-gradient(180deg,rgba(61,123,255,0.12),rgba(255,255,255,0.96))] p-4">
          <div className="min-w-fit rounded-full bg-[var(--color-primary)] p-2 text-white shadow-[0_10px_18px_rgba(61,123,255,0.22)]">
            <Beaker size={20} />
          </div>
          <div>
            <h5 className="font-bold text-[var(--color-primary)] text-sm mb-1 uppercase tracking-wider">一句话法则</h5>
            <p className="font-bold text-[#1a1a2e]">{isAiContent ? aiData.rule : '遇中点，连中线。构造平行四边形或中位线定理。'}</p>
          </div>
        </div>

        <div className="flex-1 mb-6">
          <h3 className="font-bold text-lg mb-4">实战检测</h3>
          <div className="wind-panel mb-6 rounded-[28px] p-6">
            <p className="text-[#1a1a2e] font-medium leading-relaxed mb-6 whitespace-pre-wrap">
              {isAiContent ? aiData.questionText : '在 △ABC 中，D 为 AB 边上的中点，已知 AC = 8，BC = 6。为了求 CD 的取值范围，第一步最稳妥的辅助线应该怎么画？'}
            </p>

            <div className="space-y-3 mt-4">
              {options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => onAnswerChange(option)}
                  className={`w-full rounded-[20px] border-2 p-4 text-left font-bold transition-all ${
                    combatAnswer === option
                      ? 'border-[var(--color-primary)] bg-[linear-gradient(180deg,rgba(61,123,255,0.14),rgba(255,255,255,0.98))] text-[var(--color-primary)] shadow-[0_12px_20px_rgba(61,123,255,0.12)]'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {String.fromCharCode(65 + idx)}. {option}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 pb-safe">
        <button
          disabled={!combatAnswer}
          onClick={onSubmit}
          className={`game-btn flex w-full items-center justify-center gap-2 py-4 text-lg text-white ${
            combatAnswer ? 'bg-[linear-gradient(180deg,#4d8dff_0%,#2b5bde_100%)]' : 'bg-gray-300 cursor-not-allowed border-gray-400 border-b-4'
          }`}
        >
          释放这一招 <ChevronRight />
        </button>
      </div>
    </motion.div>
  );
}
