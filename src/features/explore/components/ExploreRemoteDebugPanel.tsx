import { useState } from 'react';
import {
  getDefaultExploreReadClient,
  type ExploreRemoteReadScope,
} from '../repository';
import type {
  ExploreProgressApiResponse,
  ExploreSnapshotApiResponse,
  ExploreSyncBatchesApiResponse,
} from '../repository';

const defaultScope: ExploreRemoteReadScope = {
  userId: 'local-user',
  studentId: 'local-student',
  deviceId: 'local-device',
  sessionId: 'local-session',
};

export function ExploreRemoteDebugPanel() {
  const [snapshot, setSnapshot] =
    useState<ExploreSnapshotApiResponse | null>(null);
  const [progress, setProgress] =
    useState<ExploreProgressApiResponse | null>(null);
  const [batches, setBatches] =
    useState<ExploreSyncBatchesApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function handleLoadRemote() {
    setLoading(true);
    setMessage('');

    try {
      const client = getDefaultExploreReadClient();
      const [snapshotData, progressData, batchesData] = await Promise.all([
        client.getSnapshot(defaultScope),
        client.getProgress(defaultScope),
        client.getSyncBatches({ limit: 5 }),
      ]);

      setSnapshot(snapshotData);
      setProgress(progressData);
      setBatches(batchesData);
      setMessage('远程 Explore 数据读取完成。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '读取远程数据失败。');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-[24px] border border-emerald-200/14 bg-[#020817]/92 px-4 py-4 shadow-[0_18px_38px_rgba(2,6,23,0.34)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100/50">Remote Readback</p>
          <h3 className="mt-1 text-lg font-black text-white">远程 Explore 数据读取</h3>
          <p className="mt-1 text-xs font-bold leading-5 text-white/52">
            从 SQLite 后端读取 snapshot、progress 与最近同步批次。
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-[10px] font-black text-white/54">
          http
        </span>
      </div>

      <button
        type="button"
        onClick={() => void handleLoadRemote()}
        disabled={loading}
        className="rounded-2xl border border-emerald-200/22 bg-emerald-300/10 px-3 py-2 text-xs font-black text-emerald-100 transition hover:bg-emerald-300/16 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? '读取中...' : '读取远程 Explore 数据'}
      </button>

      {message ? (
        <p className="mt-3 rounded-xl border border-white/10 bg-black/14 px-3 py-2 text-[11px] font-bold leading-4 text-white/58">
          {message}
        </p>
      ) : null}

      {snapshot ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3">
          <div className="text-sm font-black text-white">Remote Snapshot Counts</div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <MiniStat label="Completed" value={snapshot.counts.completedNodes} />
            <MiniStat label="Tasks" value={snapshot.counts.taskResults} />
            <MiniStat label="Media" value={snapshot.counts.mediaTasks} />
          </div>
        </div>
      ) : null}

      {progress ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3">
          <div className="text-sm font-black text-white">Remote Progress</div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <MiniStat label="World" value={progress.progress.engines.worldEngine} />
            <MiniStat label="Mind" value={progress.progress.engines.mindEngine} />
            <MiniStat label="Meaning" value={progress.progress.engines.meaningEngine} />
            <MiniStat label="Game" value={progress.progress.engines.gameTopologyEngine} />
            <MiniStat
              label="Avg Quality"
              value={`${Math.round(progress.progress.averageTaskQuality * 100)}%`}
            />
          </div>

          {progress.progress.latestSyncedAt ? (
            <p className="mt-2 text-[11px] font-bold leading-4 text-white/42">
              Latest synced at: {progress.progress.latestSyncedAt}
            </p>
          ) : null}
        </div>
      ) : null}

      {batches ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3">
          <div className="text-sm font-black text-white">Recent Sync Batches</div>

          <div className="mt-2 space-y-2">
            {batches.batches.length > 0 ? (
              batches.batches.slice(0, 5).map((batch) => (
                <div
                  key={batch.id}
                  className="rounded-xl border border-white/8 bg-black/16 px-3 py-2 text-[11px] font-bold leading-4 text-white/58"
                >
                  <div className="font-black text-white/84">{batch.id}</div>
                  <div className="mt-1">
                    completed={batch.acceptedCompletedNodes} | tasks={batch.acceptedTaskResults} | media={batch.acceptedMediaTasks}
                  </div>
                  <div className="mt-1 text-white/38">{batch.createdAt}</div>
                </div>
              ))
            ) : (
              <p className="text-xs font-bold leading-5 text-white/48">暂无远程同步批次。</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/14 px-3 py-2">
      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-white/34">{label}</div>
      <div className="mt-1 text-lg font-black text-white">{value}</div>
    </div>
  );
}
