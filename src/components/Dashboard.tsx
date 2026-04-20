import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import { Zap, Target, Flame, Brain, ShieldAlert, Crosshair } from 'lucide-react';

interface DashboardProps {
  studentId: string;
  onNavigate: (screen: string) => void;
  onTriggerUpload: () => void;
  onTriggerDehydrate: () => void;
}

export default function Dashboard({ studentId, onNavigate, onTriggerUpload, onTriggerDehydrate }: DashboardProps) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch(`/api/mobius/students/${encodeURIComponent(studentId)}/dashboard-stats`);
        if (res.ok) {
          const data = await res.json();
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
      <div className="absolute inset-0 bg-black flex items-center justify-center font-mono text-cyan-400">
        <div className="animate-pulse">认知数据同步中 LOADING COGNITIVE DATA...</div>
      </div>
    );
  }

  const radarData = stats ? [
    { subject: '专注力 Focus', A: stats.cognitiveState?.focus || 50, fullMark: 100 },
    { subject: '挫败感 Frustration', A: stats.cognitiveState?.frustration || 0, fullMark: 100 },
    { subject: '愉悦感 Joy', A: stats.cognitiveState?.joy || 50, fullMark: 100 },
  ] : [];

  const bentoCard = "bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md relative overflow-hidden flex flex-col";

  return (
    <div className="absolute inset-0 bg-[#0a0a0f] text-gray-200 p-4 sm:p-6 pb-24 font-sans overflow-y-auto w-full flex flex-col items-center">
      <div className="w-full max-w-7xl flex flex-col gap-6">
        
        {/* Header - Tactical HUD */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-4 border-b border-white/10 pb-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-white font-display mb-1">认知指挥室 (战术沙盘)</h1>
            <p className="text-sm font-mono text-gray-400">MöBIUS Engine v2.0 - 核心战术总览</p>
          </div>
          <button onClick={() => onNavigate('overview')} className="mt-4 sm:mt-0 px-6 py-2 bg-transparent border-2 border-white/20 hover:border-white/50 text-white font-bold rounded-lg font-mono transition-colors">
             家长驾驶舱
          </button>
        </div>

        {/* Action Grid (Bento) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-auto md:h-[650px]">
          
          {/* Card 1: Time Liberated (Philosophy focus) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={`md:col-span-8 ${bentoCard} bg-gradient-to-br from-indigo-900/40 to-black/20`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Zap className="text-cyan-400" size={20} />
              <h2 className="text-sm font-bold uppercase tracking-widest text-cyan-400">累计解放时间</h2>
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <div className="flex items-baseline gap-2">
                <span className="text-8xl sm:text-9xl font-black text-white font-display tracking-tighter">
                  {stats?.timeSavedHours || 0}
                </span>
                <span className="text-2xl text-cyan-500 font-mono">小时</span>
              </div>
              <p className="mt-4 text-xl text-gray-300 font-medium tracking-wide">
                做分数的<span className="text-white">主人</span>，<br/> 而不是分数的奴隶。
              </p>
              <p className="mt-2 text-sm text-gray-500 font-mono max-w-lg">
                系统已自动规避无价值的机械重复训练，把生命还给你。 
              </p>
            </div>
            
            {/* Background decorative elements */}
            <div className="absolute -right-8 -bottom-8 opacity-20 pointer-events-none">
              <Target size={280} className="text-cyan-600" />
            </div>
          </motion.div>

          {/* Card 2: Cognitive Radar */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className={`md:col-span-4 ${bentoCard}`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Brain className="text-fuchsia-400" size={20} />
                <h2 className="text-sm font-bold uppercase tracking-widest text-fuchsia-400">实时认知状态</h2>
              </div>
              {stats?.cognitiveState?.frustration > 60 && (
                <span className="px-2 py-1 bg-red-500/20 text-red-400 text-[10px] font-mono rounded">
                  警告：认知过载
                </span>
              )}
            </div>
            <div className="flex-1 w-full flex items-center justify-center -ml-4">
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="#ffffff33" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 12, fontFamily: 'monospace' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="State" dataKey="A" stroke="#d946ef" fill="#d946ef" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-gray-400 font-mono text-center mt-2">
              脑机模型情绪实时同步中...
            </p>
          </motion.div>

          {/* Card 3: Target ROI */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className={`md:col-span-4 ${bentoCard} border-white/20`}
          >
            <div className="flex items-center gap-2 mb-6">
              <Crosshair className="text-emerald-400" size={20} />
              <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-400">提分 ROI 测算</h2>
            </div>
            
            <div className="flex-1 flex flex-col justify-around">
              <div>
                <p className="text-xs font-mono text-gray-400 mb-1">当前测算战力</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-white">{stats?.estimatedScore || 0}</span>
                  <span className="text-sm text-gray-500">分</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-mono text-gray-400 mb-1">目标战力</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-gray-300">{stats?.targetScore || 115}</span>
                  <span className="text-sm text-gray-500">分</span>
                </div>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mt-4">
               <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                 <div 
                   className="h-full bg-emerald-400 transition-all duration-1000"
                   style={{ width: `${Math.min(100, ((stats?.estimatedScore || 0) / (stats?.targetScore || 115)) * 100)}%` }}
                 />
               </div>
            </div>
          </motion.div>

          {/* Card 4: Tactical Hub (Action items) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className={`md:col-span-8 ${bentoCard}`}
          >
             <div className="flex items-center justify-between mb-6">
               <div className="flex items-center gap-2">
                 <ShieldAlert className="text-orange-400" size={20} />
                 <h2 className="text-sm font-bold uppercase tracking-widest text-orange-400">最高优先打击目标</h2>
               </div>
               <div className="font-mono text-xs text-gray-400">
                  {stats?.activeIssuesCount} 个未解决的底层漏洞
               </div>
             </div>

             <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-2">
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <button onClick={onTriggerUpload} className="bg-fuchsia-600/20 border border-fuchsia-500/30 text-fuchsia-300 rounded-xl p-3 text-sm font-mono hover:bg-fuchsia-600/30 transition-colors flex flex-col items-center justify-center gap-1 shadow-inner">
                    <span className="font-bold text-lg text-white">SCAN 拍题破局</span>
                    扫描真实难题 & 秒级拆解规则
                  </button>
                  <button onClick={onTriggerDehydrate} className="bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 rounded-xl p-3 text-sm font-mono hover:bg-cyan-600/30 transition-colors flex flex-col items-center justify-center gap-1 shadow-inner">
                    <span className="font-bold text-lg text-white">DEHYDRATE 作业脱水</span>
                    整页试卷扫描 & 免做凭证
                  </button>
                </div>

                {(!stats?.topPainPoints || stats.topPainPoints.length === 0) ? (
                   <div className="flex-1 flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-gray-800 rounded-2xl">
                     <Flame size={32} className="mb-2 opacity-50" />
                     <p>防线稳固，未发现致命漏洞。</p>
                     <p className="text-sm">你可以去探索新的知识边界了。</p>
                   </div>
                ) : (
                  stats.topPainPoints.map((pt: string, idx: number) => (
                    <div key={idx} className="bg-white/5 border border-white/10 hover:border-orange-500/50 hover:bg-orange-500/10 transition-colors p-4 rounded-xl flex items-center justify-between group">
                      <div className="flex-1">
                        <span className="text-[10px] font-mono text-orange-400 mb-1 block">高优目标 PRIORITY TARGET</span>
                        <p className="text-base text-gray-200 font-semibold">{pt}</p>
                      </div>
                      <button 
                        onClick={() => onNavigate('overview')}
                        className="opacity-0 group-hover:opacity-100 transition-opacity bg-orange-500 text-black px-4 py-2 font-mono text-xs rounded-lg font-bold"
                      >
                        排期歼灭
                      </button>
                    </div>
                  ))
                )}
             </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
