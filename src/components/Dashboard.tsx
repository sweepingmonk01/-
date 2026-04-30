import React from 'react';
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
import type { DashboardViewState } from '../../shared/dashboard-metrics';
import WindPage from './layout/WindPage';
import CloudGlassPanel from './ui/CloudGlassPanel';
import GameButton from './ui/GameButton';
import MissionBadge from './ui/MissionBadge';

interface DashboardProps {
  data: DashboardViewState;
  loading?: boolean;
  onNavigate: (screen: string) => void;
  onReturnHome: () => void;
  onTriggerUpload: () => void;
  onTriggerDehydrate: () => void;
}

const shellCard = 'rounded-[22px]';

export default function Dashboard({
  data,
  loading = false,
  onNavigate,
  onReturnHome,
  onTriggerUpload,
  onTriggerDehydrate,
}: DashboardProps) {
  if (loading) {
    return (
      <WindPage className="absolute inset-0 flex items-center justify-center px-6">
        <CloudGlassPanel className="rounded-[24px] px-8 py-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            <Brain size={24} />
          </div>
          <p className="text-lg font-black text-[#1a1a2e]">认知数据同步中</p>
          <p className="mt-2 text-sm font-medium text-gray-500">正在生成今日主线、关卡顺序和奖励反馈...</p>
        </CloudGlassPanel>
      </WindPage>
    );
  }

  const radarData = data.cognitiveProjection.radar.map((item) => ({
    subject: item.subject,
    A: item.value,
    fullMark: item.fullMark,
  }));

  const estimatedScore = data.estimatedScore || 0;
  const targetScore = data.targetScore || 115;
  const progressPercent = targetScore > 0 ? Math.min(100, (estimatedScore / targetScore) * 100) : 0;
  const painPoints = data.topPainPoints.slice(0, 2);
  const isStable = data.cognitiveProjection.bottleneck === 'stable';
  const needsProtection = data.cognitiveProjection.bottleneck === 'emotion';
  const isTimeTight = data.cognitiveProjection.bottleneck === 'time';
  const leadPainPoint = painPoints[0] || '主线比较稳，先把节奏守住。';
  const backupPainPoint = painPoints[1] || '先看战况，再决定是否开新题型。';
  const priorityTargets = painPoints.length ? painPoints : ['主线稳定，今天可小步推进。'];
  const riskStatusLabel = needsProtection ? '先降压' : isTimeTight ? '先控时' : isStable ? '可推进' : '先收噪';
  const coreModuleTag = isStable
    ? (data.activeIssuesCount ? '优先修漏洞' : '主线清晰')
    : data.cognitiveProjection.bottleneckLabel;
  const secondLayerCards = [
    {
      id: 'error-book',
      title: data.activeIssuesCount ? '错题回收' : '错题缓冲',
      detail: data.activeIssuesCount ? `待修 ${data.activeIssuesCount} 项` : '当前无高危',
      tone:
        'border-[#1a1a2e]/10 bg-white text-[#1a1a2e] shadow-[0_12px_26px_rgba(26,26,46,0.07)]',
      cta: '进入错题',
      action: () => onNavigate('error-book'),
    },
    {
      id: 'subject-map',
      title: '学科落点',
      detail: '查看今日压分科目',
      tone:
        'border-[var(--color-primary)]/20 bg-[linear-gradient(160deg,rgba(61,123,255,0.16),rgba(108,168,255,0.1))] text-[#1a1a2e] shadow-[0_14px_28px_rgba(61,123,255,0.12)]',
      cta: '去学科岛',
      action: () => onNavigate('subject-map'),
    },
    {
      id: 'dehydrate',
      title: '减压口',
      detail: `目标 ${targetScore} 分`,
      tone:
        'border-[var(--color-secondary)]/18 bg-[linear-gradient(155deg,rgba(255,138,61,0.16),rgba(255,190,11,0.1))] text-[#1a1a2e] shadow-[0_14px_28px_rgba(255,138,61,0.12)]',
      cta: '开始脱水',
      action: onTriggerDehydrate,
    },
  ];

  return (
    <WindPage className="absolute inset-0 flex h-full w-full flex-col overflow-hidden">
      <div className="relative flex-1 min-h-0 overflow-hidden px-3 pb-[5.6rem] pt-3">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-[radial-gradient(circle_at_14%_16%,rgba(61,123,255,0.24),transparent_34%),radial-gradient(circle_at_88%_20%,rgba(255,138,61,0.18),transparent_30%),radial-gradient(circle_at_56%_72%,rgba(255,95,162,0.1),transparent_30%)]" />

        <div className="relative mx-auto flex h-full w-full max-w-lg min-h-0 flex-col gap-2">
          <CloudGlassPanel className={`${shellCard} relative overflow-hidden px-3 py-2`}>
            <div className="absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(61,123,255,0.35),transparent)]" />
            <div className="flex items-center justify-between gap-2">
              <GameButton
                onClick={onReturnHome}
                variant="parchment"
                className="min-h-0 gap-1.5 px-2.5 py-1.5 text-[11px] text-gray-600"
              >
                <ChevronLeft size={13} />
                返回首页
              </GameButton>
              <GameButton
                onClick={() => onNavigate('overview')}
                variant="parchment"
                className="min-h-0 gap-1.5 px-2.5 py-1.5 text-[11px] text-gray-600"
              >
                旅者档案
                <ArrowRight size={13} />
              </GameButton>
            </div>
          </CloudGlassPanel>

          <div className="grid min-h-0 flex-1 grid-cols-6 grid-rows-2 gap-2">
            <motion.section
              initial={{ opacity: 0, y: 16, rotate: -2.4 }}
              animate={{ opacity: 1, y: 0, rotate: -0.8 }}
              transition={{ duration: 0.34 }}
              className="parchment-panel vl-surface relative col-span-4 row-span-2 flex min-h-0 flex-col overflow-hidden rounded-[22px] px-3 py-2.5"
            >
              <div className="absolute -right-8 top-2 h-20 w-20 rounded-full bg-[rgba(61,123,255,0.14)] blur-2xl" />
              <MissionBadge tone="main" icon={<Sparkles size={10} />} className="w-fit text-[9px] uppercase tracking-[0.14em]">
                今日航线
              </MissionBadge>

              <h1 className="mt-1.5 text-[22px] font-display font-bold leading-[0.98] text-[#1a1a2e]">
                主线任务卷轴
              </h1>

              <div className="mt-1.5 rounded-2xl border border-[#7aa7ff]/18 bg-white/90 px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-400">Main Quest</p>
                  <MissionBadge tone="success" className="px-2 py-0.5 text-[9px]">航线稳定</MissionBadge>
                </div>
                <p className="mt-1 text-[12px] font-black leading-5 text-[#1a1a2e]">{leadPainPoint}</p>
                <div className="mt-1.5 flex items-start gap-1.5 rounded-xl bg-[linear-gradient(180deg,#f3f7ff_0%,#fff3f8_100%)] px-2 py-1.5">
                  <Target size={13} className="mt-0.5 shrink-0 text-[var(--color-secondary)]" />
                  <p className="text-[10px] font-bold leading-4 text-gray-600">{backupPainPoint}</p>
                </div>
              </div>

              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <div className="rounded-xl border border-[#7aa7ff]/16 bg-white px-2.5 py-1.5">
                  <div className="flex items-center gap-1 text-[var(--color-primary)]">
                    <Zap size={12} />
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-gray-400">御风回收</p>
                  </div>
                  <p className="mt-1 text-[24px] font-black leading-none text-[#1a1a2e]">{data.timeSavedHours || 0}</p>
                  <p className="text-[10px] font-bold text-gray-500">小时</p>
                </div>

                <div className="rounded-xl border border-[#33d1a0]/18 bg-white px-2.5 py-1.5">
                  <div className="flex items-center gap-1 text-[var(--color-accent-green)]">
                    <Crosshair size={12} />
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-gray-400">探索进度</p>
                  </div>
                  <p className="mt-1 text-[24px] font-black leading-none text-[#1a1a2e]">{estimatedScore}</p>
                  <p className="text-[10px] font-bold text-gray-500">目标 {targetScore}</p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#dfe7ff]">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-primary),#6ca8ff)] transition-all duration-1000"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 16, rotate: 2.2 }}
              animate={{ opacity: 1, y: 0, rotate: 0.8 }}
              transition={{ duration: 0.36, delay: 0.03 }}
              className="crystal-panel vl-surface col-span-2 row-span-1 flex min-h-0 flex-col overflow-hidden rounded-[22px] px-2.5 py-2 text-white"
            >
              <div className="mb-1 flex items-start justify-between gap-1.5">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-cyan-200/70">御风状态盘</p>
                <div className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${isStable ? 'border border-cyan-200/24 bg-cyan-300/14 text-cyan-100' : 'border border-red-300/24 bg-red-400/18 text-red-100'}`}>
                  {data.cognitiveProjection.bottleneckLabel}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/6 px-1.5 py-1">
                <ResponsiveContainer width="100%" height={86}>
                  <RadarChart cx="50%" cy="50%" outerRadius="66%" data={radarData}>
                    <PolarGrid stroke="#ffffff22" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#dbeafe', fontSize: 9, fontFamily: 'Nunito' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="State" dataKey="A" stroke="#7dd3fc" fill="#7dd3fc" fillOpacity={0.32} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 16, rotate: 2.4 }}
              animate={{ opacity: 1, y: 0, rotate: 0.8 }}
              transition={{ duration: 0.36, delay: 0.06 }}
              className="parchment-panel vl-surface col-span-2 row-span-1 flex min-h-0 flex-col rounded-[22px] px-2.5 py-2"
            >
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1 text-[var(--color-secondary)]">
                  <ShieldAlert size={13} />
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-gray-400">偏航风险</p>
                </div>
                <div className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${needsProtection ? 'bg-red-50 text-red-500' : isStable ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                  {riskStatusLabel}
                </div>
              </div>
              <div className="mt-1 flex items-center justify-between gap-1">
                <p className="text-[24px] font-black leading-none text-[#1a1a2e]">{data.activeIssuesCount || 0}</p>
                <p className="text-[9px] font-bold text-gray-500">个待修漏洞</p>
              </div>
              <div className="mt-1.5 rounded-xl bg-[linear-gradient(180deg,#fff4ea_0%,#f7f9ff_100%)] px-2 py-1.5">
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-gray-400">Core Status</p>
                <p className="mt-0.5 text-[10px] font-bold leading-4 text-[#1a1a2e]">{priorityTargets[0]}</p>
              </div>
            </motion.section>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <motion.button
              initial={{ opacity: 0, x: -14, rotate: -2 }}
              animate={{ opacity: 1, x: 0, rotate: -0.8 }}
              transition={{ duration: 0.33, delay: 0.08 }}
              onClick={onTriggerUpload}
              className="island-card vl-surface group flex min-h-0 flex-col rounded-[20px] px-3 py-2 text-left"
            >
              <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl bg-[linear-gradient(180deg,#4d8dff_0%,#2b5bde_100%)] text-white shadow-[0_8px_16px_rgba(61,123,255,0.28)]">
                <Upload size={16} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--color-primary)]/70">Quest 01</p>
              <h3 className="mt-0.5 text-[16px] font-black leading-tight text-[#1a1a2e]">拍错炼金</h3>
              <p className="mt-0.5 text-[10px] leading-4 text-gray-600">抓今天最卡的一题，拆出可复用规则。</p>
            </motion.button>

            <motion.button
              initial={{ opacity: 0, x: 14, rotate: 2 }}
              animate={{ opacity: 1, x: 0, rotate: 0.8 }}
              transition={{ duration: 0.33, delay: 0.1 }}
              onClick={onTriggerDehydrate}
              className="island-card vl-surface group flex min-h-0 flex-col rounded-[20px] px-3 py-2 text-left"
            >
              <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl bg-[linear-gradient(180deg,#ff9b54_0%,#ff6e2f_100%)] text-white shadow-[0_8px_16px_rgba(255,138,61,0.28)]">
                <Wand2 size={16} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--color-secondary)]/70">Quest 02</p>
              <h3 className="mt-0.5 text-[16px] font-black leading-tight text-[#1a1a2e]">作业脱水</h3>
              <p className="mt-0.5 text-[10px] leading-4 text-gray-600">保留必须做的题，避免题量先压垮节奏。</p>
            </motion.button>
          </div>

          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, delay: 0.12 }}
            className="cloud-glass vl-surface relative rounded-[22px] px-2.5 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-gray-400">航线补给</p>
              <div className="rounded-full bg-[linear-gradient(90deg,#edf4ff_0%,#fff2f7_100%)] px-2.5 py-0.5 text-[9px] font-black text-[var(--color-primary)]">
                {coreModuleTag}
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {secondLayerCards.map((card, index) => (
                <motion.button
                  key={card.id}
                  initial={{ opacity: 0, y: 12, rotate: index % 2 === 0 ? -1 : 1 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  transition={{ duration: 0.28, delay: 0.14 + index * 0.04 }}
                  onClick={card.action}
                  className={`group flex min-h-[72px] flex-col rounded-[16px] border px-2 py-1.5 text-left ${card.tone}`}
                >
                  <h3 className="text-[12px] font-black leading-tight">{card.title}</h3>
                  <p className="mt-0.5 text-[10px] leading-4 text-gray-600">{card.detail}</p>
                  <div className="mt-auto pt-1 text-[10px] font-bold text-[var(--color-primary)]">
                    {card.cta}
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.section>
        </div>
      </div>
    </WindPage>
  );
}
