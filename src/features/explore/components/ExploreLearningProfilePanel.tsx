import { useState } from 'react';
import { getNodeByKey } from '../data/exploreData';
import type { ExploreEngineKey } from '../data/exploreTypes';
import { buildExploreLearningProfile } from '../profile/buildExploreLearningProfile';
import type { ExploreLearningProfile } from '../profile/exploreLearningProfileTypes';
import { getDefaultExploreReadClient } from '../repository/exploreReadClientFactory';
import type { ExploreRemoteReadScope } from '../repository/httpExploreReadClient';

type Props = {
  onOpenNode?: (engineKey: ExploreEngineKey, nodeKey: string) => void;
};

const defaultScope: ExploreRemoteReadScope = {
  userId: 'local-user',
  studentId: 'local-student',
  deviceId: 'local-device',
  sessionId: 'local-session',
};

const stageLabel: Record<ExploreLearningProfile['stage'], string> = {
  seed: '种子期',
  forming: '成形期',
  connecting: '连接期',
  integrating: '整合期',
  structural: '结构期',
};

const strengthLabel: Record<ExploreLearningProfile['dominantStrength'], string> = {
  world: 'World Engine',
  mind: 'Mind Engine',
  meaning: 'Meaning Engine',
  game: 'Game Topology',
  balanced: '均衡发展',
  unknown: '证据不足',
};

const weaknessLabel: Record<ExploreLearningProfile['dominantWeakness'], string> = {
  world: 'World Engine',
  mind: 'Mind Engine',
  meaning: 'Meaning Engine',
  game: 'Game Topology',
  integration: '跨引擎整合',
  unknown: '证据不足',
};

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function ExploreLearningProfilePanel({ onOpenNode }: Props) {
  const [profile, setProfile] = useState<ExploreLearningProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function handleBuildProfile() {
    setLoading(true);
    setMessage('');

    try {
      const client = getDefaultExploreReadClient();
      const profileResponse = await client.getProfile(defaultScope);

      if (!profileResponse.ok) {
        setMessage(profileResponse.message || '后端 profile 读取失败。');
        return;
      }

      setProfile(profileResponse.profile);
      setMessage('长期学习画像已生成。');
    } catch (error) {
      try {
        const client = getDefaultExploreReadClient();
        const progress = await client.getProgress(defaultScope);

        if (!progress.ok) {
          setMessage(progress.message || '远程 progress 读取失败。');
          return;
        }

        const nextProfile = buildExploreLearningProfile(progress.progress);
        setProfile(nextProfile);
        setMessage('后端画像不可用，已回退到前端本地计算。');
      } catch (fallbackError) {
        setMessage(
          fallbackError instanceof Error
            ? fallbackError.message
            : error instanceof Error
              ? error.message
              : '生成学习画像失败。',
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function handleOpenRecommendedNode() {
    if (!profile?.recommendedNodeKey) return;

    const node = getNodeByKey(profile.recommendedNodeKey);
    if (!node) return;

    onOpenNode?.(node.engineKey, node.key);
  }

  async function handleSaveSnapshot() {
    setSaving(true);
    setMessage('');

    try {
      const client = getDefaultExploreReadClient();
      const response = await client.saveProfileSnapshot(defaultScope);

      if (!response.ok || !response.snapshotSaved) {
        setMessage(response.message || '御风快照保存失败。');
        return;
      }

      setProfile(response.profile);
      setMessage(response.message || '御风快照已保存。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '御风快照保存失败。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[24px] border border-fuchsia-200/16 bg-[#12091c]/90 px-4 py-4 shadow-[0_18px_38px_rgba(76,29,149,0.22)]">
      <div className="mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-fuchsia-100/52">Learning Profile</p>
        <h3 className="mt-1 text-lg font-black text-white">长期学习画像 v0.1</h3>
        <p className="mt-1 text-xs font-bold leading-5 text-white/52">
          基于后端 Explore Profile API 生成长期学习画像；若后端不可用，则回退到前端本地计算。
          保存御风快照后，你可以看到自己的结构化理解力如何变化。
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleBuildProfile()}
          disabled={loading}
          className="rounded-2xl border border-fuchsia-200/24 bg-fuchsia-300/10 px-3 py-2 text-xs font-black text-fuchsia-100 transition hover:bg-fuchsia-300/16 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? '生成中...' : '生成长期学习画像'}
        </button>
        <button
          type="button"
          onClick={() => void handleSaveSnapshot()}
          disabled={saving}
          className="rounded-2xl border border-emerald-200/24 bg-emerald-300/10 px-3 py-2 text-xs font-black text-emerald-100 transition hover:bg-emerald-300/16 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存御风快照'}
        </button>
      </div>

      {message ? (
        <p className="mt-3 rounded-xl border border-white/10 bg-black/14 px-3 py-2 text-[11px] font-bold leading-4 text-white/60">
          {message}
        </p>
      ) : null}

      {profile ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3">
            <div className="text-sm font-black text-white">ASI 主动结构化理解力</div>
            <div className="mt-2 text-3xl font-black text-fuchsia-100">
              {percent(profile.activeStructuralIntelligence)}
            </div>
            <p className="mt-2 text-xs font-bold leading-5 text-white/62">
              {profile.profileSummary}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="世界模型" value={profile.worldModelIndex} />
            <Metric label="心智模型" value={profile.mindModelIndex} />
            <Metric label="意义模型" value={profile.meaningModelIndex} />
            <Metric label="行动机制" value={profile.actionMechanismIndex} />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <MiniBlock label="阶段" value={stageLabel[profile.stage]} />
              <MiniBlock label="优势倾向" value={strengthLabel[profile.dominantStrength]} />
              <MiniBlock label="主要弱项" value={weaknessLabel[profile.dominantWeakness]} />
            </div>

            <p className="mt-3 text-xs font-bold leading-5 text-white/62">
              {profile.recommendedNextFocus}
            </p>

            {profile.recommendedNodeKey ? (
              <button
                type="button"
                onClick={handleOpenRecommendedNode}
                className="mt-3 rounded-2xl border border-cyan-200/24 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100 transition hover:bg-cyan-300/16"
              >
                进入推荐探索节点
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/14 px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-black text-white/72">{label}</span>
        <span className="text-xs font-black text-white/42">{percent(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#a78bfa,#f0abfc)]"
          style={{ width: percent(value) }}
        />
      </div>
    </div>
  );
}

function MiniBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/14 px-3 py-2">
      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-white/36">{label}</div>
      <div className="mt-1 text-sm font-black text-white">{value}</div>
    </div>
  );
}
