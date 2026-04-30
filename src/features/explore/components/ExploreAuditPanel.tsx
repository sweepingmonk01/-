import { useState } from 'react';
import {
  buildExploreRemoteSnapshot,
  buildExploreSyncApiRequestFixture,
  clearExploreSyncQueue,
  enqueueExploreSyncSnapshot,
  failingMockExploreSyncClient,
  getExploreSyncClientLabel,
  getExploreSyncQueueStats,
  runExploreSyncQueue,
  type ExploreUserScope,
} from '../repository';
import {
  clearExploreLocalData,
  exportExploreLocalData,
  runExploreAudit,
  type ExploreAuditResult,
} from '../utils/exploreAudit';
import { getExploreMediaTasks } from '../utils/exploreMediaTasks';
import { getCompletedExploreNodeKeys } from '../utils/exploreProgress';
import { emitExploreProgressUpdated } from '../utils/exploreStateEvents';
import { getExploreTaskResults } from '../utils/exploreTaskResults';

const localExploreUserScope: ExploreUserScope = {
  userId: 'local-user',
  studentId: 'local-student',
  deviceId: 'local-device',
  sessionId: 'local-session',
};

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
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

export function ExploreAuditPanel() {
  const [audit, setAudit] = useState<ExploreAuditResult>(() =>
    runExploreAudit(),
  );

  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [syncState, setSyncState] = useState<'idle' | 'queued' | 'failed'>('idle');
  const [apiFixtureState, setApiFixtureState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [syncStats, setSyncStats] = useState(() => getExploreSyncQueueStats());
  const [syncMessage, setSyncMessage] = useState('');

  function refresh() {
    setAudit(runExploreAudit());
    setSyncStats(getExploreSyncQueueStats());
  }

  async function handleCopyExport() {
    try {
      await copyTextToClipboard(exportExploreLocalData());
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      setCopyState('failed');
      window.setTimeout(() => setCopyState('idle'), 1800);
    }
  }

  function handleClear() {
    const ok = window.confirm(
      '确定要清空本地探索数据吗？这会删除 completedNodes、taskResults、mediaTasks。',
    );

    if (!ok) return;

    clearExploreLocalData();
    emitExploreProgressUpdated();
    refresh();
  }

  function handleGenerateRemoteSnapshot() {
    try {
      const snapshot = buildExploreRemoteSnapshot({
        userScope: localExploreUserScope,
        completedNodeKeys: getCompletedExploreNodeKeys(),
        taskResults: getExploreTaskResults(),
        mediaTasks: getExploreMediaTasks(),
      });

      enqueueExploreSyncSnapshot(snapshot);
      setSyncState('queued');
      setSyncStats(getExploreSyncQueueStats());
      refresh();
      window.setTimeout(() => setSyncState('idle'), 1500);
    } catch {
      setSyncState('failed');
      window.setTimeout(() => setSyncState('idle'), 1800);
    }
  }

  async function handleCopySyncApiRequestFixture() {
    try {
      const snapshot = buildExploreRemoteSnapshot({
        userScope: localExploreUserScope,
        completedNodeKeys: getCompletedExploreNodeKeys(),
        taskResults: getExploreTaskResults(),
        mediaTasks: getExploreMediaTasks(),
      });

      const fixture = buildExploreSyncApiRequestFixture(snapshot);
      await copyTextToClipboard(JSON.stringify(fixture, null, 2));
      setApiFixtureState('copied');
      window.setTimeout(() => setApiFixtureState('idle'), 1500);
    } catch {
      setApiFixtureState('failed');
      window.setTimeout(() => setApiFixtureState('idle'), 1800);
    }
  }

  async function handleMockSync() {
    const result = await runExploreSyncQueue();
    setSyncMessage(`同步完成：成功 ${result.synced}，失败 ${result.failed}`);
    refresh();
  }

  async function handleMockFailSync() {
    const result = await runExploreSyncQueue({
      client: failingMockExploreSyncClient,
    });
    setSyncMessage(`模拟失败完成：成功 ${result.synced}，失败 ${result.failed}`);
    refresh();
  }

  function handleClearSyncQueue() {
    clearExploreSyncQueue();
    setSyncMessage('同步队列已清空。');
    refresh();
  }

  const stats = [
    ['引擎数量', audit.engineCount],
    ['节点数量', audit.nodeCount],
    ['已完成节点', audit.completedNodeCount],
    ['任务证据', audit.taskResultCount],
    ['媒体任务', audit.mediaTaskCount],
    ['待同步快照', audit.syncQueueCount],
  ] as const;

  return (
    <section className="rounded-[24px] border border-white/10 bg-[#020817]/92 px-4 py-4 shadow-[0_18px_38px_rgba(2,6,23,0.34)]">
      <div className="mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/38">Explore Freeze Audit</p>
        <h3 className="mt-1 text-lg font-black text-white">探索模块审计面板</h3>
        <p className="mt-1 text-xs font-bold leading-5 text-white/52">
          用于冻结 v0.1 本地闭环，检查节点、任务、媒体 Prompt 与本地学习证据。
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={refresh}
          className="rounded-2xl border border-cyan-200/22 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100 transition hover:bg-cyan-300/16"
        >
          刷新审计
        </button>

        <button
          type="button"
          onClick={() => void handleCopyExport()}
          className="rounded-2xl border border-violet-200/22 bg-violet-300/10 px-3 py-2 text-xs font-black text-violet-100 transition hover:bg-violet-300/16"
        >
          {copyState === 'copied' ? '已复制' : copyState === 'failed' ? '复制失败' : '复制导出 JSON'}
        </button>

        <button
          type="button"
          onClick={handleClear}
          className="rounded-2xl border border-rose-200/22 bg-rose-300/10 px-3 py-2 text-xs font-black text-rose-100 transition hover:bg-rose-300/16"
        >
          清空本地测试数据
        </button>

      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        {stats.map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3"
          >
            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-white/34">{label}</div>
            <div className="mt-1 text-xl font-black text-white">{value}</div>
          </div>
        ))}
      </div>

      <section className="mt-4 rounded-2xl border border-emerald-200/14 bg-emerald-300/10 px-3 py-3">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100/54">Remote Sync Queue</p>
            <h4 className="mt-1 text-sm font-black text-white">远程同步队列</h4>
          </div>
          <span className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-[10px] font-black text-white/54">
            {getExploreSyncClientLabel()}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            ['total', syncStats.total],
            ['pending', syncStats.pending],
            ['syncing', syncStats.syncing],
            ['synced', syncStats.synced],
            ['failed', syncStats.failed],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-white/10 bg-black/14 px-3 py-2"
            >
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-white/34">{label}</div>
              <div className="mt-1 text-lg font-black text-white">{value}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleGenerateRemoteSnapshot}
            className="rounded-2xl border border-emerald-200/22 bg-emerald-300/10 px-3 py-2 text-xs font-black text-emerald-100 transition hover:bg-emerald-300/16"
          >
            {syncState === 'queued' ? '已加入同步队列' : syncState === 'failed' ? '生成失败' : '生成远程同步快照'}
          </button>

          <button
            type="button"
            onClick={() => void handleMockSync()}
            className="rounded-2xl border border-cyan-200/22 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100 transition hover:bg-cyan-300/16"
          >
            模拟同步 pending 队列
          </button>

          <button
            type="button"
            onClick={() => void handleCopySyncApiRequestFixture()}
            className="rounded-2xl border border-violet-200/22 bg-violet-300/10 px-3 py-2 text-xs font-black text-violet-100 transition hover:bg-violet-300/16"
          >
            {apiFixtureState === 'copied' ? '请求样例已复制' : apiFixtureState === 'failed' ? '复制失败' : '复制 Sync API 请求样例'}
          </button>

          <button
            type="button"
            onClick={() => void handleMockFailSync()}
            className="rounded-2xl border border-amber-200/22 bg-amber-300/10 px-3 py-2 text-xs font-black text-amber-100 transition hover:bg-amber-300/16"
          >
            模拟失败同步
          </button>

          <button
            type="button"
            onClick={handleClearSyncQueue}
            className="rounded-2xl border border-rose-200/22 bg-rose-300/10 px-3 py-2 text-xs font-black text-rose-100 transition hover:bg-rose-300/16"
          >
            清空同步队列
          </button>
        </div>

        {syncMessage ? (
          <p className="mt-3 rounded-xl border border-white/10 bg-black/14 px-3 py-2 text-[11px] font-bold leading-4 text-white/58">
            {syncMessage}
          </p>
        ) : null}
      </section>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs font-black">
          <span className="text-white/82">健康分</span>
          <span className="text-white/46">{percent(audit.healthScore)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#38bdf8,#a78bfa,#f472b6)] transition-all duration-500"
            style={{ width: percent(audit.healthScore) }}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <IssueList
          title="缺失探索任务"
          items={audit.missingTasks}
          emptyText="所有节点都有探索任务。"
        />

        <IssueList
          title="缺失媒体种子"
          items={audit.missingMediaSeeds}
          emptyText="所有节点都有媒体生成种子。"
        />

        <IssueList
          title="无效跨引擎连接"
          items={audit.invalidCrossLinks.map(
            (item) => `${item.sourceKey} -> ${item.targetKey}`,
          )}
          emptyText="所有跨引擎连接有效。"
        />
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-[11px] font-bold leading-4 text-white/48">
        当前审计仅检查前端 seed data 与 localStorage，本阶段不接数据库和真实 API。
      </div>
    </section>
  );
}

function IssueList({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: string[];
  emptyText: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3">
      <div className="text-sm font-black text-white">{title}</div>

      {items.length === 0 ? (
        <p className="mt-2 text-xs font-bold leading-5 text-emerald-100/78">{emptyText}</p>
      ) : (
        <div className="mt-2 max-h-40 space-y-1 overflow-auto">
          {items.map((item) => (
            <div
              key={item}
              className="rounded-xl border border-white/8 bg-black/16 px-2 py-1 text-[11px] font-bold leading-4 text-white/64"
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
