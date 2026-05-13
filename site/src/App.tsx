import React from 'react';
import { LanguageProvider } from './i18n/LanguageContext';
import Header from './sections/Header';
import Hero from './sections/Hero';
import Philosophy from './sections/Philosophy';
import HowItWorks from './sections/HowItWorks';
import ForWhom from './sections/ForWhom';
import CTA from './sections/CTA';
import Footer from './sections/Footer';

const App: React.FC = () => (
  <LanguageProvider>
    <div className="relative min-h-screen overflow-x-hidden">
      <Header />
      <main>
        <Hero />
        <Philosophy />
        <HowItWorks />
        <ForWhom />
        <CTA />
      </main>
      <Footer />
    </div>
  </LanguageProvider>
);

export default App;
