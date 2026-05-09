import React from 'react';
import { motion } from 'motion/react';
import { GraduationCap, Users, BookOpen } from 'lucide-react';

const PERSONAS = [
  {
    icon: GraduationCap,
    who: '中小学生',
    pain: '"每天作业做到 11 点，成绩却不见起色"',
    gain: 'AI 自动脱水作业、跳过已会的部分，把省下的时间用在真正卡住的知识点上。',
    color: 'var(--aiu-sky-deep)',
    bg: 'linear-gradient(135deg, rgba(74,158,255,0.06), rgba(99,102,241,0.06))',
  },
  {
    icon: Users,
    who: '家长和教师',
    pain: '"不知道孩子到底卡在哪，只能靠刷题碰运气"',
    gain: '认知仪表盘实时可见：哪个知识点是真漏洞、情绪状态如何、这周节奏是否健康。',
    color: 'var(--aiu-emerald)',
    bg: 'linear-gradient(135deg, rgba(52,199,138,0.06), rgba(16,185,129,0.06))',
  },
  {
    icon: BookOpen,
    who: '教育研究者和开发者',
    pain: '"想做个性化教学，但没有开放的认知建模框架"',
    gain: '完整的 AI Active 认知引擎开源，从状态向量到策略调度到效果闭环，可以直接用于研究或二次开发。',
    color: 'var(--aiu-lavender)',
    bg: 'linear-gradient(135deg, rgba(163,113,255,0.06), rgba(139,92,246,0.06))',
  },
];

const ForWhom: React.FC = () => (
  <section id="for-whom" className="relative overflow-hidden bg-[var(--aiu-cloud)] py-24 sm:py-32">
    <div className="mx-auto max-w-6xl px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <span className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--aiu-gold)]">
          For Whom
        </span>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-[var(--aiu-ocean-deep)] sm:text-4xl">
          AIU 适合谁？
        </h2>
      </motion.div>

      <div className="mt-14 grid gap-6 sm:grid-cols-3">
        {PERSONAS.map((p, index) => {
          const Icon = p.icon;
          return (
            <motion.div
              key={p.who}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: index * 0.12 }}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--aiu-line)] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,0.07)]"
            >
              {/* Gradient header */}
              <div className="px-6 pb-4 pt-6" style={{ background: p.bg }}>
                <div
                  className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                  style={{ color: p.color }}
                >
                  <Icon size={20} />
                </div>
                <h3 className="text-lg font-extrabold text-[var(--aiu-ocean)]">{p.who}</h3>
              </div>

              <div className="flex flex-1 flex-col px-6 pb-6 pt-4">
                <p className="text-sm font-semibold italic text-[var(--aiu-ink-soft)]">
                  {p.pain}
                </p>
                <div className="my-3 h-px bg-[var(--aiu-line)]" />
                <p className="text-sm leading-relaxed text-[var(--aiu-ink-soft)]">
                  {p.gain}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  </section>
);

export default ForWhom;
