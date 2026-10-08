"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useCreateStandup, useStandupEntries } from "@/lib/hooks/use-calendar";
import { useProjects } from "@/lib/hooks/use-projects";
import { toast } from "sonner";
import {
  Zap,
  AlertTriangle,
  CheckCircle2,
  ListTodo,
  Users,
  Clock,
} from "lucide-react";

interface StandupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
}

export function StandupDialog({
  open,
  onOpenChange,
  teamId,
}: StandupDialogProps) {
  const createStandupMutation = useCreateStandup(teamId);
  const { data: entries = [], isLoading: entriesLoading } = useStandupEntries(teamId);
  const { data: projects = [] } = useProjects(teamId);

  const [activeTab, setActiveTab] = useState<"checkin" | "feed">("checkin");
  const [yesterday, setYesterday] = useState("");
  const [today, setToday] = useState("");
  const [blockers, setBlockers] = useState("");
  const [projectId, setProjectId] = useState<string>("none");
  const [autoCreateBlocker, setAutoCreateBlocker] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yesterday.trim() || !today.trim()) {
      toast.error("Please fill in yesterday's accomplishments and today's goals");
      return;
    }

    try {
      const res = await createStandupMutation.mutateAsync({
        yesterday: yesterday.trim(),
        today: today.trim(),
        blockers: blockers.trim() || undefined,
        autoCreateBlockerIssue: autoCreateBlocker,
        projectId: projectId === "none" ? undefined : projectId,
      });

      if (res?.createdBlockerIssue) {
        toast.success("Stand-up logged & urgent blocker task auto-created on board!");
      } else {
        toast.success("Stand-up check-in logged successfully!");
      }

      setYesterday("");
      setToday("");
      setBlockers("");
      setActiveTab("feed");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit stand-up");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-[#141518] border-neutral-800 text-neutral-100 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2 border-b border-neutral-800">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Developer Daily Stand-up (CAL-06)
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="pt-2">
          <TabsList className="bg-neutral-900 border border-neutral-800 text-neutral-400">
            <TabsTrigger value="checkin" className="data-[state=active]:bg-neutral-800 data-[state=active]:text-neutral-100 text-xs">
              Log My Stand-up
            </TabsTrigger>
            <TabsTrigger value="feed" className="data-[state=active]:bg-neutral-800 data-[state=active]:text-neutral-100 text-xs">
              Today's Team Updates ({entries.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: LOG CHECKIN */}
          <TabsContent value="checkin" className="space-y-4 pt-3">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-xs text-neutral-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  1. What did you accomplish yesterday? *
                </Label>
                <Textarea
                  value={yesterday}
                  onChange={(e) => setYesterday(e.target.value)}
                  placeholder="Completed user authentication tests, merged PR #12..."
                  rows={2}
                  className="mt-1 bg-neutral-900 border-neutral-800 text-neutral-100 text-xs"
                  required
                />
              </div>

              <div>
                <Label className="text-xs text-neutral-400 flex items-center gap-1.5">
                  <ListTodo className="w-3.5 h-3.5 text-blue-400" />
                  2. What are you working on today? *
                </Label>
                <Textarea
                  value={today}
                  onChange={(e) => setToday(e.target.value)}
                  placeholder="Connecting Google Calendar sync, building meeting notes UI..."
                  rows={2}
                  className="mt-1 bg-neutral-900 border-neutral-800 text-neutral-100 text-xs"
                  required
                />
              </div>

              <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-900/30 space-y-2">
                <Label className="text-xs text-amber-300 font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  3. Any blockers or dependencies?
                </Label>
                <Textarea
                  value={blockers}
                  onChange={(e) => setBlockers(e.target.value)}
                  placeholder="Waiting for client API keys, blocked on design approval..."
                  rows={2}
                  className="bg-neutral-950 border-neutral-800 text-neutral-100 text-xs placeholder:text-neutral-500"
                />

                <div className="flex items-center justify-between pt-1">
                  <label className="text-[11px] text-neutral-400 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoCreateBlocker}
                      onChange={(e) => setAutoCreateBlocker(e.target.checked)}
                      className="rounded border-neutral-700 bg-neutral-900 text-amber-500 focus:ring-0"
                    />
                    Auto-create flagged urgent issue for blockers (CAL-06)
                  </label>

                  <div className="w-48">
                    <Select value={projectId} onValueChange={setProjectId}>
                      <SelectTrigger className="h-7 text-[11px] bg-neutral-900 border-neutral-800 text-neutral-200">
                        <SelectValue placeholder="Project (optional)" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#18191c] border-neutral-800 text-neutral-200">
                        <SelectItem value="none">General / No Project</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="border-neutral-800 text-neutral-400"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createStandupMutation.isPending}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-medium"
                >
                  {createStandupMutation.isPending ? "Submitting..." : "Submit Stand-up"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* TAB 2: TEAM FEED */}
          <TabsContent value="feed" className="space-y-3 pt-3 max-h-[60vh] overflow-y-auto">
            {entries.length === 0 ? (
              <div className="p-8 text-center text-neutral-500 text-xs">
                No stand-up entries submitted today yet. Be the first to check in!
              </div>
            ) : (
              entries.map((entry: any) => (
                <div
                  key={entry.id}
                  className="p-3 rounded-lg bg-neutral-900/60 border border-neutral-800 text-xs space-y-2"
                >
                  <div className="flex items-center justify-between pb-1 border-b border-neutral-800/60">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-[10px]">
                        {entry.userName.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-neutral-200">{entry.userName}</span>
                    </div>
                    <span className="text-[11px] text-neutral-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(entry.createdAt).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-neutral-500 block">Yesterday:</span>
                    <p className="text-neutral-300 whitespace-pre-wrap">{entry.yesterday}</p>
                  </div>

                  <div>
                    <span className="text-[11px] text-neutral-500 block">Today:</span>
                    <p className="text-neutral-300 whitespace-pre-wrap">{entry.today}</p>
                  </div>

                  {entry.blockers && (
                    <div className="p-2 rounded bg-amber-950/20 border border-amber-900/40 text-amber-300">
                      <span className="text-[11px] font-semibold flex items-center gap-1 mb-0.5">
                        <AlertTriangle className="w-3 h-3" />
                        Blocker:
                      </span>
                      <p className="whitespace-pre-wrap text-[11px]">{entry.blockers}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
