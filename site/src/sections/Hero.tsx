import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, ArrowDown } from 'lucide-react';

const Hero: React.FC = () => (
  <section className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 pt-16">
    {/* Background layers */}
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--aiu-sky)] via-white to-white" />
      <div className="absolute left-[10%] top-[8%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(74,158,255,0.18),transparent_70%)]" />
      <div className="absolute right-[5%] top-[20%] h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(245,166,35,0.12),transparent_70%)]" />
      <div className="absolute bottom-[10%] left-[40%] h-[280px] w-[280px] rounded-full bg-[radial-gradient(circle,rgba(52,199,138,0.1),transparent_70%)]" />
    </div>

    <div className="relative z-10 mx-auto max-w-4xl text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--aiu-sky-deep)]/20 bg-white/80 px-4 py-1.5 text-sm font-semibold text-[var(--aiu-sky-deep)] shadow-[0_2px_12px_rgba(74,158,255,0.1)] backdrop-blur"
      >
        <Sparkles size={14} />
        公益驱动 / 开源 / 全球可达
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1 }}
        className="text-5xl font-black leading-[1.1] tracking-tight text-[var(--aiu-ocean-deep)] sm:text-6xl lg:text-7xl"
      >
        用更少的时间
        <br />
        <span className="bg-gradient-to-r from-[var(--aiu-sky-deep)] to-[#6366f1] bg-clip-text text-transparent">
          获得更深的理解
        </span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.25 }}
        className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[var(--aiu-ink-soft)] sm:text-xl"
      >
        AIU 是一所公益在线学校。我们不做题海战术——
        <strong className="font-bold text-[var(--aiu-ocean)]">AI Active 认知引擎</strong>
        实时感知每个学生的思维状态，精准干预最卡住的那一个点，
        让学习时间缩短一半、理解深度翻倍。
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
      >
        <a
          href="#waitlist"
          className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--aiu-sky-deep)] to-[#6366f1] px-8 py-3.5 text-base font-bold text-white shadow-[0_8px_30px_rgba(74,158,255,0.3)] transition-all hover:shadow-[0_12px_40px_rgba(74,158,255,0.4)] hover:brightness-110"
        >
          免费加入 AIU
          <ArrowDown size={16} className="transition-transform group-hover:translate-y-0.5" />
        </a>
        <a
          href="#how"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--aiu-line)] bg-white px-7 py-3.5 text-base font-bold text-[var(--aiu-ocean)] shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
        >
          了解运作方式
        </a>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.7 }}
        className="mt-16 grid grid-cols-3 gap-6 sm:gap-10"
      >
        {[
          { value: '50%', label: '学习时间节省', color: 'var(--aiu-sky-deep)' },
          { value: '2x', label: '理解深度提升', color: 'var(--aiu-emerald)' },
          { value: '0', label: '费用 / 永久免费', color: 'var(--aiu-gold)' },
        ].map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="text-3xl font-black sm:text-4xl" style={{ color: stat.color }}>
              {stat.value}
            </p>
            <p className="mt-1 text-xs font-semibold text-[var(--aiu-ink-soft)] sm:text-sm">
              {stat.label}
            </p>
          </div>
        ))}
      </motion.div>
    </div>

    {/* Scroll indicator */}
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.5 }}
      transition={{ duration: 1, delay: 1.2 }}
      className="absolute bottom-8 left-1/2 -translate-x-1/2"
    >
      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <ArrowDown size={20} className="text-[var(--aiu-ink-soft)]" />
      </motion.div>
    </motion.div>
  </section>
);

export default Hero;
