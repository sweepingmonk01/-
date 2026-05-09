import React from 'react';
import { motion } from 'motion/react';
import { Brain, Clock, Target, Shield } from 'lucide-react';

const PILLARS = [
  {
    icon: Brain,
    title: '认知优先，不是内容优先',
    description:
      '传统教育先选内容再看学生。AIU 先感知学生的认知状态——时间压力、信噪比、情绪——再决定教什么、用什么方式教。',
    color: 'var(--aiu-sky-deep)',
    bg: 'rgba(74, 158, 255, 0.08)',
  },
  {
    icon: Clock,
    title: '御风而行：时间是最稀缺的资源',
    description:
      '我们不追求"做更多题"，而是追求"用最少的时间修复最关键的漏洞"。AI Active 引擎会自动脱水作业、跳过已掌握的部分。',
    color: 'var(--aiu-emerald)',
    bg: 'rgba(52, 199, 138, 0.08)',
  },
  {
    icon: Target,
    title: '精准干预，一次只解决一个痛点',
    description:
      '每次学习交互都只聚焦一个知识漏洞。不做大锅饭式的"综合复习"——就像医生每次看诊只解决主诉。',
    color: 'var(--aiu-gold)',
    bg: 'rgba(245, 166, 35, 0.08)',
  },
  {
    icon: Shield,
    title: '公益架构：知识不应有门槛',
    description:
      'AIU 参照可汗学院模式公益运营。核心引擎开源，任何人可以免费使用。我们相信教育公平不是口号，而是技术架构的选择。',
    color: 'var(--aiu-lavender)',
    bg: 'rgba(163, 113, 255, 0.08)',
  },
];

const Philosophy: React.FC = () => (
  <section id="philosophy" className="relative overflow-hidden bg-[var(--aiu-cloud)] py-24 sm:py-32">
    <div className="pointer-events-none absolute right-0 top-0 h-[400px] w-[400px] bg-[radial-gradient(circle,rgba(74,158,255,0.06),transparent_70%)]" />

    <div className="mx-auto max-w-6xl px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <span className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--aiu-sky-deep)]">
          Education Philosophy
        </span>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-[var(--aiu-ocean-deep)] sm:text-4xl">
          我们相信的四件事
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-[var(--aiu-ink-soft)]">
          AIU 不是"AI + 题库"。它是一套完整的认知科学方法论，
          用技术把"因材施教"从理想变成每一次交互的现实。
        </p>
      </motion.div>

      <div className="mt-16 grid gap-6 sm:grid-cols-2">
        {PILLARS.map((pillar, index) => {
          const Icon = pillar.icon;
          return (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group relative overflow-hidden rounded-2xl border border-[var(--aiu-line)] bg-white p-7 shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
            >
              <div
                className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: pillar.bg, color: pillar.color }}
              >
                <Icon size={22} />
              </div>
              <h3 className="text-lg font-extrabold text-[var(--aiu-ocean)]">{pillar.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--aiu-ink-soft)]">
                {pillar.description}
              </p>
              {/* Decorative corner */}
              <div
                className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-30 blur-2xl transition-opacity group-hover:opacity-50"
                style={{ background: pillar.color }}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  </section>
);

export default Philosophy;
