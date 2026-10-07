"use client";
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Quote, Star } from 'lucide-react';

interface TestimonialsProps {
  className?: string;
}

const enterpriseReviews = [
  {
    quote: "SketchItUp Task Suite transformed how our operations team communicates with manufacturing. The direct ERP sync reduced sprint delays by 42%.",
    author: "Elena Rostova",
    role: "VP of Global Operations",
    company: "Apex Industrial Systems",
    metrics: "-42% Sprint Delays"
  },
  {
    quote: "Having our engineering tasks and supply chain tickets in the same ecosystem is game-changing. SketchItUp AI triages our daily backlog flawlessly.",
    author: "Marcus Chen",
    role: "Chief Technology Officer",
    company: "Vanguard Logistics Group",
    metrics: "12 hrs saved/week"
  },
  {
    quote: "As an ERP architect, I was tired of brittle third-party task plugins. SketchItUp delivers the exact enterprise reliability and security controls we need.",
    author: "Sarah Lindqvist",
    role: "Principal ERP Solutions Architect",
    company: "Nordic Manufacturing",
    metrics: "100% ERP Accuracy"
  },
  {
    quote: "The combination of intuitive Kanban boards and deep SketchItUp ERP data synchronization makes this our organization's daily command center.",
    author: "David Thorne",
    role: "Head of Project Delivery",
    company: "Kestrel Aerospace",
    metrics: "3.5x Faster Delivery"
  }
];

export const Testimonials: React.FC<TestimonialsProps> = ({ className = '' }) => {
  return (
    <div className={`w-full py-16 md:py-24 relative overflow-hidden ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center mb-12 max-w-2xl mx-auto">
          <Badge variant="outline" className="mb-3 px-3 py-1 text-primary border-primary/20 bg-primary/5">
            Enterprise Endorsements
          </Badge>
          <h2 className="text-3xl md:text-4xl font-light tracking-tight text-foreground mb-3">
            Trusted by Leaders Running on <span className="font-semibold text-primary">SketchItUp</span>
          </h2>
          <p className="text-base text-muted-foreground">
            See how operations and engineering executives elevate execution with our ERP Task Management Suite.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {enterpriseReviews.map((item, index) => (
            <div 
              key={index} 
              className="p-6 sm:p-8 rounded-2xl border border-border bg-card/60 backdrop-blur-xs flex flex-col justify-between hover:border-primary/40 transition-all duration-300 shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex gap-1 text-amber-500">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-amber-500" />
                    ))}
                  </div>
                  <Badge variant="secondary" className="font-mono text-[11px] text-primary bg-primary/10">
                    {item.metrics}
                  </Badge>
                </div>
                
                <p className="text-foreground/90 text-sm sm:text-base leading-relaxed mb-6 font-normal">
                  "{item.quote}"
                </p>
              </div>

              <div className="pt-4 border-t border-border/50 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm text-foreground">{item.author}</h4>
                  <p className="text-xs text-muted-foreground">{item.role} • {item.company}</p>
                </div>
                <Quote className="h-6 w-6 text-muted-foreground/30" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
