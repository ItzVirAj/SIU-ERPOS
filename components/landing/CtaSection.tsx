"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Layers } from 'lucide-react';
import { Ripple } from '@/components/ui/ripple';
import Link from 'next/link';

interface CtaSectionProps {
  className?: string;
}

export const CtaSection: React.FC<CtaSectionProps> = ({ className = '' }) => {
  return (
    <div className={`CtaSection py-20 md:py-28 overflow-hidden relative ${className}`} data-cta-section>
      {/* Ripple Effect Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <Ripple 
          mainCircleSize={220}
          mainCircleOpacity={0.25}
          numCircles={6}
          className="opacity-80"
        />
      </div>
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/10 text-primary text-xs font-medium mb-6">
          <Layers className="h-3.5 w-3.5" />
          <span>SketchItUp ERP Platform Ecosystem</span>
        </div>

        <h2 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-tight text-foreground mb-6">
          Ready to Orchestrate Your <span className="font-semibold text-primary">ERP Workflows?</span>
        </h2>
        
        <p className="text-base sm:text-lg text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
          Join high-performing operations, manufacturing, and technology teams executing with precision on SketchItUp Task Management Suite.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button
            size="lg"
            className="group px-8 py-6 text-base font-medium bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl transition-all"
            asChild
          >
            <Link href="/dashboard">
              Launch Task Workspace
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
          
          <Button
            variant="outline"
            size="lg"
            className="px-8 py-6 text-base font-medium border-border hover:bg-muted/80 transition-all"
            asChild
          >
            <Link href="/sign-in">
              Sign In to Your Account
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};
