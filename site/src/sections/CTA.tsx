import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, ArrowRight, CheckCircle } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

const CTA: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const t = useT();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
  };

  return (
    <section
      id="waitlist"
      className="relative overflow-hidden bg-gradient-to-b from-white to-[var(--aiu-sky)] py-28"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[20%] top-[30%] h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(74,158,255,0.1),transparent_70%)]" />
        <div className="absolute right-[15%] top-[50%] h-[250px] w-[250px] rounded-full bg-[radial-gradient(circle,rgba(245,166,35,0.08),transparent_70%)]" />
      </div>

      <div className="relative z-10 mx-auto max-w-[720px] px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
        >
          <div className="mx-auto mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--aiu-sky-deep)] to-[#6366f1] text-white shadow-[0_8px_24px_rgba(74,158,255,0.3)]">
            <Mail size={24} />
          </div>

          <h2 className="text-4xl font-black tracking-tight text-[var(--aiu-ocean-deep)]">
            {t('cta.title')}
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-[var(--aiu-ink-soft)]">
            {t('cta.desc')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-10"
        >
          {submitted ? (
            <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-emerald-200 bg-white p-5 shadow-[0_4px_20px_rgba(52,199,138,0.12)]">
              <CheckCircle size={24} className="shrink-0 text-[var(--aiu-emerald)]" />
              <div className="text-left">
                <p className="font-bold text-[var(--aiu-ocean)]">{t('cta.success.title')}</p>
                <p className="mt-0.5 text-sm text-[var(--aiu-ink-soft)]">
                  {t('cta.success.desc')}
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mx-auto flex max-w-lg gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('cta.placeholder')}
                required
                className="flex-1 rounded-xl border border-[var(--aiu-line)] bg-white px-5 py-3.5 text-sm text-[var(--aiu-ocean)] shadow-[0_2px_8px_rgba(0,0,0,0.04)] outline-none transition-shadow placeholder:text-gray-400 focus:border-[var(--aiu-sky-deep)] focus:shadow-[0_0_0_3px_rgba(74,158,255,0.12)]"
              />
              <button
                type="submit"
                className="group inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--aiu-sky-deep)] to-[#6366f1] px-8 py-3.5 text-sm font-bold text-white shadow-[0_4px_16px_rgba(74,158,255,0.3)] transition-all hover:shadow-[0_8px_24px_rgba(74,158,255,0.4)]"
              >
                {t('cta.button')}
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            </form>
          )}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-6 text-xs text-[var(--aiu-ink-soft)]"
        >
          {t('cta.privacy')}
        </motion.p>
      </div>
    </section>
  );
};

export default CTA;
