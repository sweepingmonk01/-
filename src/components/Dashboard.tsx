import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';
import {
  ArrowRight,
  Brain,
  ChevronLeft,
  Crosshair,
  ShieldAlert,
  Sparkles,
  Target,
  Upload,
  Wand2,
  Zap,
} from 'lucide-react';

interface DashboardProps {
  studentId: string;
  onNavigate: (screen: string) => void;
  onReturnHome: () => void;
  onTriggerUpload: () => void;
  onTriggerDehydrate: () => void;
}

interface DashboardStats {
  timeSavedHours?: number;
  estimatedScore?: number;
  targetScore?: number;
  activeIssuesCount?: number;
  topPainPoints?: string[];
  cognitiveState?: {
    focus?: number;
    frustration?: number;
    joy?: number;
  };
}

const shellCard =
  'rounded-[28px] border border-[#1a1a2e]/10 bg-white/88 backdrop-blur-sm shadow-[0_24px_60px_rgba(26,26,46,0.08)]';

export default function Dashboard({
  studentId,
  onNavigate,
  onReturnHome,
  onTriggerUpload,
  onTriggerDehydrate,
}: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch(`/api/mobius/students/${encodeURIComponent(studentId)}/dashboard-stats`);
        if (res.ok) {
          const data = (await res.json()) as DashboardStats;
          setStats(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [studentId]);

  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(180deg,#f6f8ff_0%,#eef3ff_100%)] px-6">
        <div className="rounded-[28px] border border-[#1a1a2e]/10 bg-white/90 px-8 py-7 text-center shadow-[0_24px_60px_rgba(26,26,46,0.08)]">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            <Brain size={24} />
          </div>
          <p className="text-lg font-black text-[#1a1a2e]">认知数据同步中</p>
          <p className="mt-2 text-sm font-medium text-gray-500">正在生成今日主线与作战优先级...</p>
        </div>
      </div>
    );
  }

  const radarData = [
    { subject: '专注', A: stats?.cognitiveState?.focus || 50, fullMark: 100 },
    { subject: '挫败', A: stats?.cognitiveState?.frustration || 0, fullMark: 100 },
    { subject: '愉悦', A: stats?.cognitiveState?.joy || 50, fullMark: 100 },
  ];

  const estimatedScore = stats?.estimatedScore || 0;
  const targetScore = stats?.targetScore || 115;
  const progressPercent = Math.min(100, (estimatedScore / targetScore) * 100);
  const painPoints = (stats?.topPainPoints || []).slice(0, 2);
  const isOverloaded = (stats?.cognitiveState?.frustration || 0) > 60;
  const leadPainPoint = painPoints[0] || '当前主线比较稳，可以先把节奏守住。';
  const backupPainPoint = painPoints[1] || '首屏先看战况，再决定是否打开新题型。';
  const coreModuleTitle = isOverloaded ? '先稳住节奏' : '直接打主线';
  const coreModuleDetail = isOverloaded
    ? '先做最确定的一步，别同时开太多任务。'
    : leadPainPoint;
  const coreModuleTag = stats?.activeIssuesCount ? '优先修漏洞' : '主线清晰';
  const secondLayerCards = [
    {
      id: 'error-book',
      eyebrow: 'Recovery Lane',
      title: stats?.activeIssuesCount ? '错题回收带' : '错题缓冲带',
      detail: stats?.activeIssuesCount
        ? `还有 ${stats?.activeIssuesCount || 0} 个漏洞待收。`
        : '当前没有高危漏洞。',
      tone:
        'border-[#1a1a2e]/10 bg-white text-[#1a1a2e] shadow-[0_18px_36px_rgba(26,26,46,0.06)]',
      cta: '进入错题',
      action: () => onNavigate('error-book'),
    },
    {
      id: 'subject-map',
      eyebrow: 'Focus Node',
      title: '学科落点',
      detail: '看现在该压哪一科。',
      tone:
        'border-[var(--color-primary)]/18 bg-[linear-gradient(160deg,rgba(61,123,255,0.16),rgba(108,168,255,0.1))] text-[#1a1a2e] shadow-[0_20px_40px_rgba(61,123,255,0.1)]',
      cta: '去学科岛',
      action: () => onNavigate('subject-map'),
    },
    {
      id: 'dehydrate',
      eyebrow: 'Relief Pass',
      title: '今晚减压口',
      detail: `目标 ${targetScore} 分，先切掉低效题量。`,
      tone:
        'border-[var(--color-secondary)]/18 bg-[linear-gradient(155deg,rgba(255,138,61,0.16),rgba(255,190,11,0.1))] text-[#1a1a2e] shadow-[0_20px_40px_rgba(255,138,61,0.1)]',
      cta: '开始脱水',
      action: onTriggerDehydrate,
    },
  ];

  return (
    <div className="absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-[linear-gradient(180deg,#f8fbff_0%,#eaf2ff_46%,#fff7ef_100%)] px-3 pb-24 pt-3">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_14%_16%,rgba(61,123,255,0.26),transparent_34%),radial-gradient(circle_at_88%_20%,rgba(255,138,61,0.22),transparent_30%),radial-gradient(circle_at_56%_72%,rgba(255,95,162,0.14),transparent_32%)]" />

      <div className="mx-auto flex min-h-[calc(100%+72px)] w-full max-w-lg flex-col gap-2.5 pb-5">
        <div className={`${shellCard} relative overflow-hidden px-3.5 py-3`}>
          <div className="absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(61,123,255,0.35),transparent)]" />
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={onReturnHome}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#1a1a2e]/10 bg-white px-3 py-2 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-50"
            >
              <ChevronLeft size={14} />
              返回首页
            </button>
            <button
              onClick={() => onNavigate('overview')}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#1a1a2e]/10 bg-white px-3 py-2 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-50"
            >
              驾驶舱
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        <div className="grid shrink-0 auto-rows-[minmax(98px,auto)] grid-cols-6 gap-2.5 pb-1">
          <motion.section
            initial={{ opacity: 0, y: 18, rotate: -3 }}
            animate={{ opacity: 1, y: 0, rotate: -1.2 }}
            transition={{ duration: 0.38 }}
            className="dashboard-halftone relative col-span-4 row-span-2 flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-[#7aa7ff]/28 bg-[linear-gradient(180deg,#ffffff_0%,#edf4ff_72%,#ffeef7_100%)] px-3.5 py-3 shadow-[0_22px_42px_rgba(61,123,255,0.16)]"
          >
            <div className="absolute -right-8 top-3 h-24 w-24 rounded-full bg-[rgba(61,123,255,0.14)] blur-2xl" />
            <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-full border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--color-primary)]">
              <Sparkles size={12} />
              今日作战板
            </div>
            <h1 className="text-[27px] font-display font-bold leading-[0.98] text-[#1a1a2e]">
              首屏就看完
              <br />
              今天主战线
            </h1>
            <p className="mt-1.5 text-[11px] leading-5 text-gray-600">
              不做往下刷的文档页，把动作、收益和风险直接拼进第一屏。
            </p>

            <div className="mt-2.5 rounded-[20px] border border-[#7aa7ff]/22 bg-white/92 px-3 py-2.5 shadow-[0_14px_26px_rgba(61,123,255,0.10)]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">Main Frame</p>
                <div className="rounded-full bg-[linear-gradient(90deg,rgba(61,123,255,0.12),rgba(255,95,162,0.12))] px-2.5 py-1 text-[10px] font-black text-[var(--color-primary)]">
                  一眼可见
                </div>
              </div>
              <p className="mt-1.5 text-[14px] font-black leading-5.5 text-[#1a1a2e]">{leadPainPoint}</p>
              <div className="mt-2 flex items-start gap-2 rounded-[16px] bg-[linear-gradient(180deg,#f3f7ff_0%,#fff3f8_100%)] px-2.5 py-1.5">
                <Target size={15} className="mt-0.5 shrink-0 text-[var(--color-secondary)]" />
                <p className="text-[11px] font-bold leading-5 text-gray-600">{backupPainPoint}</p>
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <div className="rounded-[18px] border border-[#7aa7ff]/18 bg-white px-3 py-2">
                <div className="mb-1.5 flex items-center gap-1.5 text-[var(--color-primary)]">
                  <Zap size={13} />
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">解放时间</p>
                </div>
                <p className="text-[30px] font-black leading-none text-[#1a1a2e]">{stats?.timeSavedHours || 0}</p>
                <p className="mt-1 text-[11px] font-bold text-gray-500">小时可回收</p>
              </div>

              <div className="rounded-[18px] border border-[#33d1a0]/18 bg-white px-3 py-2">
                <div className="mb-1.5 flex items-center gap-1.5 text-[var(--color-accent-green)]">
                  <Crosshair size={13} />
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">提分战力</p>
                </div>
                <p className="text-[30px] font-black leading-none text-[#1a1a2e]">{estimatedScore}</p>
                <p className="mt-1 text-[11px] font-bold text-gray-500">目标 {targetScore}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#dfe7ff]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-primary),#6ca8ff)] transition-all duration-1000"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 18, rotate: 3 }}
            animate={{ opacity: 1, y: 6, rotate: 1.8 }}
            transition={{ duration: 0.42, delay: 0.04 }}
            className="dashboard-night-grid relative col-span-2 row-span-2 flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-cyan-200/14 bg-[linear-gradient(180deg,#1c2350_0%,#253171_72%,#332764_100%)] px-3 py-2.5 text-white shadow-[0_22px_46px_rgba(37,49,113,0.28)]"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/70">Live State</p>
                <h2 className="mt-1 text-lg font-black leading-tight">认知雷达</h2>
              </div>
                <div className={`rounded-full px-2 py-1 text-[10px] font-bold ${isOverloaded ? 'border border-red-300/24 bg-red-400/18 text-red-100' : 'border border-cyan-200/24 bg-cyan-300/14 text-cyan-100'}`}>
                  {isOverloaded ? '需保护' : '节奏稳'}
                </div>
              </div>

            <div className="rounded-[20px] border border-white/10 bg-white/6 px-2 py-2">
              <ResponsiveContainer width="100%" height={118}>
                <RadarChart cx="50%" cy="50%" outerRadius="66%" data={radarData}>
                  <PolarGrid stroke="#ffffff22" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#dbeafe', fontSize: 10, fontFamily: 'Nunito' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="State" dataKey="A" stroke="#7dd3fc" fill="#7dd3fc" fillOpacity={0.32} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-1.5 grid grid-cols-1 gap-1.5">
              <div className="rounded-[16px] bg-white/8 px-2.5 py-1.5">
                <p className="text-[10px] font-black text-slate-400">专注 / 挫败 / 愉悦</p>
                <p className="mt-1 text-sm font-black text-white">
                  {stats?.cognitiveState?.focus || 50} / {stats?.cognitiveState?.frustration || 0} / {stats?.cognitiveState?.joy || 50}
                </p>
              </div>
            </div>
          </motion.section>

          <motion.button
            initial={{ opacity: 0, x: -16, rotate: -3 }}
            animate={{ opacity: 1, x: 0, y: -3, rotate: -1.8 }}
            transition={{ duration: 0.35, delay: 0.06 }}
            onClick={onTriggerUpload}
            className="group relative col-span-3 flex min-h-0 flex-col rounded-[26px] border border-[var(--color-primary)]/22 bg-[linear-gradient(155deg,rgba(61,123,255,0.22),rgba(129,184,255,0.14),rgba(255,255,255,0.6))] px-3.5 py-3 text-left shadow-[0_20px_38px_rgba(61,123,255,0.16)]"
          >
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#4d8dff_0%,#2b5bde_100%)] text-white shadow-[0_10px_18px_rgba(61,123,255,0.28)]">
              <Upload size={18} />
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--color-primary)]/70">Action 01</p>
            <h3 className="mt-1 text-[21px] font-black leading-tight text-[#1a1a2e]">拍题破局</h3>
            <p className="mt-1 text-[11px] leading-5 text-gray-600">先抓真实难题，马上拆出规则断点。</p>
            <div className="mt-3 text-sm font-bold text-[var(--color-primary)] transition-transform group-hover:translate-x-1">
              立刻开始
            </div>
          </motion.button>

          <motion.div
            initial={{ opacity: 0, x: 16, rotate: 3 }}
            animate={{ opacity: 1, x: 0, y: 3, rotate: 1.4 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="col-span-3 flex min-h-0 flex-col rounded-[24px] border border-[#ffb287]/26 bg-[linear-gradient(180deg,#ffffff_0%,#fff8f2_100%)] px-3.5 py-3 shadow-[0_18px_34px_rgba(255,138,61,0.10)]"
          >
            <div className="mb-2 flex items-center gap-2 text-[var(--color-secondary)]">
              <ShieldAlert size={16} />
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">最高优先风险</p>
            </div>
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-4xl font-black leading-none text-[#1a1a2e]">{stats?.activeIssuesCount || 0}</p>
                <p className="mt-1 text-xs font-bold text-gray-500">个待修漏洞</p>
              </div>
              <div className={`rounded-full px-2.5 py-1 text-[10px] font-black ${isOverloaded ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}>
                {isOverloaded ? '先降压' : '可推进'}
              </div>
            </div>

            <div className="mt-2.5 rounded-[16px] bg-[linear-gradient(180deg,#fff4ea_0%,#f7f9ff_100%)] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">Core Module</p>
                <div className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-[var(--color-primary)] shadow-[0_6px_14px_rgba(61,123,255,0.08)]">
                  {coreModuleTag}
                </div>
              </div>
              <h3 className="mt-2 text-sm font-black text-[#1a1a2e]">{coreModuleTitle}</h3>
              <p className="mt-1 text-[11px] leading-5 text-gray-500">{coreModuleDetail}</p>
              <div className="mt-3 flex items-center gap-2">
                <div className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-gray-500">
                  进度 {progressPercent.toFixed(0)}%
                </div>
                <div className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-gray-500">
                  {isOverloaded ? '单线程推进' : '可继续压进'}
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12, rotate: -2.4 }}
            animate={{ opacity: 1, y: 0, rotate: -1.2 }}
            transition={{ duration: 0.42, delay: 0.1 }}
            className="dashboard-night-grid col-span-2 flex min-h-0 flex-col rounded-[24px] border border-fuchsia-200/12 bg-[linear-gradient(180deg,#22295a_0%,#2f2f75_66%,#4f2d74_100%)] px-3 py-2.5 text-white shadow-[0_20px_40px_rgba(79,45,116,0.24)]"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200/70">Priority Comic</p>
            <h3 className="mt-1 text-base font-black">今天先打这里</h3>
            <div className="mt-2.5 space-y-2">
              {painPoints.length ? (
                painPoints.map((pt, idx) => (
                  <div key={`${pt}-${idx}`} className="rounded-[16px] border border-white/10 bg-white/8 px-3 py-2.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Target {idx + 1}</p>
                    <p className="mt-1 text-[11px] font-bold leading-5 text-white">{pt}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-[16px] border border-white/10 bg-white/8 px-3 py-3">
                  <p className="text-[11px] font-bold leading-5 text-white">主线稳定，今天可以少量扩展。</p>
                </div>
              )}
            </div>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, y: 12, rotate: 2.6 }}
            animate={{ opacity: 1, y: 3, rotate: 1.4 }}
            transition={{ duration: 0.45, delay: 0.12 }}
            onClick={onTriggerDehydrate}
            className="group col-span-4 flex min-h-0 flex-col rounded-[26px] border border-[var(--color-secondary)]/22 bg-[linear-gradient(155deg,rgba(255,138,61,0.22),rgba(255,190,11,0.14),rgba(255,255,255,0.52))] px-3.5 py-3 text-left shadow-[0_20px_40px_rgba(255,138,61,0.16)]"
          >
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#ff9b54_0%,#ff6e2f_100%)] text-white shadow-[0_10px_18px_rgba(255,138,61,0.26)]">
              <Wand2 size={18} />
            </div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--color-secondary)]/80">Action 02</p>
                <h3 className="mt-1 text-[21px] font-black leading-tight text-[#1a1a2e]">作业脱水</h3>
                <p className="mt-1 text-[11px] leading-5 text-gray-600">保留必须做的题，别让题量先压垮节奏。</p>
              </div>
              <div className="rounded-full bg-white/86 px-2.5 py-1 text-[10px] font-black text-[var(--color-secondary)]">
                后手入口
              </div>
            </div>
            <div className="mt-3 text-sm font-bold text-[var(--color-secondary)] transition-transform group-hover:translate-x-1">
              开始筛题
            </div>
          </motion.button>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.16 }}
          className="relative mt-0.5 rounded-[28px] border border-[#7aa7ff]/18 bg-white/82 px-3.5 py-3 shadow-[0_24px_46px_rgba(61,123,255,0.10)] backdrop-blur-sm"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Second Layer</p>
            <div className="rounded-full bg-[linear-gradient(90deg,#edf4ff_0%,#fff2f7_100%)] px-3 py-1 text-[10px] font-black text-[var(--color-primary)]">
              核心模块
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {secondLayerCards.map((card, index) => (
              <motion.button
                key={card.id}
                initial={{ opacity: 0, y: 16, rotate: index % 2 === 0 ? -1.4 : 1.4 }}
                animate={{ opacity: 1, y: 0, rotate: index % 2 === 0 ? -0.6 : 0.6 }}
                transition={{ duration: 0.35, delay: 0.18 + index * 0.05 }}
                onClick={card.action}
                className={`group flex min-h-[118px] w-full flex-col rounded-[20px] border px-3 py-2.5 text-left ${card.id === 'dehydrate' ? 'col-span-2' : ''} ${card.tone}`}
              >
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">{card.eyebrow}</p>
                <h3 className="mt-1 text-[17px] font-black leading-tight">{card.title}</h3>
                <p className="mt-1 text-[11px] leading-5 text-gray-600">{card.detail}</p>
                <div className="mt-auto pt-2.5 text-sm font-bold text-[var(--color-primary)] transition-transform group-hover:translate-x-1">
                  {card.cta}
                </div>
              </motion.button>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
