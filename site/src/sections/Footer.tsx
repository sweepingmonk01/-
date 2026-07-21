import React from 'react';
import { Heart } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

const Footer: React.FC = () => {
  const t = useT();

  return (
    <footer className="border-t border-[var(--aiu-line)] bg-white py-10">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--aiu-sky-deep)] to-[var(--aiu-ocean)] text-xs font-black text-white">
            A
          </div>
          <span className="text-sm font-bold text-[var(--aiu-ocean)]">
            {t('footer.brand')}
          </span>
        </div>

        <p className="flex items-center gap-1 text-xs text-[var(--aiu-ink-soft)]">
          <Heart size={12} className="text-[var(--aiu-coral)]" />
          {t('footer.madeWith')}
        </p>

        <div className="flex items-center gap-5">
          {[
            ['#philosophy', t('footer.nav.philosophy')],
            ['#how', t('footer.nav.how')],
            ['#waitlist', t('footer.nav.join')],
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
};

export default Footer;
