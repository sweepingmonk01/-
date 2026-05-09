import React from 'react';
import Header from './sections/Header';
import Hero from './sections/Hero';
import Philosophy from './sections/Philosophy';
import HowItWorks from './sections/HowItWorks';
import ForWhom from './sections/ForWhom';
import OpenSource from './sections/OpenSource';
import CTA from './sections/CTA';
import Footer from './sections/Footer';

const App: React.FC = () => (
  <div className="relative min-h-screen overflow-x-hidden">
    <Header />
    <main>
      <Hero />
      <Philosophy />
      <HowItWorks />
      <ForWhom />
      <OpenSource />
      <CTA />
    </main>
    <Footer />
  </div>
);

export default App;
