import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock, Compass, Navigation, RefreshCw, Save, Sparkles } from 'lucide-react';
import { getNodeByKey } from '../data/exploreData';
import { buildDailyYufengTask } from '../cockpit/buildDailyYufengTask';
import { buildFreedomTimeBudget } from '../cockpit/buildFreedomTimeBudget';
import {
  completeYufengDailyTask,
  getYufengDailyTaskState,
  startYufengDailyTask,
  subscribeYufengDailyTaskUpdated,
  type YufengDailyTaskStatus,
} from '../cockpit/yufengDailyTaskState';
import { getDefaultExploreReadClient } from '../repository/exploreReadClientFactory';
import type {
  ExploreProfileApiResponse,
  ExploreProfileHistoryItem,
} from '../repository/exploreProfileApiTypes';

const defaultScope = {
  userId: 'local-user',
  studentId: 'local-student',
  deviceId: 'local-device',
  sessionId: 'local-session',
};

const strengthLabel: Record<string, string> = {
  world: '世界模型',
  mind: '心智模型',
  meaning: '意义模型',
  game: '行动机制',
  balanced: '均衡连接',
  unknown: '继续探索中',
};

const weaknessLabel: Record<string, string> = {
  world: '世界模型',
  mind: '心智模型',
  meaning: '意义模型',
  game: '行动机制',
  integration: '跨模型整合',
  unknown: '继续探索中',
};

const stageLabel: Record<string, string> = {
  seed: '种子期',
  forming: '成形中',
  connecting: '连接期',
  integrating: '整合期',
  structural: '结构化御风',
};

