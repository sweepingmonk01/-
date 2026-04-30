import { useEffect, useState } from 'react';
import {
  computeAIActiveStateFromExplore,
  type AIActiveLearningState,
  type LightweightMistakeRecord,
} from '../utils/aiActiveStateFromExplore';
import { subscribeExploreProgressUpdated } from '../utils/exploreStateEvents';

type Props = {
  mistakes?: LightweightMistakeRecord[];
  onOpenNode?: (nodeKey: string) => void;
};

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

const weaknessLabel: Record<AIActiveLearningState['dominantWeakness'], string> = {
  world: '世界模型',
  mind: '心智模型',
  meaning: '意义模型',
  game: '行动机制',
  integration: '跨引擎整合',
  unknown: '待诊断',
};

export function AIActiveStatePanel({ mistakes = [], onOpenNode }: Props) {
  const [state, setState] = useState<AIActiveLearningState>(() =>
    computeAIActiveStateFromExplore(mistakes),
  );

  useEffect(() => {
    const refresh = () => {
      setState(computeAIActiveStateFromExplore(mistakes));
    };

    refresh();

    const unsubscribe = subscribeExploreProgressUpdated(refresh);
    window.addEventListener('storage', refresh);

    return () => {
      unsubscribe();
      window.removeEventListener('storage', refresh);
    };
  }, [mistakes]);

  const items = [
    ['世界模型', state.worldModelClarity],
    ['心智模型', state.mindModelStability],
    ['意义模型', state.meaningModelClarity],
    ['行动机制', state.actionMechanismStrength],
    ['跨引擎整合', state.crossEngineIntegration],
    ['错题修复动量', state.mistakeRepairMomentum],
    ['学习稳定性', state.learningStability],
  ] as const;

  return (
    <section className="rounded-[24px] border border-violet-200/16 bg-[#020817]/86 px-4 py-4 shadow-[0_18px_38px_rgba(76,29,149,0.24)]">
      <div className="mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-100/56">AI Active Vector</p>
        <h3 className="mt-1 text-lg font-black text-white">AI Active 状态融合</h3>
        <p className="mt-1 text-xs font-bold leading-5 text-white/52">
          综合探索完成度、错题表现、探索任务答案与反思质量，估算当前学习状态向量。
        </p>
      </div>

      <div className="space-y-3">
        {items.map(([label, value]) => (
          <div key={label}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs font-black">
              <span className="text-white/82">{label}</span>
              <span className="text-white/46">{percent(value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#38bdf8,#a78bfa,#f472b6)] transition-all duration-500"
                style={{ width: percent(value) }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/36">当前主弱项</p>
        <p className="mt-1 text-sm font-black text-white">{weaknessLabel[state.dominantWeakness]}</p>
        <p className="mt-2 text-xs font-bold leading-5 text-white/62">{state.recommendedNextAction}</p>

        {state.recommendedNodeKey ? (
          <button
            type="button"
            className="mt-3 inline-flex rounded-2xl border border-cyan-200/22 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100"
            onClick={() => onOpenNode?.(state.recommendedNodeKey!)}
          >
            进入推荐探索节点
          </button>
        ) : null}
      </div>
    </section>
  );
}
