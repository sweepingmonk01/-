import { useEffect, useState } from 'react';
import {
  computeExploreProgress,
  type ExploreProgressSummary,
} from '../utils/exploreProgress';
import { subscribeExploreProgressUpdated } from '../utils/exploreStateEvents';

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function ExploreActiveRadar() {
  const [progress, setProgress] = useState<ExploreProgressSummary>(() => computeExploreProgress());

  useEffect(() => {
    const refresh = () => setProgress(computeExploreProgress());
    const unsubscribe = subscribeExploreProgressUpdated(refresh);

    window.addEventListener('storage', refresh);

    return () => {
      unsubscribe();
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const radarItems = [
    {
      label: '世界模型',
      value: progress.worldModelClarity,
      detail: `${progress.world.completed}/${progress.world.total}`,
    },
    {
      label: '心智模型',
      value: progress.mindModelStability,
      detail: `${progress.mind.completed}/${progress.mind.total}`,
    },
    {
      label: '意义模型',
      value: progress.meaningModelClarity,
      detail: `${progress.meaning.completed}/${progress.meaning.total}`,
    },
    {
      label: '行动机制',
      value: progress.actionMechanismStrength,
      detail: `${progress.game.completed}/${progress.game.total}`,
    },
    {
      label: '跨引擎整合',
      value: progress.crossEngineIntegration,
      detail: `${progress.totalCompleted}/${progress.totalNodes}`,
    },
  ];

  return (
    <section className="rounded-[24px] border border-cyan-200/16 bg-[#020817]/86 px-4 py-4 shadow-[0_18px_38px_rgba(8,47,73,0.26)]">
      <div className="mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/56">AI Active</p>
        <h3 className="mt-1 text-lg font-black text-white">AI Active 探索雷达</h3>
        <p className="mt-1 text-xs font-bold leading-5 text-white/52">
          根据已完成的探索节点，估算世界模型、心智模型、意义模型与行动机制的成长状态。
        </p>
      </div>

      <div className="space-y-3">
        {radarItems.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs font-black">
              <span className="text-white/82">{item.label}</span>
              <span className="text-white/46">{percent(item.value)} · {item.detail}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#38bdf8,#a78bfa,#f472b6)] transition-all duration-500"
                style={{ width: percent(item.value) }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-[11px] font-bold leading-4 text-white/48">
        当前为本地探索完成度映射，状态融合面板会继续合并错题表现与修复动量。
      </div>
      <div className="mt-3 hidden text-[10px] text-white/30">
        TODO P2-4: 接入 GPT-image / Seedance，为节点生成拓扑卡与知识点漫剧。
        TODO P2-5: 探索任务完成后记录 taskResult、answerQuality、reflectionText。
      </div>
    </section>
  );
}
