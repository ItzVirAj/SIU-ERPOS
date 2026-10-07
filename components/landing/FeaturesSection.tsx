"use client";
import React from 'react';
import { 
  Boxes, 
  Sparkles, 
  Kanban, 
  Users2, 
  ShieldCheck, 
  LineChart, 
  Layers, 
  Zap,
  ArrowUpRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface FeaturesSectionProps {
  className?: string;
}

const features = [
  {
    icon: Boxes,
    title: "Native ERP Core Integration",
    category: "ERP Synchronization",
    description: "Directly link issues and tasks to SketchItUp ERP modules—inventory batches, purchase orders, client invoices, and manufacturing runs. Say goodbye to fragmented data.",
    badge: "Enterprise Ready",
    gradient: "from-blue-500/10 via-transparent to-transparent"
  },
  {
    icon: Sparkles,
    title: "SketchItUp AI Assistant",
    category: "Intelligent Operations",
    description: "Empower your managers with natural language task creation, smart ticket triage, auto-summarization of daily standups, and proactive bottleneck detection.",
    badge: "AI Powered",
    gradient: "from-purple-500/10 via-transparent to-transparent"
  },
  {
    icon: Kanban,
    title: "Agile Sprints & Kanban Boards",
    category: "Execution Engines",
    description: "Manage complex enterprise deliverables with custom pipeline states, multi-tier priorities, time estimations, and drag-and-drop workflow transitions.",
    badge: "Real-time",
    gradient: "from-emerald-500/10 via-transparent to-transparent"
  },
  {
    icon: Users2,
    title: "Departmental Workspaces",
    category: "Team Architecture",
    description: "Isolate and orchestrate cross-functional departments—Engineering, Logistics, Finance, and Plant Operations—within interconnected team workspaces.",
    badge: "Multi-Team",
    gradient: "from-amber-500/10 via-transparent to-transparent"
  },
  {
    icon: ShieldCheck,
    title: "Enterprise RBAC & Security",
    category: "Governance",
    description: "Fine-grained role-based access control, comprehensive activity audit trails, and strict tenant isolation keep your operational data compliant and protected.",
    badge: "SOC2 Compliance",
    gradient: "from-cyan-500/10 via-transparent to-transparent"
  },
  {
    icon: LineChart,
    title: "Velocity & SLA Analytics",
    category: "Executive Insights",
    description: "Track team throughput, cycle times, and SLA adherence across all projects with real-time analytics designed for executive and operational leadership.",
    badge: "Live Telemetry",
    gradient: "from-rose-500/10 via-transparent to-transparent"
  }
];

export const FeaturesSection: React.FC<FeaturesSectionProps> = ({ className = '' }) => {
  return (
    <section id="features" className={`py-16 md:py-24 lg:py-32 relative ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="outline" className="mb-3 px-3 py-1 text-primary border-primary/20 bg-primary/5">
            Platform Capabilities
          </Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight text-foreground mb-4">
            Engineered for <span className="font-semibold text-primary">Enterprise Complexity</span>
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground">
            From manufacturing floors to executive boardrooms, SketchItUp Task Management Suite provides the tools needed to execute flawlessly.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="group relative flex flex-col justify-between p-6 sm:p-8 rounded-2xl border border-border/70 bg-card hover:bg-card/80 hover:border-primary/40 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden"
              >
                {/* Background ambient gradient */}
                <div 
                  className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} 
                />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-5">
                    <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                      <Icon className="h-6 w-6" />
                    </div>
                    <Badge variant="secondary" className="text-[11px] font-medium font-mono text-muted-foreground">
                      {feature.badge}
                    </Badge>
                  </div>

                  <span className="text-xs font-semibold uppercase tracking-wider text-primary/80 block mb-1">
                    {feature.category}
                  </span>
                  
                  <h3 className="text-xl font-semibold text-foreground mb-3 group-hover:text-primary transition-colors">
                    {feature.title}
                  </h3>
                  
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>

                <div className="relative z-10 pt-6 mt-6 border-t border-border/50 flex items-center justify-between text-xs font-medium text-muted-foreground group-hover:text-foreground">
                  <span>Learn more</span>
                  <ArrowUpRight className="h-4 w-4 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Banner */}
        <div className="mt-16 p-8 rounded-2xl border border-border/80 bg-gradient-to-r from-muted/50 via-card to-muted/50 text-center max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-left">
            <h4 className="text-lg font-semibold text-foreground">Already using the SketchItUp ERP Platform?</h4>
            <p className="text-sm text-muted-foreground mt-1">Connect your existing organization tenant in seconds with zero custom code.</p>
          </div>
          <Link
            href="/dashboard"
            className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-all shrink-0 shadow-md"
          >
            Connect Workspace
          </Link>
        </div>
      </div>
    </section>
  );
};
