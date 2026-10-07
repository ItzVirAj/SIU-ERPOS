"use client";
import React, { useState } from 'react';
import { 
  Kanban, 
  RefreshCw, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Building2, 
  Boxes, 
  ReceiptText, 
  SendHorizontal,
  Bot
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface DemoVideoSectionProps {
  className?: string;
}

export const DemoVideoSection: React.FC<DemoVideoSectionProps> = ({ className = '' }) => {
  const [activeTab, setActiveTab] = useState<'board' | 'erp' | 'ai'>('board');
  const [aiPrompt, setAiPrompt] = useState('Create supply chain audit task for Q4 inventory reconciliation');
  const [aiGenerated, setAiGenerated] = useState(false);

  return (
    <div id="demo" className={`py-16 md:py-24 relative ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-3 px-3 py-1 text-primary border-primary/20 bg-primary/5">
            Interactive Product Preview
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-light tracking-tight mb-4 text-foreground">
            Built for High-Velocity <span className="font-semibold text-primary">ERP Workflows</span>
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Experience how SketchItUp combines agile sprint tracking with full enterprise resource synchronization.
          </p>

          {/* Interactive Mode Switcher */}
          <div className="inline-flex items-center gap-1.5 p-1.5 bg-muted/70 backdrop-blur-md rounded-xl border border-border mt-8">
            <button
              onClick={() => setActiveTab('board')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'board'
                  ? 'bg-background text-foreground shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Kanban className="h-4 w-4 text-primary" />
              <span>Sprint & Kanban</span>
            </button>
            <button
              onClick={() => setActiveTab('erp')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'erp'
                  ? 'bg-background text-foreground shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <RefreshCw className="h-4 w-4 text-primary" />
              <span>ERP Sync Engine</span>
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'ai'
                  ? 'bg-background text-foreground shadow-xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span>SketchItUp AI</span>
            </button>
          </div>
        </div>

        {/* Interactive App Window Showcase */}
        <div className="relative max-w-5xl mx-auto rounded-2xl overflow-hidden border border-border bg-card shadow-2xl transition-all duration-300">
          {/* Mock Browser/Window Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <span className="font-mono ml-2 text-[11px] text-foreground/70">
                https://app.sketchitup.internal/workspace/ops-sprint-44
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                ERP Core: Connected
              </span>
            </div>
          </div>

          {/* Window Body: View 1 (Kanban) */}
          {activeTab === 'board' && (
            <div className="p-6 bg-background/50 min-h-[420px]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-lg text-foreground">Sprint 44: Manufacturing & Logistics Deployment</h3>
                  <p className="text-xs text-muted-foreground">Connected to SketchItUp ERP Instance #PRD-9102</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">14 Issues</Badge>
                  <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-500 bg-emerald-500/5">
                    84% on schedule
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Column 1: Backlog / Triaged */}
                <div className="bg-muted/30 rounded-xl p-3.5 border border-border/50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Backlog (2)
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    <div className="p-3 rounded-lg bg-card border border-border/70 shadow-2xs hover:border-primary/50 transition-colors">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-mono text-muted-foreground">SKU-8921</span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">ERP-INVENTORY</span>
                      </div>
                      <p className="text-xs font-medium text-foreground">Reconcile raw material batch SKU counts</p>
                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>P2 • Normal</span>
                        <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">MK</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-card border border-border/70 shadow-2xs hover:border-primary/50 transition-colors">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-mono text-muted-foreground">FIN-3091</span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500">ERP-BILLING</span>
                      </div>
                      <p className="text-xs font-medium text-foreground">Automate tax reconciliation webhook</p>
                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>P3 • Low</span>
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 text-[10px] font-bold flex items-center justify-center">AR</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 2: In Progress */}
                <div className="bg-muted/30 rounded-xl p-3.5 border border-border/50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" /> In Progress (2)
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    <div className="p-3 rounded-lg bg-card border border-primary/40 shadow-xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-mono text-muted-foreground">OPS-1142</span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500">URGENT</span>
                      </div>
                      <p className="text-xs font-medium text-foreground">Deploy multi-warehouse dispatch trigger</p>
                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="text-amber-500 font-medium">Due in 4h</span>
                        <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-500 text-[10px] font-bold flex items-center justify-center">TL</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-card border border-border/70 shadow-2xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-mono text-muted-foreground">SEC-4029</span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-500/10 text-red-500">ERP-RBAC</span>
                      </div>
                      <p className="text-xs font-medium text-foreground">Audit department permissions for contractors</p>
                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>P1 • High</span>
                        <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">DR</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 3: Completed */}
                <div className="bg-muted/30 rounded-xl p-3.5 border border-border/50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Completed (3)
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    <div className="p-3 rounded-lg bg-card/60 border border-border/40 opacity-90">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-mono text-muted-foreground">ERP-5501</span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">SYNCED</span>
                      </div>
                      <p className="text-xs font-medium text-foreground line-through text-muted-foreground">Configure warehouse barcode scanner API</p>
                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="text-emerald-500">Verified by QA</span>
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 text-[10px] font-bold flex items-center justify-center">SK</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* View 2: ERP Integration Sync */}
          {activeTab === 'erp' && (
            <div className="p-6 bg-background/50 min-h-[420px]">
              <div className="mb-6">
                <h3 className="font-semibold text-lg text-foreground">SketchItUp ERP Integration Matrix</h3>
                <p className="text-xs text-muted-foreground">Real-time bi-directional sync across core ERP modules</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-card border border-border/80 flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                    <Boxes className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-foreground">Supply Chain & Inventory</h4>
                      <Badge className="bg-emerald-500/15 text-emerald-500 border-none text-[10px]">Active Sync</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Automatic issue creation when stock thresholds hit critical limits or deliveries delay.</p>
                    <div className="mt-3 text-[11px] font-mono text-muted-foreground">Last synchronized: 12 seconds ago</div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border/80 flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                    <ReceiptText className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-foreground">Accounting & Invoicing</h4>
                      <Badge className="bg-emerald-500/15 text-emerald-500 border-none text-[10px]">Active Sync</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Links billing reconciliation tasks directly with ledger records and fiscal approval chains.</p>
                    <div className="mt-3 text-[11px] font-mono text-muted-foreground">Last synchronized: 1 minute ago</div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border/80 flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-foreground">Manufacturing Operations</h4>
                      <Badge className="bg-emerald-500/15 text-emerald-500 border-none text-[10px]">Active Sync</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Convert equipment alerts, quality inspections, and production halts into trackable sprints.</p>
                    <div className="mt-3 text-[11px] font-mono text-muted-foreground">Last synchronized: 45 seconds ago</div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border/80 flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-foreground">Enterprise Audit & SLA Engine</h4>
                      <Badge className="bg-emerald-500/15 text-emerald-500 border-none text-[10px]">Active Sync</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Full immutable event tracking for compliance, SOC2, and executive SLA reporting.</p>
                    <div className="mt-3 text-[11px] font-mono text-muted-foreground">Continuous streaming active</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* View 3: SketchItUp AI Copilot */}
          {activeTab === 'ai' && (
            <div className="p-6 bg-background/50 min-h-[420px] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <h3 className="font-semibold text-base text-foreground">SketchItUp Operations AI Assistant</h3>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">LLM Powered • Natural Language Dispatcher</span>
                </div>

                <div className="space-y-3 mb-6">
                  {/* User command bubble */}
                  <div className="p-3.5 rounded-xl bg-muted/60 border border-border/60 max-w-lg text-xs leading-relaxed">
                    <span className="font-semibold text-primary block mb-1">Human Operator:</span>
                    "{aiPrompt}"
                  </div>

                  {/* AI response bubble */}
                  <div className="p-4 rounded-xl bg-card border border-primary/30 shadow-xs max-w-xl text-xs space-y-2">
                    <div className="flex items-center gap-1.5 text-primary font-semibold">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>SketchItUp AI Assistant:</span>
                    </div>
                    <p className="text-muted-foreground">
                      I have analyzed your request and created an enterprise ticket linked to your SketchItUp ERP tenant:
                    </p>
                    <div className="p-3 rounded-lg bg-muted/40 border border-border text-[11px] space-y-1">
                      <div className="flex justify-between font-mono">
                        <span className="text-foreground font-semibold">Ticket: SKU-9044</span>
                        <span className="text-amber-500 font-semibold">Priority: P1 (High)</span>
                      </div>
                      <div className="text-foreground font-medium">Q4 Warehouse Inventory Reconciliation & Discrepancy Audit</div>
                      <div className="text-muted-foreground">Assigned: Logistics Ops Team • ERP Module: Supply Chain Core</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Input simulator */}
              <div className="flex items-center gap-2 pt-3 border-t border-border">
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Ask SketchItUp AI to create an issue, sprint task, or triage tickets..."
                  className="flex-1 bg-muted/50 border border-border rounded-lg px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setAiGenerated(true)}>
                  <SendHorizontal className="h-3.5 w-3.5" />
                  <span>Execute</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info under demo */}
        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            Experience effortless enterprise agility. Fully integrated with your existing SketchItUp ERP tenant.
          </p>
        </div>
      </div>
    </div>
  );
};
