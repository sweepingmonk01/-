import { useState } from 'react';
import {
  getDefaultExploreReadClient,
  type ExploreRemoteReadScope,
} from '../repository';
import type {
  CreateExploreTransferAttemptApiResponse,
  ExploreProgressApiResponse,
  ExploreSnapshotApiResponse,
  ExploreSyncBatchesApiResponse,
  ExploreTransferAttemptsApiResponse,
} from '../repository';

const defaultScope: ExploreRemoteReadScope = {
  userId: 'local-user',
  studentId: 'local-student',
  deviceId: 'local-device',
  sessionId: 'local-session',
};

const transferPresets = [
  {
    label: '语境判断',
    sourceNodeKey: 'language.context',
    sourceEvidenceId: 'debug-context-evidence',
    targetDomain: '社交沟通',
    userApplication: '我识别到语境判断结构，并把原题线索迁移到社交沟通：先看上下文和对方等待很久这个条件，再对应到真实意思，执行动作是道歉并重新约定时间，因为这样能验证我没有只复述原知识。',
  },
  {
    label: '守恒/对称',
    sourceNodeKey: 'physics.symmetry_conservation',
    sourceEvidenceId: 'debug-conservation-evidence',
    targetDomain: '生活规划',
    userApplication: '我识别到守恒/对称结构，并迁移到食谱调整：先找不变量是比例，再把 2 人份对应到 5 人份，执行动作是每个主料乘以 2.5，因为比例守恒才能得到稳定结果。',
  },
  {
    label: '反馈回路',
    sourceNodeKey: 'game.feedback_loop',
    sourceEvidenceId: 'debug-feedback-evidence',
    targetDomain: '运动训练',
    userApplication: '我识别到反馈回路结构，并迁移到投篮训练：先设目标，再记录动作和命中反馈，然后修复出手角度，下一轮验证结果，因为循环反馈能判断成功或失败。',
  },
];

