import React from 'react';
import { Heart } from 'lucide-react';

const Footer: React.FC = () => (
  <footer className="border-t border-[var(--aiu-line)] bg-white py-10">
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 sm:flex-row sm:justify-between">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--aiu-sky-deep)] to-[var(--aiu-ocean)] text-xs font-black text-white">
          A
        </div>
        <span className="text-sm font-bold text-[var(--aiu-ocean)]">
          AIU — AI University
        </span>
      </div>

      <p className="flex items-center gap-1 text-xs text-[var(--aiu-ink-soft)]">
        Made with <Heart size={12} className="text-[var(--aiu-coral)]" /> for education equity
      </p>

      <div className="flex items-center gap-5">
        {[
          ['#philosophy', '理念'],
          ['#how', '运作'],
          ['#open-source', '开源'],
          ['#waitlist', '加入'],
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="text-xs font-semibold text-[var(--aiu-ink-soft)] transition-colors hover:text-[var(--aiu-ocean)]"
          >
            {label}
          </a>
        ))}
      </div>
    </div>
  </footer>
);

export default Footer;
