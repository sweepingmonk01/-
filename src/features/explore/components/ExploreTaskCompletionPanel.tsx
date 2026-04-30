import { useMemo, useState } from 'react';
import {
  getYufengDailyTaskState,
  markYufengEvidenceSubmitted,
  markYufengSnapshotReady,
} from '../cockpit/yufengDailyTaskState';
import type { ExploreNode } from '../data/exploreTypes';
import { emitExploreProgressUpdated } from '../utils/exploreStateEvents';
import {
  getExploreTaskResultsByNode,
  saveExploreTaskResult,
  type ExploreTaskResult,
} from '../utils/exploreTaskResults';

type Props = {
  node: ExploreNode;
};

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function qualityText(level: string) {
  switch (level) {
    case 'excellent':
      return '优秀';
    case 'good':
      return '良好';
    case 'basic':
      return '基础完成';
    default:
      return '未形成有效证据';
  }
}

export function ExploreTaskCompletionPanel({ node }: Props) {
  const firstTask = node.explorationTasks[0];

  const [userAnswer, setUserAnswer] = useState('');
  const [reflectionText, setReflectionText] = useState('');
  const [lastResult, setLastResult] = useState<ExploreTaskResult | null>(null);

  const previousResults = useMemo(
    () => getExploreTaskResultsByNode(node.key),
    [node.key, lastResult],
  );

  if (!firstTask) {
    return (
      <section className="rounded-[24px] border border-white/10 bg-white/[0.07] px-4 py-4">
        <h3 className="text-lg font-black text-white">探索任务</h3>
        <p className="mt-2 text-xs font-bold leading-5 text-white/54">
          当前节点暂无探索任务。
        </p>
      </section>
    );
  }

  function handleSubmit() {
    const result = saveExploreTaskResult({
      nodeKey: node.key,
      taskTitle: firstTask.taskTitle,
      taskType: firstTask.taskType,
      userAnswer,
      reflectionText,
    });

    if (result) {
      const yufengState = getYufengDailyTaskState();
      if (
        yufengState?.status === 'started' &&
        (!yufengState.nodeKey || yufengState.nodeKey === node.key)
      ) {
        markYufengEvidenceSubmitted();
        markYufengSnapshotReady();
      }

      setLastResult(result);
      emitExploreProgressUpdated();
      setUserAnswer('');
      setReflectionText('');
    }
  }

  const disabled = userAnswer.trim().length < 4;

  return (
    <section className="rounded-[24px] border border-cyan-200/16 bg-[#020817]/86 px-4 py-4 shadow-[0_18px_38px_rgba(8,47,73,0.22)]">
      <div className="mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/56">Learning Evidence</p>
        <h3 className="mt-1 text-lg font-black text-white">完成探索任务</h3>
        <p className="mt-1 text-xs font-bold leading-5 text-white/52">
          不再只是“标记已理解”，而是留下一个可被 AI Active 读取的学习证据。
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-cyan-100">{firstTask.taskTitle}</p>
            <p className="mt-2 text-xs font-bold leading-5 text-white/64">
              {firstTask.taskDescription}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-white/10 bg-white/8 px-2 py-1 text-[10px] font-black text-white/50">
            {firstTask.estimatedMinutes} 分钟
          </span>
        </div>
        <p className="mt-2 rounded-xl bg-emerald-300/10 px-3 py-2 text-[11px] font-bold leading-4 text-emerald-100/78">
          预期洞察：{firstTask.expectedInsight}
        </p>
      </div>

      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="text-xs font-black text-white/74">我的答案 / 操作说明</span>
          <textarea
            value={userAnswer}
            onChange={(event) => setUserAnswer(event.target.value)}
            className="mt-2 min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3 text-sm font-bold leading-5 text-white outline-none transition placeholder:text-white/28 focus:border-cyan-200/40"
            placeholder="写下你完成这个任务的答案、判断或操作步骤。"
          />
        </label>

        <label className="block">
          <span className="text-xs font-black text-white/74">我的反思</span>
          <textarea
            value={reflectionText}
            onChange={(event) => setReflectionText(event.target.value)}
            className="mt-2 min-h-20 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3 text-sm font-bold leading-5 text-white outline-none transition placeholder:text-white/28 focus:border-violet-200/40"
            placeholder="写下你发现了什么、下次遇到类似题目准备怎么修复。"
          />
        </label>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={handleSubmit}
        className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-cyan-200/22 bg-cyan-300/10 px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-300/16 disabled:cursor-not-allowed disabled:opacity-40"
      >
        提交探索证据
      </button>

      {lastResult ? (
        <div className="mt-4 rounded-2xl border border-emerald-200/16 bg-emerald-300/10 px-3 py-3">
          <div className="text-sm font-black text-emerald-100">
            已记录探索结果
          </div>
          <p className="mt-1 text-xs font-bold leading-5 text-white/68">
            质量评分：{percent(lastResult.qualityScore)} · {qualityText(lastResult.qualityLevel)}
          </p>
        </div>
      ) : null}

      {previousResults.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3">
          <div className="text-sm font-black text-white">历史探索记录</div>
          <div className="mt-2 space-y-2">
            {previousResults.slice(0, 3).map((result) => (
              <div
                key={result.id}
                className="rounded-2xl border border-white/8 bg-black/16 px-3 py-2 text-[11px] font-bold leading-4 text-white/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <span>{new Date(result.createdAt).toLocaleString()}</span>
                  <span className="shrink-0 text-cyan-100/78">
                    {percent(result.qualityScore)} · {qualityText(result.qualityLevel)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-white/72">
                  {result.reflectionText || result.userAnswer}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