function clampMetric(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function percent(value: number) {
  return `${Math.round(clampMetric(value) * 100)}%`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function yufengStatusText(status?: YufengDailyTaskStatus) {
  switch (status) {
    case 'started':
      return '进行中';
    case 'evidence-submitted':
      return '已提交探索证据';
    case 'snapshot-ready':
      return '待保存御风快照';
    case 'completed':
      return '今日御风完成';
    default:
      return '未开始';
  }
}

type ExploreCockpitViewProps = {
  onOpenExploreHome?: () => void;
  onOpenNode?: (engineKey: string, nodeKey: string) => void;
};

export default function ExploreCockpitView({
  onOpenExploreHome,
  onOpenNode,
}: ExploreCockpitViewProps) {
  const [profileResponse, setProfileResponse] = useState<ExploreProfileApiResponse | null>(null);
  const [history, setHistory] = useState<ExploreProfileHistoryItem[]>([]);
  const [dailyTaskState, setDailyTaskState] = useState(() => getYufengDailyTaskState());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const loadCockpit = useCallback(async () => {
    setLoading(true);
    setMessage('');

    try {
      const client = getDefaultExploreReadClient();
      const [profileData, historyData] = await Promise.all([
        client.getProfile(defaultScope),
        client.getProfileHistory(defaultScope, { limit: 20 }),
      ]);

      setProfileResponse(profileData.ok ? profileData : null);
      setHistory(historyData.ok ? historyData.snapshots : []);
      setDailyTaskState(getYufengDailyTaskState());

      if (!profileData.ok) {
        setMessage(profileData.message || '当前画像读取失败。');
      } else if (!historyData.ok) {
        setMessage(historyData.message || '御风轨迹读取失败。');
      }
    } catch (error) {
      setProfileResponse(null);
      setHistory([]);
      setMessage(error instanceof Error ? error.message : '御风舱加载失败。');
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleSaveSnapshot() {
    setLoading(true);
    setMessage('');

    try {
      const client = getDefaultExploreReadClient();
      const result = await client.saveProfileSnapshot(defaultScope);

      if (!result.ok) {
        setMessage(result.message || '御风快照保存失败。');
        return;
      }

      const completedTask = completeYufengDailyTask();
      setDailyTaskState(completedTask ?? getYufengDailyTaskState());
      await loadCockpit();
      setMessage('御风快照已保存。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '御风快照保存失败。');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenNodeKey(nodeKey: string | undefined, fallbackMessage: string) {
    if (!nodeKey) return;

    const node = getNodeByKey(nodeKey);
    if (!node) {
      setMessage(fallbackMessage);
      return;
    }

    onOpenNode?.(node.engineKey, node.key);
  }

  function handleOpenRecommendedNode() {
    handleOpenNodeKey(
      profileResponse?.profile?.recommendedNodeKey,
      '当前推荐节点暂未出现在探索地图中。',
    );
  }

  function handleStartDailyTask() {
    if (!dailyTask) return;

    const nodeKey = dailyTask.nextNodeKey;
    if (nodeKey) {
      const node = getNodeByKey(nodeKey);
      if (node) {
        const nextState = startYufengDailyTask({
          nodeKey: node.key,
          engineKey: node.engineKey,
        });
        setDailyTaskState(nextState);
        onOpenNode?.(node.engineKey, node.key);
        return;
      }
    }

    const nextState = startYufengDailyTask({});
    setDailyTaskState(nextState);
    onOpenExploreHome?.();
  }

  function handleDailyTaskAction() {
    if (!dailyTask) return;

    switch (dailyTaskState?.status) {
      case 'completed':
        onOpenExploreHome?.();
        return;
      case 'snapshot-ready':
      case 'evidence-submitted':
        void handleSaveSnapshot();
        return;
      case 'started':
        if (dailyTaskState.nodeKey) {
          handleOpenNodeKey(dailyTaskState.nodeKey, '今日御风任务节点暂未出现在探索地图中。');
          return;
        }
        if (dailyTask.nextNodeKey) {
          handleOpenNodeKey(dailyTask.nextNodeKey, '今日御风任务节点暂未出现在探索地图中。');
          return;
        }
        onOpenExploreHome?.();
        return;
      default:
        handleStartDailyTask();
    }
  }

  useEffect(() => {
    setDailyTaskState(getYufengDailyTaskState());
    void loadCockpit();
  }, [loadCockpit]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const refreshState = () => {
      setDailyTaskState(getYufengDailyTaskState());
    };

    const unsubscribe = subscribeYufengDailyTaskUpdated(refreshState);
    window.addEventListener('storage', refreshState);

    return () => {
      unsubscribe();
      window.removeEventListener('storage', refreshState);
    };
  }, []);

  const profile = profileResponse?.profile;
  const freedomBudget = profile
    ? buildFreedomTimeBudget({
        activeStructuralIntelligence: profile.activeStructuralIntelligence,
        stage: profile.stage,
        dominantWeakness: profile.dominantWeakness,
        recommendedNodeKey: profile.recommendedNodeKey,
        historyCount: history.length,
      })
    : null;
  const dailyTask = profile && freedomBudget
    ? buildDailyYufengTask({
        repairMinutes: freedomBudget.repairMinutes,
        recommendedNodeKey: freedomBudget.nextNodeKey ?? profile.recommendedNodeKey,
        dominantWeakness: profile.dominantWeakness,
        stage: profile.stage,
        historyCount: history.length,
      })
    : null;
  const dailyTaskActionLabel = (() => {
    switch (dailyTaskState?.status) {
      case 'started':
        return '继续今日御风任务';
      case 'evidence-submitted':
      case 'snapshot-ready':
        return '保存御风快照';
      case 'completed':
        return '进入自由探索';
      default:
        return '开始今日御风任务';
    }
  })();

  return (
    <div className="absolute inset-0 flex h-full w-full flex-col overflow-hidden bg-[#06111f] pb-24 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_10%,rgba(56,189,248,0.22),transparent_32%),radial-gradient(circle_at_84%_18%,rgba(16,185,129,0.14),transparent_28%),radial-gradient(circle_at_50%_94%,rgba(244,114,182,0.14),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:28px_28px]" />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-3 pt-3">
        <header className="mb-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onOpenExploreHome}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/14 bg-white/10 text-white shadow-[0_12px_24px_rgba(0,0,0,0.22)]"
            aria-label="返回探索地图"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/70">Free Flight Dashboard</p>
            <h1 className="truncate text-[22px] font-black leading-tight">御风舱</h1>
          </div>
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-cyan-100/18 bg-cyan-200/10 text-cyan-100">
            <Compass size={18} />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto rounded-[26px] border border-white/10 bg-white/[0.06] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="space-y-3">
            <section className="relative overflow-hidden rounded-[24px] border border-white/12 bg-[#020817] px-4 py-5 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_16%,rgba(56,189,248,0.20),transparent_34%),radial-gradient(circle_at_86%_14%,rgba(16,185,129,0.16),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.06),transparent_45%)]" />
              <div className="relative">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-100/18 bg-cyan-200/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
                  <Sparkles size={13} />
                  自由驾驶舱
                </div>
                <h2 className="text-[30px] font-black leading-none">御风舱</h2>
                <p className="mt-2 text-sm font-bold leading-5 text-white/82">
                  这是你的结构化理解力驾驶舱。看见自己的模型、轨迹与下一步飞行方向。
                </p>
                <p className="mt-2 text-[11px] font-bold leading-5 text-white/52">
                  这里的画像只服务学习者本人，是你的御风仪表盘。
                </p>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={loadCockpit}
                    disabled={loading}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-cyan-200/20 bg-cyan-300/10 px-3 py-3 text-xs font-black text-cyan-50 transition active:scale-[0.99] disabled:opacity-50"
                  >
                    <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    {loading ? '刷新中...' : '刷新当前画像'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSnapshot}
                    disabled={loading}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-200/20 bg-emerald-300/10 px-3 py-3 text-xs font-black text-emerald-50 transition active:scale-[0.99] disabled:opacity-50"
                  >
                    <Save size={15} />
                    保存御风快照
                  </button>
                  <button
                    type="button"
                    onClick={onOpenExploreHome}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/8 px-3 py-3 text-xs font-black text-white/78 transition active:scale-[0.99]"
                  >
                    <ArrowLeft size={15} />
                    返回探索地图
                  </button>
                </div>

                {message ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold leading-5 text-white/72">
                    {message}
                  </div>
                ) : null}
              </div>
            </section>

            {profile ? (
              <>
                <section className="grid gap-2">
                  <div className="rounded-[24px] border border-fuchsia-200/16 bg-white/[0.07] px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-fuchsia-100/70">ASI 主动结构化理解力</p>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <span className="text-[46px] font-black leading-none text-fuchsia-100">
                        {percent(profile.activeStructuralIntelligence)}
                      </span>
                      <Compass size={30} className="mb-1 text-fuchsia-100/55" />
                    </div>
                    <p className="mt-3 text-xs font-bold leading-5 text-white/64">{profile.profileSummary}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Metric label="世界模型" value={profile.worldModelIndex} />
                    <Metric label="心智模型" value={profile.mindModelIndex} />
                    <Metric label="意义模型" value={profile.meaningModelIndex} />
                    <Metric label="行动机制" value={profile.actionMechanismIndex} />
                  </div>
                </section>

                <section className="rounded-[24px] border border-white/10 bg-white/[0.07] px-4 py-4">
                  <div className="grid gap-2">
                    <MiniBlock label="当前阶段" value={stageLabel[profile.stage] ?? profile.stage} />
                    <MiniBlock label="优势倾向" value={strengthLabel[profile.dominantStrength] ?? profile.dominantStrength} />
                    <MiniBlock label="需要补强" value={weaknessLabel[profile.dominantWeakness] ?? profile.dominantWeakness} />
                  </div>

                  <div className="mt-3 rounded-2xl border border-white/10 bg-black/16 px-3 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/42">下一步御风节点</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-white/68">{profile.recommendedNextFocus}</p>
                    {profile.recommendedNodeKey ? (
                      <button
                        type="button"
                        onClick={handleOpenRecommendedNode}
                        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-200/20 bg-cyan-300/10 px-3 py-3 text-xs font-black text-cyan-50 transition active:scale-[0.99]"
                      >
                        进入下一步御风节点
                      </button>
                    ) : null}
                  </div>
                </section>

                {freedomBudget ? (
                  <section className="relative overflow-hidden rounded-[24px] border border-emerald-200/16 bg-white/[0.07] px-4 py-4">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_14%,rgba(16,185,129,0.18),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.07),transparent_45%)]" />
                    <div className="relative">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100/62">Freedom Time Budget</p>
                          <h2 className="mt-1 text-lg font-black">自由时间预算</h2>
                        </div>
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-emerald-100/16 bg-emerald-200/10 text-emerald-100">
                          <Clock size={18} />
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2">
                        <div className="rounded-2xl border border-white/10 bg-black/16 px-3 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-white/38">今日最短修复路径</div>
                          <p className="mt-1 text-xs font-bold leading-5 text-white/68">{freedomBudget.minimumRepairPath}</p>
                        </div>
                        <div className="rounded-2xl border border-emerald-100/14 bg-emerald-300/10 px-3 py-3">
                          <div className="flex items-end justify-between gap-3">
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100/58">预计必要修复</div>
                              <p className="mt-1 text-xs font-bold leading-5 text-white/62">完成这一步后，把剩余时间还给自由探索。</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <span className="text-[34px] font-black leading-none text-emerald-100">{freedomBudget.repairMinutes}</span>
                              <span className="ml-1 text-xs font-black text-emerald-100/64">分钟</span>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/16 px-3 py-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-white/38">自由探索建议</div>
                          <p className="mt-1 text-xs font-bold leading-5 text-white/68">{freedomBudget.freedomSuggestion}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={freedomBudget.nextNodeKey ? handleOpenRecommendedNode : onOpenExploreHome}
                        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200/20 bg-emerald-300/10 px-3 py-3 text-xs font-black text-emerald-50 transition active:scale-[0.99]"
                      >
                        <Navigation size={15} />
                        {freedomBudget.nextActionLabel}
                      </button>
                    </div>
                  </section>
                ) : null}

                {dailyTask ? (
                  <section className="relative overflow-hidden rounded-[24px] border border-cyan-200/16 bg-white/[0.07] px-4 py-4">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_12%,rgba(34,211,238,0.18),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.07),transparent_48%)]" />
                    <div className="relative">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100/62">Daily Free Flight</p>
                          <h2 className="mt-1 text-lg font-black">{dailyTask.title}</h2>
                        </div>
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-cyan-100/16 bg-cyan-200/10 text-cyan-100">
                          <CheckCircle2 size={18} />
                        </div>
                      </div>

                      <p className="mt-2 text-xs font-bold leading-5 text-white/62">
                        用最短必要路径完成一次修复，然后进入自由探索。
                      </p>

                      <div className="mt-3 grid gap-2">
                        <TaskRow label="当前状态" value={yufengStatusText(dailyTaskState?.status)} />
                        <TaskRow label="最短路径" value={dailyTask.path} />
                        <TaskRow label="完成标准" value={dailyTask.completionStandard} />
                        <TaskRow label="完成后" value={dailyTask.afterCompletion} />
                      </div>

                      <div className="mt-3 rounded-2xl border border-cyan-100/14 bg-cyan-300/10 px-3 py-3">
                        <div className="flex items-end justify-between gap-3">
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100/58">预计必要修复</div>
                            <p className="mt-1 text-xs font-bold leading-5 text-white/62">完成今日最短行动后，再回到自己的兴趣航线。</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className="text-[34px] font-black leading-none text-cyan-100">{dailyTask.estimatedMinutes}</span>
                            <span className="ml-1 text-xs font-black text-cyan-100/64">分钟</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleDailyTaskAction}
                        disabled={loading}
                        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-200/20 bg-cyan-300/10 px-3 py-3 text-xs font-black text-cyan-50 transition active:scale-[0.99]"
                      >
                        <Navigation size={15} />
                        {dailyTaskActionLabel}
                      </button>
                    </div>
                  </section>
                ) : null}
              </>
            ) : (
              <section className="rounded-[24px] border border-white/10 bg-white/[0.07] px-4 py-4 text-xs font-bold leading-5 text-white/58">
                暂无画像数据。请先在探索模块完成任务、同步数据，再刷新御风舱。
              </section>
            )}

            <section className="rounded-[24px] border border-indigo-200/16 bg-white/[0.07] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-indigo-100/62">Flight Trace</p>
                  <h2 className="mt-1 text-lg font-black">御风轨迹</h2>
                </div>
                <div className="grid h-11 w-11 place-items-center rounded-2xl border border-indigo-100/16 bg-indigo-200/10 text-indigo-100">
                  <Compass size={18} />
                </div>
              </div>
              <p className="mt-2 text-xs font-bold leading-5 text-white/58">
                这里记录的是你主动保存的结构化理解力快照，用来观察自己的成长航向。
              </p>

              <div className="mt-3 space-y-2">
                {history.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/16 px-3 py-3 text-xs font-bold leading-5 text-white/54">
                    还没有御风快照。点击“保存御风快照”后，这里会出现你的轨迹。
                  </div>
                ) : (
                  history.map((item) => (
                    <article key={item.id} className="rounded-2xl border border-white/10 bg-black/16 px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-white">ASI {percent(item.activeStructuralIntelligence)}</p>
                          <p className="mt-1 text-[10px] font-bold text-white/42">
                            {stageLabel[item.stage] ?? item.stage} · {formatDateTime(item.generatedAt)}
                          </p>
                        </div>
                        <div className="shrink-0 rounded-full border border-white/10 bg-white/8 px-2 py-1 text-[10px] font-black text-white/58">
                          快照
                        </div>
                      </div>

                      <p className="mt-2 text-[11px] font-bold leading-4 text-white/56">
                        强项：{strengthLabel[item.dominantStrength] ?? item.dominantStrength} · 补强：{weaknessLabel[item.dominantWeakness] ?? item.dominantWeakness}
                      </p>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <MetricMini label="World" value={item.worldModelIndex} />
                        <MetricMini label="Mind" value={item.mindModelIndex} />
                        <MetricMini label="Meaning" value={item.meaningModelIndex} />
                        <MetricMini label="Action" value={item.actionMechanismIndex} />
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-black/16 px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-black">
        <span className="text-white/70">{label}</span>
        <span className="text-white/42">{percent(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#34d399,#a78bfa)]"
          style={{ width: percent(value) }}
        />
      </div>
    </div>
  );
}

function MetricMini({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-bold">
        <span className="text-white/46">{label}</span>
        <span className="text-white/36">{percent(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#818cf8)]"
          style={{ width: percent(value) }}
        />
      </div>
    </div>
  );
}

function MiniBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/16 px-3 py-3">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-white/38">{label}</div>
      <div className="mt-1 text-sm font-black text-white">{value}</div>
    </div>
  );
}

function TaskRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/16 px-3 py-3">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-white/38">{label}</div>
      <p className="mt-1 text-xs font-bold leading-5 text-white/68">{value}</p>
    </div>
  );
}
