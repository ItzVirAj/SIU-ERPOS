"use client";
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, CheckCircle2, ShieldCheck, Zap, Layers } from 'lucide-react';
import { TextAnimate } from '@/components/ui/text-animate';
import { DotPattern } from '@/components/ui/dot-pattern';
import Link from 'next/link';

interface HeroSectionProps {
  className?: string;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ className = '' }) => {
  return (
    <div className={`HeroSection min-h-[calc(100vh-10rem)] w-full max-w-7xl mx-auto flex flex-col items-center justify-center px-4 pt-16 pb-12 md:pt-28 md:pb-20 relative ${className}`} data-hero-section>
      {/* Dot Pattern Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <DotPattern
          width={24}
          height={24}
          cr={1}
          className="opacity-60 text-gray-400 dark:text-neutral-700"
          glow={true}
        />
      </div>
      
      <div className="relative z-10 text-center w-full max-w-4xl mx-auto">
        {/* Eyebrow badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs sm:text-sm font-medium mb-8 backdrop-blur-sm shadow-xs animate-in fade-in slide-in-from-top-3 duration-500">
          <Layers className="h-3.5 w-3.5" />
          <span>From the makers of SketchItUp ERP</span>
          <span className="w-1 h-1 rounded-full bg-primary/60" />
          <span className="text-foreground/80 font-normal">Enterprise Task Management Suite</span>
        </div>

        {/* Main Title */}
        <h1 className="text-center text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light tracking-tight text-foreground mb-6 leading-tight">
          Ship Faster Across Your{' '}
          <span className="font-semibold bg-gradient-to-r from-primary via-primary/90 to-primary/70 bg-clip-text text-transparent">
            ERP Ecosystem
          </span>
        </h1>
        
        {/* Description */}
        <p className="text-center text-base sm:text-lg text-muted-foreground mx-auto max-w-2xl mb-10 leading-relaxed font-normal">
          The official task management suite crafted by SketchItUp. Bridge high-level enterprise resource planning with daily sprint execution, automated AI workflows, and cross-departmental clarity.
        </p>
        
        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-14">
          <Button
            size="lg"
            className="group px-8 py-6 text-base font-medium bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:shadow-xl"
            asChild
          >
            <Link href="/dashboard">
              Launch Task Suite
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
          
          <Button
            variant="outline"
            size="lg"
            className="px-7 py-6 text-base font-medium border-border hover:bg-muted/80 transition-all"
            asChild
          >
            <a href="#features">
              Explore ERP Capabilities
            </a>
          </Button>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-3xl mx-auto text-left pt-4 border-t border-border/50">
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-card/60 border border-border/40 backdrop-blur-xs">
            <Zap className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-medium text-foreground">ERP Sync Engine</span>
          </div>
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-card/60 border border-border/40 backdrop-blur-xs">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-medium text-foreground">SketchItUp AI</span>
          </div>
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-card/60 border border-border/40 backdrop-blur-xs">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-medium text-foreground">Agile Sprints</span>
          </div>
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-card/60 border border-border/40 backdrop-blur-xs">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-medium text-foreground">Role-Based RBAC</span>
          </div>
        </div>
      </div>
    </div>
  );
};