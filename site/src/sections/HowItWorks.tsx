import React from 'react';
import { motion } from 'motion/react';
import { Camera, Cpu, Zap, TrendingUp, RotateCcw } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';
import type { TranslationKey } from '../i18n/translations';

const STEPS: {
  num: string;
  icon: typeof Camera;
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
  descKey: TranslationKey;
  color: string;
}[] = [
  { num: '01', icon: Camera, titleKey: 'how.s1.title', subtitleKey: 'how.s1.subtitle', descKey: 'how.s1.desc', color: 'var(--aiu-sky-deep)' },
  { num: '02', icon: Cpu, titleKey: 'how.s2.title', subtitleKey: 'how.s2.subtitle', descKey: 'how.s2.desc', color: 'var(--aiu-emerald)' },
  { num: '03', icon: Zap, titleKey: 'how.s3.title', subtitleKey: 'how.s3.subtitle', descKey: 'how.s3.desc', color: 'var(--aiu-gold)' },
  { num: '04', icon: TrendingUp, titleKey: 'how.s4.title', subtitleKey: 'how.s4.subtitle', descKey: 'how.s4.desc', color: 'var(--aiu-lavender)' },
  { num: '05', icon: RotateCcw, titleKey: 'how.s5.title', subtitleKey: 'how.s5.subtitle', descKey: 'how.s5.desc', color: 'var(--aiu-coral)' },
];

const HowItWorks: React.FC = () => {
  const t = useT();

  return (
    <section id="how" className="relative py-28">
      <div className="mx-auto max-w-[1200px] px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <span className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--aiu-emerald)]">
            {t('how.tag')}
          </span>
          <h2 className="mt-3 text-4xl font-black tracking-tight text-[var(--aiu-ocean-deep)]">
            {t('how.title')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[var(--aiu-ink-soft)]">
            {t('how.desc')}
          </p>
        </motion.div>

        <div className="relative mt-20">
          <div className="absolute left-0 right-0 top-[28px] h-px bg-gradient-to-r from-[var(--aiu-sky-deep)] via-[var(--aiu-emerald)] to-[var(--aiu-coral)] opacity-20" />

          <div className="grid grid-cols-5 gap-6">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.num}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="group flex flex-col items-center text-center"
                >
                  <div
                    className="relative z-10 mb-6 flex h-14 w-14 items-center justify-center rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-shadow group-hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
                    style={{ background: step.color, color: '#fff' }}
                  >
                    <Icon size={24} />
                  </div>

                  <div className="w-full rounded-2xl border border-[var(--aiu-line)] bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.02)] transition-shadow group-hover:shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
                    <span
                      className="text-xs font-black uppercase tracking-[0.15em]"
                      style={{ color: step.color }}
                    >
                      Step {step.num}
                    </span>
                    <h3 className="mt-2 text-base font-extrabold text-[var(--aiu-ocean)]">
                      {t(step.titleKey)}
                    </h3>
                    <p className="mt-1 text-xs font-semibold text-[var(--aiu-ink-soft)]">
                      {t(step.subtitleKey)}
                    </p>
                    <p className="mt-3 text-xs leading-relaxed text-[var(--aiu-ink-soft)]">
                      {t(step.descKey)}
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
};

export default HowItWorks;
