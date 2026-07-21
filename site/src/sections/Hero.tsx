import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, ArrowDown } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

const Hero: React.FC = () => {
  const t = useT();

  const stats = [
    { value: t('hero.stat1.value'), label: t('hero.stat1.label'), color: 'var(--aiu-sky-deep)' },
    { value: t('hero.stat2.value'), label: t('hero.stat2.label'), color: 'var(--aiu-emerald)' },
    { value: t('hero.stat3.value'), label: t('hero.stat3.label'), color: 'var(--aiu-gold)' },
  ];

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-8 pt-16">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--aiu-sky)] via-white to-white" />
        <div className="absolute left-[10%] top-[8%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(74,158,255,0.18),transparent_70%)]" />
        <div className="absolute right-[5%] top-[20%] h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(245,166,35,0.12),transparent_70%)]" />
        <div className="absolute bottom-[10%] left-[40%] h-[280px] w-[280px] rounded-full bg-[radial-gradient(circle,rgba(52,199,138,0.1),transparent_70%)]" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-[1200px] items-center gap-16">
        <div className="flex-1">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--aiu-sky-deep)]/20 bg-white/80 px-4 py-1.5 text-sm font-semibold text-[var(--aiu-sky-deep)] shadow-[0_2px_12px_rgba(74,158,255,0.1)] backdrop-blur"
          >
            <Sparkles size={14} />
            {t('hero.badge')}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl font-black leading-[1.1] tracking-tight text-[var(--aiu-ocean-deep)] lg:text-6xl xl:text-7xl"
          >
            {t('hero.h1.line1')}
            <br />
            <span className="bg-gradient-to-r from-[var(--aiu-sky-deep)] to-[#6366f1] bg-clip-text text-transparent">
              {t('hero.h1.line2')}
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--aiu-ink-soft)]"
          >
            {t('hero.desc')}
            <strong className="font-bold text-[var(--aiu-ocean)]">{t('hero.descBold')}</strong>
            {t('hero.descEnd')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-10 flex items-center gap-4"
          >
            <a
              href="#waitlist"
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--aiu-sky-deep)] to-[#6366f1] px-8 py-3.5 text-base font-bold text-white shadow-[0_8px_30px_rgba(74,158,255,0.3)] transition-all hover:shadow-[0_12px_40px_rgba(74,158,255,0.4)] hover:brightness-110"
            >
              {t('hero.ctaPrimary')}
              <ArrowDown size={16} className="transition-transform group-hover:translate-y-0.5" />
            </a>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--aiu-line)] bg-white px-7 py-3.5 text-base font-bold text-[var(--aiu-ocean)] shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
            >
              {t('hero.ctaSecondary')}
            </a>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="hidden w-[340px] shrink-0 flex-col gap-6 rounded-3xl border border-[var(--aiu-line)] bg-white/80 p-8 shadow-[0_8px_40px_rgba(0,0,0,0.06)] backdrop-blur lg:flex"
        >
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-5xl font-black" style={{ color: stat.color }}>
                {stat.value}
              </p>
              <p className="mt-2 text-sm font-semibold text-[var(--aiu-ink-soft)]">
                {stat.label}
              </p>
            </div>
          ))}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ duration: 1, delay: 1.2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity }}>
          <ArrowDown size={20} className="text-[var(--aiu-ink-soft)]" />
        </motion.div>
      </motion.div>
    </section>
  );
};

export default Hero;
