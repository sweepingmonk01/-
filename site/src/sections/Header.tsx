import React, { useEffect, useState } from 'react';

const Header: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);

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
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="#" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--aiu-sky-deep)] to-[var(--aiu-ocean)] text-sm font-black text-white shadow-[0_4px_12px_rgba(74,158,255,0.3)]">
            A
          </div>
          <span className="text-lg font-extrabold tracking-tight text-[var(--aiu-ocean)]">
            AIU
          </span>
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {[
            ['#philosophy', '教育理念'],
            ['#how', '如何运作'],
            ['#for-whom', '谁适合'],
            ['#open-source', '开源'],
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

        <a
          href="#waitlist"
          className="rounded-full bg-[var(--aiu-ocean)] px-5 py-2 text-sm font-bold text-white shadow-[0_4px_14px_rgba(13,31,51,0.2)] transition-all hover:shadow-[0_6px_20px_rgba(13,31,51,0.3)] hover:brightness-110"
        >
          加入等候名单
        </a>
      </div>
    </header>
  );
};

export default Header;
