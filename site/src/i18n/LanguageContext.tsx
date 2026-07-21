import React, { createContext, useContext, useState, useCallback } from 'react';
import translations, { type Lang, type TranslationKey } from './translations';

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Lang>('cn');

  const toggleLang = useCallback(() => {
    setLang((prev) => (prev === 'cn' ? 'en' : 'cn'));
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => translations[key][lang],
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useT() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useT must be used within <LanguageProvider>');
  return ctx.t;
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used within <LanguageProvider>');
  return ctx;
}
