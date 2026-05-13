import React, { useEffect, useState } from 'react';
import { useLang, useT } from '../i18n/LanguageContext';
import { Globe } from 'lucide-react';

const Header: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const { lang, toggleLang } = useLang();
  const t = useT();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 shadow-[0_1px_0_rgba(0,0,0,0.06)] backdrop-blur-xl'
          : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-8">
        <a href="#" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--aiu-sky-deep)] to-[var(--aiu-ocean)] text-sm font-black text-white shadow-[0_4px_12px_rgba(74,158,255,0.3)]">
            A
          </div>
          <span className="text-lg font-extrabold tracking-tight text-[var(--aiu-ocean)]">
            AIU
          </span>
        </a>

        <nav className="flex items-center gap-10">
          {[
            ['#philosophy', t('nav.philosophy')],
            ['#how', t('nav.how')],
            ['#for-whom', t('nav.forWhom')],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="text-sm font-semibold text-[var(--aiu-ink-soft)] transition-colors hover:text-[var(--aiu-ocean)]"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleLang}
            className="flex items-center gap-1.5 rounded-full border border-[var(--aiu-line)] px-3.5 py-1.5 text-xs font-bold text-[var(--aiu-ink-soft)] transition-all hover:border-[var(--aiu-sky-deep)] hover:text-[var(--aiu-ocean)]"
          >
            <Globe size={14} />
            {lang === 'cn' ? 'EN' : '中文'}
          </button>

          <a
            href="#waitlist"
            className="rounded-full bg-[var(--aiu-ocean)] px-5 py-2 text-sm font-bold text-white shadow-[0_4px_14px_rgba(13,31,51,0.2)] transition-all hover:shadow-[0_6px_20px_rgba(13,31,51,0.3)] hover:brightness-110"
          >
            {t('nav.joinWaitlist')}
          </a>
        </div>
      </div>
    </header>
  );
};

export default Header;
