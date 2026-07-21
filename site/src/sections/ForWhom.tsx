import React from 'react';
import { motion } from 'motion/react';
import { GraduationCap, Users, BookOpen } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';
import type { TranslationKey } from '../i18n/translations';

const PERSONAS: {
  icon: typeof GraduationCap;
  whoKey: TranslationKey;
  painKey: TranslationKey;
  gainKey: TranslationKey;
  color: string;
  bg: string;
}[] = [
  {
    icon: GraduationCap,
    whoKey: 'whom.p1.who',
    painKey: 'whom.p1.pain',
    gainKey: 'whom.p1.gain',
    color: 'var(--aiu-sky-deep)',
    bg: 'linear-gradient(135deg, rgba(74,158,255,0.06), rgba(99,102,241,0.06))',
  },
  {
    icon: Users,
    whoKey: 'whom.p2.who',
    painKey: 'whom.p2.pain',
    gainKey: 'whom.p2.gain',
    color: 'var(--aiu-emerald)',
    bg: 'linear-gradient(135deg, rgba(52,199,138,0.06), rgba(16,185,129,0.06))',
  },
  {
    icon: BookOpen,
    whoKey: 'whom.p3.who',
    painKey: 'whom.p3.pain',
    gainKey: 'whom.p3.gain',
    color: 'var(--aiu-lavender)',
    bg: 'linear-gradient(135deg, rgba(163,113,255,0.06), rgba(139,92,246,0.06))',
  },
];

const ForWhom: React.FC = () => {
  const t = useT();

  return (
    <section id="for-whom" className="relative overflow-hidden bg-[var(--aiu-cloud)] py-28">
      <div className="mx-auto max-w-[1200px] px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <span className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--aiu-gold)]">
            {t('whom.tag')}
          </span>
          <h2 className="mt-3 text-4xl font-black tracking-tight text-[var(--aiu-ocean-deep)]">
            {t('whom.title')}
          </h2>
        </motion.div>

        <div className="mt-14 grid grid-cols-3 gap-8">
          {PERSONAS.map((p, index) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={p.whoKey}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, delay: index * 0.12 }}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--aiu-line)] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,0.07)]"
              >
                <div className="px-7 pb-5 pt-7" style={{ background: p.bg }}>
                  <div
                    className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                    style={{ color: p.color }}
                  >
                    <Icon size={22} />
                  </div>
                  <h3 className="text-xl font-extrabold text-[var(--aiu-ocean)]">{t(p.whoKey)}</h3>
                </div>

                <div className="flex flex-1 flex-col px-7 pb-7 pt-5">
                  <p className="text-sm font-semibold italic text-[var(--aiu-ink-soft)]">
                    {t(p.painKey)}
                  </p>
                  <div className="my-4 h-px bg-[var(--aiu-line)]" />
                  <p className="text-sm leading-relaxed text-[var(--aiu-ink-soft)]">
                    {t(p.gainKey)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ForWhom;
