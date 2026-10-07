"use client";
import React from 'react';
import { CustomNavbar } from './CustomNavbar';
import { HeroSection } from './HeroSection';
import { DemoVideoSection } from './DemoVideoSection';
import { FeaturesSection } from './FeaturesSection';
import { HowToUseSection } from './HowToUseSection';
import { Testimonials } from './Testimonials';
import { FAQSection } from './FAQSection';
import { CtaSection } from './CtaSection';
import { Footer } from './Footer';
import { HorizontalLine } from './HorizontalLine';

interface LandingPageProps {
  className?: string;
}

export const LandingPage: React.FC<LandingPageProps> = ({ className = '' }) => {
  return (
    <div className={`min-h-screen max-w-7xl mx-auto bg-background text-foreground relative pt-5 ${className}`}>
      {/* Left Vertical Line - positioned to match navbar content width */}
      <div 
        className="fixed top-0 h-full w-px bg-gray-200 dark:bg-neutral-800 z-10 pointer-events-none" 
        style={{ left: 'calc(50vw - 640px)' }}
      />
      
      {/* Right Vertical Line - positioned to match navbar content width */}
      <div 
        className="fixed top-0 h-full w-px bg-gray-200 dark:bg-neutral-800 z-10 pointer-events-none" 
        style={{ right: 'calc(50vw - 640px)' }}
      />
      
      {/* Navigation */}
      <CustomNavbar />
      <HorizontalLine />
      
      {/* Hero Section */}
      <HeroSection />

      <HorizontalLine />
      
      {/* Interactive Platform Showcase */}
      <DemoVideoSection />

      <HorizontalLine />

      {/* Features Section */}
      <FeaturesSection />
      
      <HorizontalLine />
      
      {/* How to Use Section */}
      <HowToUseSection />
      
      <HorizontalLine />
      
      {/* Testimonials Section */}
      <Testimonials />
      
      <HorizontalLine />
      
      {/* FAQ Section */}
      <FAQSection />
      
      <HorizontalLine />
      
      {/* CTA Section */}
      <CtaSection />
      
      {/* Footer */}
      <Footer />
    </div>
  );
};