export function ExploreRemoteDebugPanel() {
  const [snapshot, setSnapshot] =
    useState<ExploreSnapshotApiResponse | null>(null);
  const [progress, setProgress] =
    useState<ExploreProgressApiResponse | null>(null);
  const [batches, setBatches] =
    useState<ExploreSyncBatchesApiResponse | null>(null);
  const [transferAttempts, setTransferAttempts] =
    useState<ExploreTransferAttemptsApiResponse | null>(null);
  const [latestTransferResult, setLatestTransferResult] =
    useState<CreateExploreTransferAttemptApiResponse | null>(null);
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [userApplication, setUserApplication] = useState(transferPresets[0].userApplication);
  const [loading, setLoading] = useState(false);
  const [submittingTransfer, setSubmittingTransfer] = useState(false);
  const [message, setMessage] = useState('');

  async function handleLoadRemote() {
    setLoading(true);
    setMessage('');

    try {
      const client = getDefaultExploreReadClient();
      const [snapshotData, progressData, batchesData, transferData] = await Promise.all([
        client.getSnapshot(defaultScope),
        client.getProgress(defaultScope),
        client.getSyncBatches({ limit: 5 }),
        client.getTransferAttempts(defaultScope, { limit: 5 }),
      ]);

      setSnapshot(snapshotData);
      setProgress(progressData);
      setBatches(batchesData);
      setTransferAttempts(transferData);
      setMessage('远程 Explore 数据读取完成。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '读取远程数据失败。');
    } finally {
      setLoading(false);
    }
  }

  function handleSelectPreset(index: number) {
    setSelectedPresetIndex(index);
    setUserApplication(transferPresets[index].userApplication);
  }

  async function handleSubmitTransferAttempt() {
    setSubmittingTransfer(true);
    setMessage('');

    try {
      const client = getDefaultExploreReadClient();
      const preset = transferPresets[selectedPresetIndex];
      const result = await client.createTransferAttempt({
        userScope: defaultScope,
        sourceNodeKey: preset.sourceNodeKey,
        sourceEvidenceId: preset.sourceEvidenceId,
        targetDomain: preset.targetDomain,
        userApplication,
      });
      const [progressData, transferData] = await Promise.all([
        client.getProgress(defaultScope),
        client.getTransferAttempts(defaultScope, { limit: 5 }),
      ]);

      setLatestTransferResult(result);
      setProgress(progressData);
      setTransferAttempts(transferData);
      setMessage(result.message || '结构迁移验证完成。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '结构迁移验证失败。');
    } finally {
      setSubmittingTransfer(false);
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
            <MiniStat label="Transfer" value={snapshot.counts.transferAttempts} />
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
            <MiniStat label="Transfers" value={progress.progress.transferAttempts} />
            <MiniStat label="Success" value={progress.progress.successfulTransferAttempts} />
            <MiniStat label="Failed" value={progress.progress.failedTransferAttempts} />
            <MiniStat
              label="Rubric"
              value={`${Math.round(progress.progress.averageTransferRubricScore * 100)}%`}
            />
          </div>

          {progress.progress.latestTransferOutcome ? (
            <p className="mt-2 text-[11px] font-bold leading-4 text-white/42">
              Latest transfer: {progress.progress.latestTransferOutcome}
              {progress.progress.latestTransferRepairNodeKey ? ` | repair=${progress.progress.latestTransferRepairNodeKey}` : ''}
            </p>
          ) : null}

          {progress.progress.latestSyncedAt ? (
            <p className="mt-2 text-[11px] font-bold leading-4 text-white/42">
              Latest synced at: {progress.progress.latestSyncedAt}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-cyan-200/14 bg-cyan-300/[0.06] px-3 py-3">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-black text-white">Structure Transfer Mock</div>
            <p className="mt-1 text-[11px] font-bold leading-4 text-white/48">
              source evidence {'->'} unfamiliar target task {'->'} rubric {'->'} profile
            </p>
          </div>
          {latestTransferResult ? (
            <span className="rounded-full border border-white/10 bg-black/18 px-2 py-1 text-[10px] font-black uppercase text-white/62">
              {latestTransferResult.transferAttempt.outcome}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {transferPresets.map((preset, index) => (
            <button
              key={preset.sourceNodeKey}
              type="button"
              onClick={() => handleSelectPreset(index)}
              className={`rounded-xl border px-3 py-2 text-[11px] font-black transition ${
                selectedPresetIndex === index
                  ? 'border-cyan-100/32 bg-cyan-200/16 text-cyan-50'
                  : 'border-white/10 bg-black/14 text-white/58 hover:bg-white/8'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <MiniStat label="Source" value={transferPresets[selectedPresetIndex].sourceNodeKey} />
          <MiniStat label="Target" value={transferPresets[selectedPresetIndex].targetDomain} />
        </div>

        <textarea
          value={userApplication}
          onChange={(event) => setUserApplication(event.target.value)}
          className="mt-3 min-h-28 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-xs font-bold leading-5 text-white/76 outline-none transition placeholder:text-white/28 focus:border-cyan-100/30"
        />

        <button
          type="button"
          onClick={() => void handleSubmitTransferAttempt()}
          disabled={submittingTransfer || userApplication.trim().length === 0}
          className="mt-3 rounded-2xl border border-cyan-200/22 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100 transition hover:bg-cyan-300/16 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submittingTransfer ? '验证中...' : '提交结构迁移验证'}
        </button>

        {latestTransferResult ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <MiniStat
              label="Outcome"
              value={latestTransferResult.transferAttempt.outcome}
            />
            <MiniStat
              label="Rubric"
              value={`${Math.round(latestTransferResult.transferAttempt.rubricScore * 100)}%`}
            />
            <MiniStat
              label="Repair"
              value={latestTransferResult.transferAttempt.recommendedRepairNodeKey ?? 'none'}
            />
          </div>
        ) : null}
      </div>

      {transferAttempts ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3">
          <div className="text-sm font-black text-white">Recent Transfer Attempts</div>

          <div className="mt-2 space-y-2">
            {transferAttempts.transferAttempts.length > 0 ? (
              transferAttempts.transferAttempts.slice(0, 5).map((attempt) => (
                <div
                  key={attempt.id}
                  className="rounded-xl border border-white/8 bg-black/16 px-3 py-2 text-[11px] font-bold leading-4 text-white/58"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-black text-white/84">{attempt.extractedStructure.label}</div>
                    <div className="font-black uppercase text-white/50">{attempt.outcome}</div>
                  </div>
                  <div className="mt-1">
                    source={attempt.sourceNodeKey} | target={attempt.targetDomain} | score={Math.round(attempt.rubricScore * 100)}%
                  </div>
                  {attempt.recommendedRepairNodeKey ? (
                    <div className="mt-1 text-cyan-100/64">repair={attempt.recommendedRepairNodeKey}</div>
                  ) : null}
                  <div className="mt-1 text-white/38">{attempt.createdAt}</div>
                </div>
              ))
            ) : (
              <p className="text-xs font-bold leading-5 text-white/48">暂无结构迁移记录。</p>
            )}
          </div>
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
                    completed={batch.acceptedCompletedNodes} | tasks={batch.acceptedTaskResults} | media={batch.acceptedMediaTasks} | transfer={batch.acceptedTransferAttempts}
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
