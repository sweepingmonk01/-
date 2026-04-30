import { useMemo, useState } from 'react';
import type { ExploreNode } from '../data/exploreTypes';
import {
  createExploreMediaTask,
  getExploreMediaTasksByNode,
  updateExploreMediaTaskStatus,
  type ExploreMediaTask,
  type ExploreMediaTaskType,
} from '../utils/exploreMediaTasks';

type Props = {
  node: ExploreNode;
};

function mediaTypeText(type: string) {
  if (type === 'gpt-image') return 'GPT-image 拓扑卡';
  if (type === 'seedance') return 'Seedance 知识点漫剧';
  return type;
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export function ExploreMediaWorkbench({ node }: Props) {
  const [selectedTask, setSelectedTask] = useState<ExploreMediaTask | null>(null);
  const [version, setVersion] = useState(0);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  const tasks = useMemo(
    () => getExploreMediaTasksByNode(node.key),
    [node.key, version],
  );

  function handleCreate(type: ExploreMediaTaskType) {
    const task = createExploreMediaTask(node, type);
    setSelectedTask(task);
    setCopyStatus('idle');
    setVersion((value) => value + 1);
  }

  async function handleCopy(task: ExploreMediaTask) {
    try {
      await copyTextToClipboard(task.prompt);
      updateExploreMediaTaskStatus(task.id, 'copied');
      setSelectedTask({ ...task, status: 'copied' });
      setCopyStatus('copied');
      setVersion((value) => value + 1);
    } catch {
      setCopyStatus('failed');
    }
  }

  return (
    <section className="rounded-[24px] border border-amber-200/16 bg-[#020817]/86 px-4 py-4 shadow-[0_18px_38px_rgba(120,53,15,0.22)]">
      <div className="mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-100/56">Prompt Workbench</p>
        <h3 className="mt-1 text-lg font-black text-white">媒体生成工作台</h3>
        <p className="mt-1 text-xs font-bold leading-5 text-white/52">
          基于节点内容、学习证据和 AI Active 状态，生成拓扑卡与知识点漫剧提示词。
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => handleCreate('gpt-image')}
          className="rounded-2xl border border-cyan-200/22 bg-cyan-300/10 px-3 py-3 text-left text-xs font-black leading-4 text-cyan-100 transition hover:bg-cyan-300/16"
        >
          生成 GPT-image 拓扑卡 Prompt
        </button>

        <button
          type="button"
          onClick={() => handleCreate('seedance')}
          className="rounded-2xl border border-amber-200/22 bg-amber-300/10 px-3 py-3 text-left text-xs font-black leading-4 text-amber-100 transition hover:bg-amber-300/16"
        >
          生成 Seedance 漫剧 Prompt
        </button>
      </div>

      {selectedTask ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-black text-white">
                {mediaTypeText(selectedTask.type)}
              </div>
              <div className="mt-1 text-[11px] font-bold text-white/42">
                {new Date(selectedTask.createdAt).toLocaleString()} · {selectedTask.status}
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleCopy(selectedTask)}
              className="shrink-0 rounded-2xl border border-violet-200/22 bg-violet-300/10 px-3 py-2 text-xs font-black text-violet-100 transition hover:bg-violet-300/16"
            >
              复制 Prompt
            </button>
          </div>

          {copyStatus === 'copied' ? (
            <p className="mt-2 rounded-xl bg-emerald-300/10 px-3 py-2 text-[11px] font-bold text-emerald-100/78">
              Prompt 已复制。
            </p>
          ) : null}
          {copyStatus === 'failed' ? (
            <p className="mt-2 rounded-xl bg-rose-300/10 px-3 py-2 text-[11px] font-bold text-rose-100/78">
              复制失败，请从文本框中手动选取。
            </p>
          ) : null}

          <textarea
            readOnly
            value={selectedTask.prompt}
            className="mt-3 h-72 w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-xs font-bold leading-5 text-white/74 outline-none"
          />
        </div>
      ) : null}

      {tasks.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3">
          <div className="text-sm font-black text-white">历史媒体任务</div>

          <div className="mt-2 space-y-2">
            {tasks.slice(0, 5).map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => {
                  setSelectedTask(task);
                  setCopyStatus('idle');
                }}
                className="block w-full rounded-2xl border border-white/8 bg-black/16 px-3 py-2 text-left text-[11px] font-bold leading-4 text-white/60 transition hover:bg-white/10"
              >
                <div className="flex items-center justify-between gap-3">
                  <span>{mediaTypeText(task.type)}</span>
                  <span className="shrink-0 text-white/38">{task.status}</span>
                </div>
                <div className="mt-1 text-white/36">
                  {new Date(task.createdAt).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-[11px] font-bold leading-4 text-white/48">
        当前为本地 Prompt Workbench，暂未接入真实 GPT-image / Seedance API。
      </div>
    </section>
  );
}
