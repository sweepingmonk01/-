import type React from 'react';
import { motion } from 'motion/react';
import {
  BrainCircuit,
  Check,
  Clock,
  Cpu,
  Map as MapIcon,
  Play,
  ShieldAlert,
  Sliders,
  Star,
  Target,
  Trophy,
  Zap,
  BookOpen,
} from 'lucide-react';

type Textbooks = {
  zh: string;
  ma: string;
  en: string;
};

const WELCOME_OUTCOMES = [
  { label: '今日主线', value: '3 步拿回最值分', accent: 'text-[var(--color-primary)]' },
  { label: '长期模型', value: '持续记住痛点与规则', accent: 'text-[var(--color-secondary)]' },
  { label: '训练方式', value: '先诊断，再脱水，再剧场修复', accent: 'text-[var(--color-accent-green)]' },
];

const WELCOME_SIGNALS = [
  { icon: ShieldAlert, title: '长期学生状态', detail: '把最近裁决、风险型和高频痛点持续沉淀，不再每次从零开始。', tone: 'bg-[rgba(255,138,61,0.14)] text-[var(--color-secondary)]' },
  { icon: Target, title: '今日最短提分路径', detail: '首页任务直接跟着 state-summary 和错题主线走，先干最值的那一题。', tone: 'bg-[rgba(61,123,255,0.14)] text-[var(--color-primary)]' },
  { icon: BookOpen, title: '练习不是堆量', detail: '错题、知识图谱、剧场分支会互相回流，让每次交互都留下可用证据。', tone: 'bg-[rgba(51,209,160,0.14)] text-[var(--color-accent-green)]' },
];

const SparkleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    <path d="M5 3v4M3 5h4M19 3v4M17 5h4M5 17v4M3 19h4M19 17v4M17 19h4"/>
  </svg>
);

