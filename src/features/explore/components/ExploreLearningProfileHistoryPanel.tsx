import { useState } from 'react';
import {
  getDefaultExploreReadClient,
  type ExploreProfileHistoryItem,
  type ExploreRemoteReadScope,
} from '../repository';

const defaultScope: ExploreRemoteReadScope = {
  userId: 'local-user',
  studentId: 'local-student',
  deviceId: 'local-device',
  sessionId: 'local-session',
};

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function ExploreLearningProfileHistoryPanel() {
  const [snapshots, setSnapshots] = useState<ExploreProfileHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function handleLoadHistory() {
    setLoading(true);
    setMessage('');

    try {
      const client = getDefaultExploreReadClient();
      const response = await client.getProfileHistory(defaultScope, { limit: 20 });

      if (!response.ok) {
        setMessage(response.message || '御风轨迹读取失败。');
        return;
      }

      setSnapshots(response.snapshots);
      setMessage(response.snapshots.length > 0 ? '御风轨迹已读取。' : '还没有保存过御风快照。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '御风轨迹读取失败。');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-[24px] border border-cyan-200/16 bg-[#061421]/90 px-4 py-4 shadow-[0_18px_38px_rgba(8,47,73,0.22)]">
      <div className="mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/52">Free Flight Trace</p>
        <h3 className="mt-1 text-lg font-black text-white">御风轨迹</h3>
        <p className="mt-1 text-xs font-bold leading-5 text-white/52">
          这里记录的是你主动保存的结构化理解力快照，用来观察自己如何变强。
        </p>
      </div>

      <button
        type="button"
        onClick={() => void handleLoadHistory()}
        disabled={loading}
        className="rounded-2xl border border-cyan-200/24 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100 transition hover:bg-cyan-300/16 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? '读取中...' : '读取御风轨迹'}
      </button>

      {message ? (
        <p className="mt-3 rounded-xl border border-white/10 bg-black/14 px-3 py-2 text-[11px] font-bold leading-4 text-white/60">
          {message}
        </p>
      ) : null}

      {snapshots.length > 0 ? (
        <div className="mt-4 space-y-2">
          {snapshots.map((snapshot) => (
            <article
              key={snapshot.id}
              className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-black text-white">
                    ASI {percent(snapshot.activeStructuralIntelligence)}
                  </div>
                  <div className="mt-1 text-[11px] font-bold leading-4 text-white/42">
                    {snapshot.generatedAt}
                  </div>
                </div>
                <div className="rounded-full border border-white/10 bg-black/14 px-2 py-1 text-[10px] font-black text-white/52">
                  {snapshot.stage}
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <MiniMetric label="World" value={snapshot.worldModelIndex} />
                <MiniMetric label="Mind" value={snapshot.mindModelIndex} />
                <MiniMetric label="Meaning" value={snapshot.meaningModelIndex} />
                <MiniMetric label="Game" value={snapshot.actionMechanismIndex} />
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <MiniBlock label="强项" value={snapshot.dominantStrength} />
                <MiniBlock label="弱项" value={snapshot.dominantWeakness} />
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/14 px-2 py-2">
      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-white/36">{label}</div>
      <div className="mt-1 text-sm font-black text-white">{percent(value)}</div>
    </div>
  );
}

function MiniBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/14 px-2 py-2">
      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-white/36">{label}</div>
      <div className="mt-1 text-sm font-black text-white">{value}</div>
    </div>
  );
}
