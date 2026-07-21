import React from 'react';
import { motion } from 'motion/react';
import { Brain, Clock, Target, Shield } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';
import type { TranslationKey } from '../i18n/translations';

const PILLARS: {
  icon: typeof Brain;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  color: string;
  bg: string;
}[] = [
  { icon: Brain, titleKey: 'phil.p1.title', descKey: 'phil.p1.desc', color: 'var(--aiu-sky-deep)', bg: 'rgba(74, 158, 255, 0.08)' },
  { icon: Clock, titleKey: 'phil.p2.title', descKey: 'phil.p2.desc', color: 'var(--aiu-emerald)', bg: 'rgba(52, 199, 138, 0.08)' },
  { icon: Target, titleKey: 'phil.p3.title', descKey: 'phil.p3.desc', color: 'var(--aiu-gold)', bg: 'rgba(245, 166, 35, 0.08)' },
  { icon: Shield, titleKey: 'phil.p4.title', descKey: 'phil.p4.desc', color: 'var(--aiu-lavender)', bg: 'rgba(163, 113, 255, 0.08)' },
];

const Philosophy: React.FC = () => {
  const t = useT();

  return (
    <section id="philosophy" className="relative overflow-hidden bg-[var(--aiu-cloud)] py-28">
      <div className="pointer-events-none absolute right-0 top-0 h-[400px] w-[400px] bg-[radial-gradient(circle,rgba(74,158,255,0.06),transparent_70%)]" />

      <div className="mx-auto max-w-[1200px] px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <span className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--aiu-sky-deep)]">
            {t('phil.tag')}
          </span>
          <h2 className="mt-3 text-4xl font-black tracking-tight text-[var(--aiu-ocean-deep)]">
            {t('phil.title')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[var(--aiu-ink-soft)]">
            {t('phil.desc')}
          </p>
        </motion.div>

        <div className="mt-16 grid grid-cols-2 gap-8">
          {PILLARS.map((pillar, index) => {
            const Icon = pillar.icon;
            return (
              <motion.div
                key={pillar.titleKey}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group relative overflow-hidden rounded-2xl border border-[var(--aiu-line)] bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
              >
                <div
                  className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ background: pillar.bg, color: pillar.color }}
                >
                  <Icon size={24} />
                </div>
                <h3 className="text-xl font-extrabold text-[var(--aiu-ocean)]">
                  {t(pillar.titleKey)}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--aiu-ink-soft)]">
                  {t(pillar.descKey)}
                </p>
                <div
                  className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-30 blur-2xl transition-opacity group-hover:opacity-50"
                  style={{ background: pillar.color }}
                />
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Philosophy;
