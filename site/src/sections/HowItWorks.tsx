import React from 'react';
import { motion } from 'motion/react';
import { Camera, Cpu, Zap, TrendingUp, RotateCcw } from 'lucide-react';

const STEPS = [
  {
    num: '01',
    icon: Camera,
    title: '拍错上传',
    subtitle: '一键抓取痛点',
    description: '学生拍下最卡住的一道题，AI 立即识别错因、知识漏洞和认知模式。不用翻书、不用归类——一张照片就够了。',
    color: 'var(--aiu-sky-deep)',
  },
  {
    num: '02',
    icon: Cpu,
    title: 'AI Active 认知感知',
    subtitle: '三轴实时监测',
    description: '认知引擎同步评估三个维度——时间压力、信噪比、情绪状态。这不是做完题才看分数，而是做题过程中就在感知。',
    color: 'var(--aiu-emerald)',
  },
  {
    num: '03',
    icon: Zap,
    title: '精准干预',
    subtitle: '只修最关键的漏洞',
    description: 'Mobius 调度器根据认知状态选择最优策略：先讲规则？先降压？先练类似题？每一步都有数据驱动的理由。',
    color: 'var(--aiu-gold)',
  },
  {
    num: '04',
    icon: TrendingUp,
    title: '效果闭环',
    subtitle: 'effectScore 量化每次干预',
    description: '每次交互结束后，系统量化干预效果——不只看对错，还看认知状态的变化。无效的策略会被自动淘汰。',
    color: 'var(--aiu-lavender)',
  },
  {
    num: '05',
    icon: RotateCcw,
    title: '知识图谱进化',
    subtitle: '从错题长出知识网络',
    description: '所有错题自动编织成知识图谱。高频节点、关联漏洞、修复路径——一目了然。学得越多，地图越完整。',
    color: 'var(--aiu-coral)',
  },
];

const HowItWorks: React.FC = () => (
  <section id="how" className="relative py-24 sm:py-32">
    <div className="mx-auto max-w-6xl px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <span className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--aiu-emerald)]">
          How It Works
        </span>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-[var(--aiu-ocean-deep)] sm:text-4xl">
          五步闭环，从错题到掌握
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-[var(--aiu-ink-soft)]">
          不是"AI 出题 → 学生做题"的线性流水线，而是一个感知→干预→验证的认知闭环。
        </p>
      </motion.div>

      <div className="relative mt-16">
        {/* Vertical timeline line */}
        <div className="absolute left-[27px] top-0 hidden h-full w-px bg-gradient-to-b from-[var(--aiu-sky-deep)] via-[var(--aiu-emerald)] to-[var(--aiu-coral)] opacity-20 sm:block" />

        <div className="flex flex-col gap-8">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                className="group flex gap-5 sm:gap-7"
              >
                {/* Timeline dot */}
                <div className="relative shrink-0">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-shadow group-hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
                    style={{ background: step.color, color: '#fff' }}
                  >
                    <Icon size={24} />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 rounded-2xl border border-[var(--aiu-line)] bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.02)] transition-shadow group-hover:shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
                  <div className="flex items-center gap-3">
                    <span
                      className="text-xs font-black uppercase tracking-[0.15em]"
                      style={{ color: step.color }}
                    >
                      Step {step.num}
                    </span>
                    <span className="text-xs font-semibold text-[var(--aiu-ink-soft)]">
                      {step.subtitle}
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-lg font-extrabold text-[var(--aiu-ocean)]">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--aiu-ink-soft)]">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  </section>
);

export default HowItWorks;
