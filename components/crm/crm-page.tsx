"use client";

import React, { useState, useMemo } from "react";
import { useActiveTeam } from "@/lib/context/team-context";
import {
  useLeadPipeline,
  useLeads,
  useUpdateLead,
  LeadItem,
  LeadStageItem,
} from "@/lib/hooks/use-crm";
import { LeadDialog } from "@/components/crm/lead-dialog";
import { LeadDetailsSheet } from "@/components/crm/lead-details-sheet";
import { DashboardLoader } from "@/components/ui/dashboard-loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Target,
  Plus,
  Search,
  Filter,
  Flame,
  Sun,
  Snowflake,
  DollarSign,
  AlertTriangle,
  Building,
  User,
  Calendar,
  CheckCircle2,
  Columns,
  List,
  ArrowRight,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function CrmPage() {
  const { teamId, loading: teamLoading } = useActiveTeam();

  const [calViewMode, setCalViewMode] = useState<"kanban" | "table">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTemperature, setFilterTemperature] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [overdueOnly, setOverdueOnly] = useState(false);

  // Dialog State
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogStageId, setDialogStageId] = useState<string | undefined>(undefined);

  // Queries & Mutations
  const { data: pipeline, isLoading: pipelineLoading } = useLeadPipeline(teamId);
  const { data: leads = [], isLoading: leadsLoading } = useLeads(teamId, {
    temperature: filterTemperature !== "all" ? filterTemperature : undefined,
    source: filterSource !== "all" ? filterSource : undefined,
    overdue: overdueOnly,
    search: searchQuery || undefined,
  });
  const updateLeadMutation = useUpdateLead(teamId);

  const stages = useMemo(() => pipeline?.stages || [], [pipeline]);

  // Sales Pipeline Metrics Calculation
  const metrics = useMemo(() => {
    let totalPipelineValue = 0;
    let wonValue = 0;
    let hotCount = 0;
    let overdueCount = 0;
    const now = new Date();

    leads.forEach((l) => {
      const val = l.estimatedValue || 0;
      if (l.isWon) {
        wonValue += val;
      } else if (!l.isLost) {
        totalPipelineValue += val;
      }

      if (l.temperature === "hot" && !l.isWon && !l.isLost) {
        hotCount++;
      }

      if (l.nextFollowUpDate && new Date(l.nextFollowUpDate) < now && !l.isWon && !l.isLost) {
        overdueCount++;
      }
    });

    const activeCount = leads.filter((l) => !l.isWon && !l.isLost).length;

    return {
      totalPipelineValue,
      wonValue,
      hotCount,
      overdueCount,
      activeCount,
    };
  }, [leads]);

  // Group leads by stage for Kanban
  const leadsByStage = useMemo(() => {
    const map = new Map<string, LeadItem[]>();
    stages.forEach((st) => map.set(st.id, []));

    leads.forEach((l) => {
      const list = map.get(l.stageId);
      if (list) {
        list.push(l);
      } else {
        map.set(l.stageId, [l]);
      }
    });

    return map;
  }, [leads, stages]);

  const handleCardClick = (lead: LeadItem) => {
    setSelectedLead(lead);
    setSheetOpen(true);
  };

  const handleOpenAdd = (stId?: string) => {
    setDialogStageId(stId);
    setLeadDialogOpen(true);
  };

  const handleMoveStage = async (leadId: string, targetStageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateLeadMutation.mutateAsync({
        leadId,
        data: { stageId: targetStageId },
      });
      toast.success("Lead moved to next stage");
    } catch (err: any) {
      toast.error(err.message || "Failed to update stage");
    }
  };

  if (teamLoading || pipelineLoading || !teamId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <DashboardLoader message="Loading Sales Pipeline" submessage="Fetching CRM leads and Kanban stages..." />
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#0e0f11] text-neutral-100 flex flex-col">
      {/* 1. Header with Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-neutral-800/80 px-6 py-4 gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-400" />
            CRM & Sales Pipeline
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            PRD 6.3: Capture leads from website & marketplaces, track Kanban deal flow, and never miss a follow-up.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => handleOpenAdd()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-sm shadow-indigo-600/30"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Capture Lead (CRM-01)
          </Button>
        </div>
      </div>

      {/* 2. Executive Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 py-3.5 border-b border-neutral-800/80 bg-[#111215]">
        <div className="p-3 rounded-lg bg-neutral-900/60 border border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-neutral-500 font-medium block">Active Pipeline Value</span>
            <span className="text-base font-bold font-mono text-emerald-400">
              ₹{metrics.totalPipelineValue.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 rounded-lg bg-neutral-900/60 border border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-neutral-500 font-medium block">Hot Deals</span>
            <span className="text-base font-bold text-rose-400 flex items-center gap-1">
              {metrics.hotCount} <span className="text-xs text-neutral-500 font-normal">deals</span>
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
            <Flame className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 rounded-lg bg-neutral-900/60 border border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-neutral-500 font-medium block">Overdue Follow-ups</span>
            <span className={`text-base font-bold flex items-center gap-1 ${metrics.overdueCount > 0 ? "text-amber-400" : "text-neutral-400"}`}>
              {metrics.overdueCount} <span className="text-xs text-neutral-500 font-normal">pending</span>
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 rounded-lg bg-neutral-900/60 border border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-neutral-500 font-medium block">Won & Converted</span>
            <span className="text-base font-bold font-mono text-indigo-400">
              ₹{metrics.wonValue.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 3. Toolbar & Filters */}
      <div className="flex flex-wrap items-center justify-between px-6 py-2.5 border-b border-neutral-800/80 bg-[#111215] gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search leads, companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-neutral-900 border border-neutral-800 rounded-md text-xs text-neutral-100 pl-8 pr-3 py-1.5 w-48 sm:w-56 focus:outline-none focus:border-neutral-700"
            />
          </div>

          {/* Temperature Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 border-neutral-800 text-xs text-neutral-300 bg-neutral-900">
                <Filter className="w-3 h-3 mr-1.5 text-neutral-400" />
                Temp: {filterTemperature === "all" ? "All" : filterTemperature.toUpperCase()}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#18191c] border-neutral-800 text-xs text-neutral-200">
              <DropdownMenuItem onClick={() => setFilterTemperature("all")}>All Temperatures</DropdownMenuItem>
              <DropdownMenuSeparator className="bg-neutral-800" />
              <DropdownMenuItem onClick={() => setFilterTemperature("hot")}>🔥 Hot</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterTemperature("warm")}>☀️ Warm</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterTemperature("cold")}>❄️ Cold</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Source Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 border-neutral-800 text-xs text-neutral-300 bg-neutral-900">
                Source: {filterSource === "all" ? "All" : filterSource}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#18191c] border-neutral-800 text-xs text-neutral-200">
              <DropdownMenuItem onClick={() => setFilterSource("all")}>All Sources</DropdownMenuItem>
              <DropdownMenuSeparator className="bg-neutral-800" />
              <DropdownMenuItem onClick={() => setFilterSource("website")}>🌐 Website</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterSource("fiverr")}>🟢 Fiverr</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterSource("upwork")}>🟢 Upwork</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterSource("referral")}>🤝 Referral</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterSource("linkedin")}>💼 LinkedIn</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Overdue Follow-ups Quick Toggle */}
          <Button
            variant={overdueOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setOverdueOnly(!overdueOnly)}
            className={`h-8 text-xs ${
              overdueOnly
                ? "bg-amber-600 hover:bg-amber-500 text-white"
                : "border-neutral-800 text-neutral-300 bg-neutral-900"
            }`}
          >
            <AlertTriangle className="w-3 h-3 mr-1.5" />
            Overdue Follow-ups ({metrics.overdueCount})
          </Button>
        </div>

        {/* View Switcher: Kanban vs. Table */}
        <div className="flex p-0.5 rounded-lg bg-neutral-900 border border-neutral-800">
          <button
            onClick={() => setCalViewMode("kanban")}
            className={`px-2.5 py-1 text-xs rounded-md flex items-center gap-1.5 transition-all ${
              calViewMode === "kanban"
                ? "bg-neutral-800 text-white font-medium"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            Kanban
          </button>
          <button
            onClick={() => setCalViewMode("table")}
            className={`px-2.5 py-1 text-xs rounded-md flex items-center gap-1.5 transition-all ${
              calViewMode === "table"
                ? "bg-neutral-800 text-white font-medium"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <List className="w-3.5 h-3.5" />
            Table
          </button>
        </div>
      </div>

      {/* 4. Main Body: Kanban or Table */}
      <div className="flex-1 p-6 overflow-x-auto">
        {calViewMode === "kanban" ? (
          /* KANBAN BOARD VIEW */
          <div className="flex gap-4 items-start pb-4 min-w-[1200px]">
            {stages.map((stage, sIdx) => {
              const stageLeads = leadsByStage.get(stage.id) || [];
              const stageTotalVal = stageLeads.reduce((acc, l) => acc + (l.estimatedValue || 0), 0);

              return (
                <div
                  key={stage.id}
                  className="w-72 bg-neutral-950/60 border border-neutral-800/80 rounded-xl flex flex-col max-h-[calc(100vh-250px)]"
                >
                  {/* Stage Header */}
                  <div className="p-3 border-b border-neutral-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      ></span>
                      <h3 className="text-xs font-semibold text-neutral-200">{stage.name}</h3>
                      <span className="text-[11px] text-neutral-500 font-mono">({stageLeads.length})</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenAdd(stage.id)}
                      className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Stage Value Subheader */}
                  {stageTotalVal > 0 && (
                    <div className="px-3 py-1 bg-neutral-900/40 border-b border-neutral-800/40 text-[10px] font-mono text-emerald-400">
                      ₹{stageTotalVal.toLocaleString("en-IN")}
                    </div>
                  )}

                  {/* Cards List */}
                  <div className="p-2 space-y-2 overflow-y-auto flex-1">
                    {stageLeads.length === 0 ? (
                      <div className="py-8 text-center text-[11px] text-neutral-600">No leads in stage</div>
                    ) : (
                      stageLeads.map((lead) => {
                        const isCardOverdue =
                          lead.nextFollowUpDate &&
                          new Date(lead.nextFollowUpDate) < new Date() &&
                          !lead.isWon &&
                          !lead.isLost;

                        return (
                          <div
                            key={lead.id}
                            onClick={() => handleCardClick(lead)}
                            className="p-3 rounded-lg bg-neutral-900/70 hover:bg-neutral-900 border border-neutral-800/80 hover:border-neutral-700 transition-all cursor-pointer space-y-2 group"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-xs font-semibold text-neutral-200 leading-snug line-clamp-2">
                                {lead.title}
                              </h4>

                              {/* Temperature icon */}
                              {lead.temperature === "hot" && <Flame className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                              {lead.temperature === "warm" && <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                              {lead.temperature === "cold" && <Snowflake className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                            </div>

                            {lead.companyName && (
                              <p className="text-[11px] text-neutral-400 truncate flex items-center gap-1">
                                <Building className="w-3 h-3 text-neutral-500" />
                                {lead.companyName}
                              </p>
                            )}

                            {/* Estimated Value & Follow-up */}
                            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-neutral-800/50">
                              <span className="font-mono font-medium text-emerald-400">
                                {lead.estimatedValue ? `₹${lead.estimatedValue.toLocaleString("en-IN")}` : "₹—"}
                              </span>

                              {lead.nextFollowUpDate && (
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${
                                    isCardOverdue
                                      ? "bg-red-950/40 text-red-300 border border-red-900/60 font-semibold"
                                      : "text-neutral-500 bg-neutral-950"
                                  }`}
                                >
                                  <Calendar className="w-2.5 h-2.5" />
                                  {new Date(lead.nextFollowUpDate).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              )}
                            </div>

                            {/* Quick Next Stage Mover on Hover */}
                            {sIdx < stages.length - 1 && (
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity pt-1 flex justify-end">
                                <button
                                  type="button"
                                  onClick={(e) => handleMoveStage(lead.id, stages[sIdx + 1].id, e)}
                                  className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
                                >
                                  Advance to {stages[sIdx + 1].name} <ArrowRight className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* TABLE VIEW */
          <div className="bg-neutral-950/60 border border-neutral-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs text-neutral-300">
              <thead className="bg-neutral-900/80 border-b border-neutral-800 text-[11px] text-neutral-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Deal / Lead</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4">Value</th>
                  <th className="py-3 px-4">Temperature</th>
                  <th className="py-3 px-4">Next Follow-up</th>
                  <th className="py-3 px-4">Owner</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-neutral-500">
                      No leads match the filters.
                    </td>
                  </tr>
                ) : (
                  leads.map((l) => (
                    <tr
                      key={l.id}
                      onClick={() => handleCardClick(l)}
                      className="hover:bg-neutral-900/60 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-semibold text-neutral-100">{l.title}</td>
                      <td className="py-3 px-4 text-neutral-400">{l.companyName || "—"}</td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className="text-[10px]"
                          style={{ borderColor: l.stage.color, color: l.stage.color }}
                        >
                          {l.stage.name}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-emerald-400">
                        {l.estimatedValue ? `₹${l.estimatedValue.toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td className="py-3 px-4 uppercase text-[10px] font-bold">
                        <span className="flex items-center gap-1">
                          {l.temperature === "hot" && <Flame className="w-3.5 h-3.5 text-rose-400" />}
                          {l.temperature === "warm" && <Sun className="w-3.5 h-3.5 text-amber-400" />}
                          {l.temperature === "cold" && <Snowflake className="w-3.5 h-3.5 text-sky-400" />}
                          {l.temperature}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {l.nextFollowUpDate ? new Date(l.nextFollowUpDate).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-3 px-4 text-neutral-400">{l.ownerName || "Unassigned"}</td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="sm" className="h-6 text-[11px] text-indigo-400">
                          Inspect ›
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <LeadDialog
        open={leadDialogOpen}
        onOpenChange={setLeadDialogOpen}
        teamId={teamId}
        defaultStageId={dialogStageId}
      />

      <LeadDetailsSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        lead={selectedLead}
        teamId={teamId}
        stages={stages}
      />
    </div>
  );
}
