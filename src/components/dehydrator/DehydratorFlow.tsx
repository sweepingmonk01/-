import React from 'react';
import { motion } from 'motion/react';
import { Check, Cpu, Lock, ShieldAlert, Trophy, Zap } from 'lucide-react';
import type { DehydrateResult } from '../../lib/mobius';

interface DehydratorFlowProps {
  dehydrateMode: 'idle' | 'analyzing' | 'ready';
  dehydrateData: DehydrateResult | null;
  targetScore: number;
  onExit: () => void;
  onApprove: () => void;
}

export default function DehydratorFlow({
  dehydrateMode,
  dehydrateData,
  targetScore,
  onExit,
  onApprove,
}: DehydratorFlowProps) {
  if (dehydrateMode === 'analyzing') {
    return (
      <motion.div
        key="analyze-dehydrate"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 flex h-full w-full flex-col items-center justify-center bg-[linear-gradient(180deg,#2646b8_0%,#3f62db_42%,#ffb252_100%)] text-white"
      >
        <div className="absolute top-6 left-6 z-50">
          <button onClick={onExit} className="text-gray-400 hover:text-white p-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.2),transparent_22%),radial-gradient(circle_at_78%_18%,rgba(255,255,255,0.14),transparent_22%)]" />
        <motion.div
          animate={{ rotate: -360, scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="mb-8 relative z-10 text-[var(--color-secondary)]"
        >
          <Cpu size={100} />
        </motion.div>
        <div className="mb-4 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--color-secondary)]">
          Target Score // {targetScore}
        </div>
        <h2 className="text-3xl font-display font-bold mb-4 relative z-10 text-[var(--color-accent-yellow)] drop-shadow-[0_0_10px_rgba(255,213,74,0.45)]">
          正在用风刃裁掉低效题海...
        </h2>
        <div className="relative z-10 w-72 space-y-3 rounded-[28px] border border-white/18 bg-white/10 p-5 backdrop-blur-sm">
          <div className="flex items-center gap-2 font-bold text-gray-300">
            <Check className="text-[var(--color-accent-green)]" size={18} /> 扫描整卷知识点矩阵
          </div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="flex items-center gap-2 font-bold text-gray-300">
            <Check className="text-[var(--color-accent-green)]" size={18} /> 计算 {targetScore} 分边界 ROI 极值
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} className="flex items-center gap-2 font-bold text-[var(--color-accent-pink)]">
            <Zap size={18} /> 废除无效机械惩罚任务
          </motion.div>
        </div>
      </motion.div>
    );
  }

  if (!dehydrateData) return null;

  const savedMins = (dehydrateData.trashEasy + dehydrateData.dropHard) * 5;

  return (
    <motion.div
      key="dehydrate-result"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="wind-page absolute inset-0 flex h-full w-full flex-col overflow-y-auto text-[#1a1a2e]"
    >
      <div className="relative mx-auto w-full max-w-lg px-5 pb-28 pt-8">
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-[var(--color-secondary)] opacity-10 blur-[100px]" />

        <div className="mb-5 flex flex-wrap gap-2">
          <span className="wind-pill border-[var(--color-secondary)]/20 text-[var(--color-secondary)]">
            目标分 {targetScore}
          </span>
          <span className="wind-pill border-[var(--color-accent-green)]/20 text-[var(--color-accent-green)]">
            回收 {savedMins} 分钟
          </span>
        </div>

        <h2 className="mb-2 flex items-center gap-3 text-4xl font-display font-bold text-[var(--color-secondary)]">
          <ShieldAlert size={36} /> 脱水完毕
        </h2>
        <p className="mb-8 font-bold text-gray-500">
          传统教育会让你把 {dehydrateData.total} 题全做完。我帮你砸碎了其中 {dehydrateData.trashEasy + dehydrateData.dropHard} 题。
        </p>

        <div className="wind-panel mb-6 grid grid-cols-3 gap-2 divide-x divide-gray-100 rounded-[28px] p-4 text-center">
          <div>
            <div className="text-3xl font-bold text-[var(--color-accent-pink)]">{dehydrateData.dropHard}</div>
            <div className="mt-1 text-[10px] font-bold uppercase text-gray-400">超纲放弃</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-gray-500">{dehydrateData.trashEasy}</div>
            <div className="mt-1 text-[10px] font-bold uppercase text-gray-400">机械重复</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-[var(--color-accent-green)]">{dehydrateData.mustDo}</div>
            <div className="mt-1 text-[10px] font-bold uppercase text-[var(--color-accent-green)]">高悬赏区</div>
          </div>
        </div>

        <div className="game-card mb-8 bg-[linear-gradient(180deg,#fff4df_0%,#fffdf7_100%)] p-5">
          <h3 className="mb-2 flex items-center gap-2 text-xl font-black">
            <Trophy size={20} /> AI 核心指令：
          </h3>
          <p className="font-bold leading-relaxed">{dehydrateData.reasoning}</p>
        </div>

        <div className="mb-10 border-l-4 border-[var(--color-accent-green)] pl-4">
          <h4 className="mb-1 text-sm font-bold text-gray-400">你今晚只需要完成以下题目：</h4>
          <div className="text-2xl font-black text-[#1a1a2e]">{dehydrateData.mustDoIndices || '无，全部免做！'}</div>
        </div>

        {dehydrateData.strategicPlan && (
          <div className="mb-10 space-y-4">
            <div className="game-card rounded-2xl border border-[var(--color-primary)]/25 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--color-primary)]">ROI 战略规划官</p>
              <h3 className="mt-2 text-xl font-black text-[#1a1a2e]">{dehydrateData.strategicPlan.commanderBriefing}</h3>
              <p className="mt-2 text-sm font-bold leading-6 text-[var(--color-primary)]">{dehydrateData.strategicPlan.immediateOrder}</p>
            </div>

            {!!dehydrateData.strategicPlan.weakTopicAlerts.length && (
              <div className="game-card rounded-2xl border border-red-400/20 bg-[linear-gradient(180deg,rgba(255,95,162,0.08),rgba(255,255,255,0.96))] p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-red-400">高风险提醒</p>
                <div className="mt-2 space-y-2">
                  {dehydrateData.strategicPlan.weakTopicAlerts.map((item) => (
                    <p key={item} className="text-sm font-bold text-[#1a1a2e]">{item}</p>
                  ))}
                </div>
              </div>
            )}

            {!!dehydrateData.strategicPlan.questionPlans.length && (
              <div className="space-y-3">
                {dehydrateData.strategicPlan.questionPlans.slice(0, 6).map((plan) => (
                  <div key={plan.questionLabel} className="game-card rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-[#1a1a2e]">{plan.questionLabel} · {plan.topic}</p>
                        <p className="mt-1 text-xs font-bold text-gray-500">{plan.extractedKnowledgePoint}</p>
                      </div>
                      <div
                        className={`rounded-full px-3 py-1 text-[10px] font-black ${
                          plan.action === 'attack'
                            ? 'bg-emerald-300 text-[#1a1a2e]'
                            : plan.action === 'review'
                              ? 'bg-amber-300 text-[#1a1a2e]'
                              : 'bg-gray-300 text-[#1a1a2e]'
                        }`}
                      >
                        {plan.action === 'attack' ? '主攻' : plan.action === 'review' ? '复核' : '放弃'}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-[11px] font-bold text-gray-500">
                      <span>ROI {plan.roiScore}</span>
                      <span>{plan.estimatedMinutes} 分钟</span>
                    </div>
                    <p className="mt-2 text-sm font-medium leading-6 text-gray-600">{plan.rationale}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mb-10 flex gap-3 rounded-xl border border-[var(--color-accent-pink)] bg-[var(--color-accent-pink)]/12 p-4 text-[var(--color-accent-pink)]">
          <Lock size={24} className="shrink-0" />
          <p className="text-sm font-bold mt-1">
            注意：其它题型已被强行列入【战略放弃区】，系统禁止你在这上面浪费时间去换取那微茫的分数。
          </p>
        </div>
      </div>

      <div className="wind-bottom-nav fixed bottom-0 left-0 right-0 z-50 mx-auto w-full max-w-md border-t border-white/20 p-4 pb-safe text-center">
        <p className="mb-3 font-bold text-[var(--color-secondary)]">这一刀帮你挽回了 {savedMins} 分钟</p>
        <button
          onClick={onApprove}
          className="game-btn w-full bg-[linear-gradient(180deg,#ffb252_0%,#ff8a3d_100%)] py-4 text-lg text-[#1a1a2e]"
        >
          批准执行，生成免做凭证
        </button>
      </div>
    </motion.div>
  );
}
