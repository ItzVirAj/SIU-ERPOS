"use client";

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Building2, GitFork, Sparkles } from 'lucide-react';

interface HowToUseSectionProps {
  className?: string;
}

export const HowToUseSection: React.FC<HowToUseSectionProps> = ({ className = '' }) => {
  const steps = [
    {
      number: "01",
      icon: Building2,
      title: "Connect Your SketchItUp ERP Workspace",
      description: "Sign in with your corporate credentials to link directly with your organization's SketchItUp ERP tenant or initialize an autonomous project workspace."
    },
    {
      number: "02",
      icon: GitFork,
      title: "Configure Departmental Workflows",
      description: "Set up boards for Engineering, Operations, Supply Chain, and Finance. Customize Kanban states, team permissions, and milestone deadlines."
    },
    {
      number: "03",
      icon: Sparkles,
      title: "Accelerate Execution with SketchItUp AI",
      description: "Create and triage tasks through conversational AI prompts, automatically sync ERP dependencies, and deliver projects on schedule."
    }
  ];

  return (
    <div id="how-it-works" className={`py-16 md:py-24 lg:py-32 bg-muted/20 relative ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <Badge variant="outline" className="mb-3 px-3 py-1 text-primary border-primary/20 bg-primary/5">
            Simple 3-Step Setup
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-light tracking-tight mb-4 text-foreground">
            How It <span className="font-semibold text-primary">Works</span>
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground">
            Get your teams aligned with SketchItUp in minutes without lengthy onboarding or complex consultants.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div 
                  key={index} 
                  className="flex flex-col items-center text-center p-6 rounded-2xl bg-card border border-border/80 shadow-xs relative group hover:border-primary/40 transition-all"
                >
                  {/* Step Number Badge */}
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-primary text-primary-foreground rounded-xl text-base font-bold mb-5 shadow-sm group-hover:scale-105 transition-transform">
                    {step.number}
                  </div>
                  
                  {/* Title */}
                  <h3 className="text-lg font-semibold text-foreground mb-3">
                    {step.title}
                  </h3>
                  
                  {/* Description */}
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