export function WelcomeScreen({
  authChecking,
  welcomeError,
  onEnterCamp,
  onShowOverview,
  onEnterDemo,
}: {
  authChecking: boolean;
  welcomeError: string | null;
  onEnterCamp: () => void;
  onShowOverview: () => void;
  onEnterDemo: () => void;
}) {
  return (
    <motion.div
      key="welcome"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="absolute inset-0 h-full w-full overflow-y-auto welcome-aurora"
    >
      <div className="pointer-events-none absolute left-6 top-10 text-[var(--color-primary)]/20 sm:left-12">
        <Zap size={84} />
      </div>
      <div className="pointer-events-none absolute bottom-24 right-6 text-[var(--color-secondary)]/20 sm:right-12">
        <SparkleIcon width={104} height={104} />
      </div>
      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-6xl flex-col justify-center px-4 py-6 sm:px-8 sm:py-8">
        <div className="desktop-shell-shadow overflow-hidden rounded-[36px] border border-white/80 bg-white/86 backdrop-blur-xl sm:rounded-[44px]">
          <div className="grid min-h-[calc(100vh-3rem)] grid-cols-1 lg:grid-cols-[minmax(0,1.06fr)_minmax(360px,0.94fr)]">
            <div className="relative flex flex-col justify-between px-6 pb-8 pt-8 sm:px-10 sm:pb-10 sm:pt-10 lg:px-12 lg:py-12">
              <div className="relative">
                <div className="wind-pill">
                  <BrainCircuit size={16} />
                  御风冒险已接入长期学习状态
                </div>
                <div className="mt-6 flex items-center gap-4">
                  <motion.div
                    animate={{ rotate: [0, -5, 4, 0], y: [0, -4, 0] }}
                    transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                    className="wind-sparkle-ring flex h-20 w-20 items-center justify-center rounded-[28px] border-4 border-[#1a1a2e] bg-white shadow-[0_18px_28px_rgba(61,123,255,0.16)] sm:h-24 sm:w-24"
                  >
                    <img src="https://api.dicebear.com/7.x/bottts/svg?seed=liezi-yufeng" alt="列子御风 AI 伙伴" className="h-14 w-14 sm:h-16 sm:w-16" />
                  </motion.div>
                  <div className="text-left">
                    <p className="text-sm font-black uppercase tracking-[0.24em] text-gray-400">Liezi Yufeng</p>
                    <p className="text-base font-bold text-[#1a1a2e] sm:text-lg">把刷题改造成有奖励的闯关旅程</p>
                  </div>
                </div>
                <h1 className="mt-8 max-w-2xl text-left text-4xl font-display font-bold leading-[1.03] text-[#1a1a2e] sm:text-5xl lg:text-6xl">
                  让今天的提分主线
                  <br />
                  <span className="text-[var(--color-primary)]">像玩冒险游戏一样推进。</span>
                </h1>
                <p className="mt-5 max-w-2xl text-left text-base font-medium leading-7 text-gray-600 sm:text-lg">
                  列子御风会先判断你最近最容易失手的规则和痛点，再把首页任务、知识地图、错题修复和剧场演练都串成同一条主线。
                </p>
                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  {WELCOME_OUTCOMES.map((item, index) => (
                    <div key={item.label} className="wind-quest-card px-4 py-4 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">{item.label}</p>
                        <span className="wind-mini-badge bg-[var(--color-accent-yellow)]/30 text-[#7a4b00]">Lv.{index + 1}</span>
                      </div>
                      <p className={`mt-3 text-base font-black leading-6 ${item.accent}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative mt-10 flex w-full flex-col gap-4 sm:max-w-xl">
                <button
                  onClick={onEnterCamp}
                  disabled={authChecking}
                  className="game-btn flex w-full items-center justify-center gap-2 bg-[linear-gradient(180deg,#4d8dff_0%,#2b5bde_100%)] py-4 text-lg text-white sm:text-xl"
                >
                  <Play fill="currentColor" size={24} /> {authChecking ? '连接风场中...' : '进入御风营地'}
                </button>
                {welcomeError ? (
                  <div className="rounded-2xl border border-[var(--color-secondary)]/20 bg-[rgba(255,138,61,0.12)] px-4 py-3 text-sm font-bold leading-6 text-[#7a3d00]">
                    {welcomeError}
                  </div>
                ) : null}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button onClick={onShowOverview} className="game-btn flex items-center justify-center gap-2 border border-white/40 bg-white/92 px-5 py-3 font-bold text-gray-700">
                    <Clock size={18} /> 先看看战利品
                  </button>
                  <button onClick={onEnterDemo} className="game-btn flex items-center justify-center gap-2 bg-[linear-gradient(180deg,#ffd86c_0%,#ffb52f_100%)] px-5 py-3 font-bold text-[#6a4200]">
                    <Zap size={18} /> 试玩 3 分钟 Demo
                  </button>
                </div>
              </div>
            </div>
            <div className="relative border-t border-[#1a1a2e]/8 bg-[linear-gradient(180deg,#21315f_0%,#293b7d_52%,#3d2e72_100%)] px-5 py-6 text-white sm:px-8 sm:py-8 lg:border-l lg:border-t-0">
              <div className="relative flex h-full flex-col">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200/70">World Preview</p>
                    <h2 className="mt-2 text-2xl font-black text-white">今天的冒险地图会怎么生成</h2>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-cyan-100">主线已锁定</div>
                </div>
                <div className="space-y-3">
                  {WELCOME_SIGNALS.map(({ icon: Icon, title, detail, tone }) => (
                    <div key={title} className="rounded-[26px] border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}>
                          <Icon size={20} />
                        </div>
                        <div>
                          <p className="text-base font-black text-white">{title}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-300">{detail}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-[30px] border border-white/12 bg-black/18 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200/70">今日首个关卡</p>
                  <h3 className="mt-2 text-xl font-black">数学 · 几何辅助线</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">最近失手</p>
                      <p className="mt-2 text-base font-bold text-white">几何中点辅助线选择失误</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">推荐路线</p>
                      <p className="mt-2 text-base font-bold text-white">先错题修复，再进剧场验证</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function ProfileSetupScreen({
  grade,
  textbooks,
  onGradeChange,
  onTextbooksChange,
  onContinue,
}: {
  grade: string;
  textbooks: Textbooks;
  onGradeChange: (grade: string) => void;
  onTextbooksChange: (textbooks: Textbooks) => void;
  onContinue: () => void;
}) {
  const subjects = [
    { id: 'zh', name: '丹青语文', color: 'var(--color-subj-zh)', opts: ['部编版(人教)', '苏教版', '语文版'] },
    { id: 'ma', name: '极光数学', color: 'var(--color-subj-ma)', opts: ['人教版', '北师大版', '苏教版'] },
    { id: 'en', name: '阳光英语', color: 'var(--color-subj-en)', opts: ['人教PEP', '外研社', '牛津版'] },
  ] as const;

  return (
    <motion.div key="profile-setup" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="wind-page absolute inset-0 z-10 flex h-full w-full min-h-0 flex-col p-5 sm:p-6">
      <div className="wind-panel mt-2 flex flex-1 min-h-0 flex-col px-5 pb-5 pt-6 sm:px-6 sm:pt-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="wind-pill"><MapIcon size={16} /> 第 1 步 / 建立冒险档案</div>
            <h2 className="mt-4 text-3xl font-display font-bold text-[#1a1a2e]">先告诉我，你现在在哪一张地图</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-gray-500">我会根据年级与教材版本，给你匹配对应的闯关路线、知识节点和剧场脚本。</p>
          </div>
          <div className="hidden rounded-[24px] bg-[linear-gradient(180deg,rgba(61,123,255,0.14),rgba(255,213,74,0.16))] p-3 text-[var(--color-primary)] sm:block">
            <SparkleIcon className="h-8 w-8" />
          </div>
        </div>
        <div className="mt-6 flex-1 min-h-0 space-y-6 overflow-y-auto pb-4 touch-pan-y">
          <div className="game-card p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-lg font-black text-[#1a1a2e]">选择当前年级</h3>
              <span className="wind-mini-badge bg-[var(--color-primary)]/12 text-[var(--color-primary)]">角色等级</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级'].map((item) => (
                <button key={item} onClick={() => onGradeChange(item)} className={`rounded-2xl border px-3 py-3 text-sm font-black transition-all ${grade === item ? 'border-[var(--color-primary)] bg-[linear-gradient(180deg,rgba(61,123,255,0.16),rgba(61,123,255,0.08))] text-[var(--color-primary)]' : 'border-[#dce6ff] bg-white text-gray-500 hover:border-[#bdd2ff]'}`}>
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="game-card p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-lg font-black text-[#1a1a2e]">选择三科教材</h3>
              <span className="wind-mini-badge bg-[var(--color-secondary)]/12 text-[var(--color-secondary)]">世界规则</span>
            </div>
            <div className="space-y-3">
              {subjects.map((subject) => (
                <div key={subject.id} className="wind-quest-card flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: subject.color }} />
                    <div>
                      <p className="font-black text-[#1a1a2e]">{subject.name}</p>
                      <p className="text-xs font-bold text-gray-400">决定对应题库与地图节点</p>
                    </div>
                  </div>
                  <select className="wind-select max-w-[150px] text-sm" value={textbooks[subject.id]} onChange={(event) => onTextbooksChange({ ...textbooks, [subject.id]: event.target.value })}>
                    {subject.opts.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
        <button disabled={!grade} onClick={onContinue} className="game-btn mt-4 flex w-full items-center justify-center gap-2 bg-[linear-gradient(180deg,#4d8dff_0%,#2b5bde_100%)] py-4 text-xl text-white">
          <MapIcon size={24} /> 启动第一次巡航诊断
        </button>
      </div>
    </motion.div>
  );
}

export function DiagnosticLoadingScreen() {
  return (
    <motion.div key="diag" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#2a4cc6_0%,#355ce2_42%,#5d79ea_100%)] px-6 text-white">
      <div className="relative z-10 mb-4 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-100">风场校准中</div>
      <motion.div animate={{ rotate: 360, scale: [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="relative z-10">
        <BrainCircuit size={64} />
      </motion.div>
      <h2 className="relative z-10 mt-6 text-center text-3xl font-display font-bold tracking-wider">正在为你拼接今天的主线地图</h2>
      <div className="relative z-10 mt-8 w-72 space-y-3 rounded-[28px] border border-white/12 bg-white/10 p-5 backdrop-blur-sm">
        {['扫描你当前学段的核心关卡...', '比对近 3 年高频考点的掉分点...', '生成最短提分与修复路线...'].map((text, index) => (
          <motion.div key={text} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.8 }} className="flex items-center gap-2 text-sm font-bold opacity-90">
            <Check size={16} /> {text}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export function TargetSetterScreen({
  targetScore,
  onTargetScoreChange,
  onSubmit,
}: {
  targetScore: number;
  onTargetScoreChange: (score: number) => void;
  onSubmit: () => void;
}) {
  const ptsNeeded = targetScore - 85;
  const timeNeeded = Math.max(0, Math.ceil(ptsNeeded * 1.5));
  const tasksNeeded = Math.max(0, Math.ceil(ptsNeeded / 4));

  return (
    <motion.div key="target-setter" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, y: 20 }} className="wind-page absolute inset-0 z-10 flex h-full w-full min-h-0 flex-col p-5 sm:p-6">
      <div className="wind-panel mt-2 flex flex-1 min-h-0 flex-col px-5 pb-5 pt-6 sm:px-6 sm:pt-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="wind-pill"><Sliders size={16} /> 第 2 步 / 设定今天终点</div>
            <h2 className="mt-4 text-3xl font-display font-bold text-[#1a1a2e]">告诉我你今天想打到哪一关</h2>
            <p className="mt-2 text-sm font-bold text-gray-500">AI 会把目标分拆成可以一步步完成的小任务。</p>
          </div>
          <div className="hidden rounded-[24px] bg-[linear-gradient(180deg,rgba(255,138,61,0.16),rgba(255,213,74,0.2))] p-3 text-[var(--color-secondary)] sm:block">
            <Trophy size={28} />
          </div>
        </div>
        <div className="mt-6 wind-quest-card px-5 py-5">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-gray-400">今日目标分</p>
              <p className="mt-2 text-sm font-bold text-gray-500">向右拖动，决定今天的挑战终点。</p>
            </div>
            <span className="text-5xl font-display font-bold tracking-tight text-[var(--color-primary)]">{targetScore}<span className="ml-1 text-lg text-gray-400">/150</span></span>
          </div>
          <input type="range" min={85} max={145} value={targetScore} onChange={(event) => onTargetScoreChange(Number(event.target.value))} className="wind-slider h-4 w-full cursor-pointer appearance-none rounded-full bg-[#dbe8ff] outline-none" style={{ backgroundImage: `linear-gradient(to right, var(--color-primary) ${((targetScore - 85) / 60) * 100}%, #dbe8ff 0)` }} />
          <div className="mt-3 flex justify-between text-xs font-black text-gray-400">
            <span>85 当前基线</span>
            <span>145 冲刺上限</span>
          </div>
        </div>
        <div className="mt-5 mb-auto grid grid-cols-2 gap-3">
          <MetricCard icon={<SparkleIcon className="h-5 w-5" />} label="路径重组" value={`+${ptsNeeded}`} detail="聚焦高价值节点。" dark />
          <MetricCard icon={<Star size={18} />} label="关卡数量" value={`${tasksNeeded} 个`} detail="今晚要打透的考点数。" />
          <MetricCard icon={<Clock size={18} />} label="预计耗时" value={`${timeNeeded} 分钟`} detail="把时间留给涨分主线。" />
          <MetricCard icon={<Cpu size={18} />} label="路线命中率" value="96.8%" detail="优先安排稳、短、正反馈任务。" />
        </div>
        <button onClick={onSubmit} className="game-btn mt-6 flex w-full items-center justify-center gap-2 bg-[linear-gradient(180deg,#4d8dff_0%,#2b5bde_100%)] py-4 text-xl text-white">
          <MapIcon fill="currentColor" size={24} /> 生成今日主线地图
        </button>
      </div>
    </motion.div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  dark = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  dark?: boolean;
}) {
  return (
    <div className={`game-card p-4 ${dark ? 'border-0 bg-[linear-gradient(180deg,#22305b_0%,#283b75_100%)] text-white' : 'bg-[linear-gradient(180deg,#fffefe_0%,#f8fbff_100%)]'}`}>
      <div className={`mb-2 flex items-center gap-2 ${dark ? 'text-cyan-100' : 'text-[var(--color-secondary)]'}`}>
        {icon}
        <p className="text-sm font-black">{label}</p>
      </div>
      <p className={`text-3xl font-black ${dark ? 'text-white' : 'text-[var(--color-secondary)]'}`}>{value}</p>
      <p className={`mt-2 text-xs font-bold ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{detail}</p>
    </div>
  );
}
