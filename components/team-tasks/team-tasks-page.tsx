"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useActiveTeam } from "@/lib/context/team-context";
import { authClient } from "@/lib/auth-client";
import {
  useIssues,
  useCreateIssue,
  useUpdateIssue,
  useDeleteIssue,
} from "@/lib/hooks/use-issues";
import {
  useWorkflowStates,
  useLabels,
  useTeamMembers,
} from "@/lib/hooks/use-team-data";
import { useProjects } from "@/lib/hooks/use-projects";
import {
  IssueWithRelations,
  ISSUE_ACTION,
  PriorityLevel,
  ViewType,
} from "@/lib/types";
import { IssueDialog } from "@/components/issues/issue-dialog";
import { PriorityIcon } from "@/components/shared/priority-icon";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { DashboardLoader } from "@/components/ui/dashboard-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CheckCircle2,
  Circle,
  Check,
  Plus,
  Search,
  Filter,
  ListTodo,
  Clock,
  Flame,
  LayoutList,
  Table as TableIcon,
  Folder,
  Calendar,
  Trash2,
  Edit,
  Loader2,
  Users,
  User,
  Layers,
  ArrowRight,
  X,
  UserCheck,
  ShieldAlert,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function TeamTasksPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { teamId, team, loading: teamLoading } = useActiveTeam();
  const { data: session } = authClient.useSession();
  const currentUser = session?.user;

  // Selected project from URL query param (?project=...)
  const activeProjectId = searchParams.get("project") || "";

  // Filters & UI state
  const [activeTab, setActiveTab] = useState<"all" | "active" | "completed">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [currentView, setCurrentView] = useState<ViewType>("list");

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<IssueWithRelations | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch all user teams (for team sub-pages/switcher)
  const { data: userTeams = [] } = useQuery({
    queryKey: ["user-teams"],
    queryFn: async () => {
      const res = await fetch("/api/teams");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  // Queries for the active team
  const {
    data: allTeamIssues = [],
    isLoading: issuesLoading,
  } = useIssues(teamId);

  const { data: workflowStates = [] } = useWorkflowStates(teamId);
  const { data: projects = [], isLoading: projectsLoading } = useProjects(teamId);
  const { data: labels = [] } = useLabels(teamId);
  const { data: teamMembers = [] } = useTeamMembers(teamId);

  // Mutations
  const createIssue = useCreateIssue(teamId);
  const updateIssue = useUpdateIssue(teamId);
  const deleteIssue = useDeleteIssue(teamId);

  // Find currently active project details if any
  const currentProject = useMemo(() => {
    if (!activeProjectId) return null;
    return projects.find((p) => p.id === activeProjectId) || null;
  }, [projects, activeProjectId]);

  // Navigate to project sub-page / filter
  const handleSelectProject = (projectId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (projectId) {
      params.set("project", projectId);
    } else {
      params.delete("project");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  // Count issues per project for sub-navigation badges
  const projectIssueCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allTeamIssues.forEach((issue) => {
      if (issue.projectId) {
        counts[issue.projectId] = (counts[issue.projectId] || 0) + 1;
      }
    });
    return counts;
  }, [allTeamIssues]);

  // Filtered issues based on project, status tab, priority, assignee, search
  const filteredTasks = useMemo(() => {
    return allTeamIssues.filter((task) => {
      // 1. Project filter
      if (activeProjectId && task.projectId !== activeProjectId) {
        return false;
      }

      // 2. Status tab
      const isCompleted = task.workflowState?.type === "completed";
      const isCanceled = task.workflowState?.type === "canceled";
      if (activeTab === "active" && (isCompleted || isCanceled)) {
        return false;
      }
      if (activeTab === "completed" && !isCompleted) {
        return false;
      }

      // 3. Priority filter
      if (
        selectedPriorities.length > 0 &&
        !selectedPriorities.includes(task.priority || "none")
      ) {
        return false;
      }

      // 4. Assignee filter
      if (selectedAssignees.length > 0) {
        const matchesAssignee = selectedAssignees.some((id) => {
          if (id === "unassigned") return !task.assigneeId;
          return task.assigneeId === id;
        });
        if (!matchesAssignee) return false;
      }

      // 5. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = task.description?.toLowerCase().includes(q);
        const matchesNumber = String(task.number).includes(q);
        const matchesAssigneeName = task.assignee?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesNumber && !matchesAssigneeName) {
          return false;
        }
      }

      return true;
    });
  }, [
    allTeamIssues,
    activeProjectId,
    activeTab,
    selectedPriorities,
    selectedAssignees,
    searchQuery,
  ]);

  // Metrics calculation (scoped to current project if one is active)
  const scopedIssues = useMemo(() => {
    if (!activeProjectId) return allTeamIssues;
    return allTeamIssues.filter((t) => t.projectId === activeProjectId);
  }, [allTeamIssues, activeProjectId]);

  const stats = useMemo(() => {
    const total = scopedIssues.length;
    const completed = scopedIssues.filter(
      (t) => t.workflowState?.type === "completed"
    ).length;
    const active = scopedIssues.filter(
      (t) =>
        t.workflowState?.type !== "completed" &&
        t.workflowState?.type !== "canceled"
    ).length;
    const urgent = scopedIssues.filter((t) => t.priority === "urgent").length;

    return { total, active, completed, urgent };
  }, [scopedIssues]);

  // Toggle completion
  const handleToggleTask = async (task: IssueWithRelations) => {
    if (togglingId) return;
    setTogglingId(task.id);

    const isDone = task.workflowState?.type === "completed";
    const completedState = workflowStates.find((ws: any) => ws.type === "completed");
    const unstartedState =
      workflowStates.find(
        (ws: any) => ws.type === "unstarted" || ws.type === "started"
      ) || workflowStates[0];

    const targetState = isDone ? unstartedState : completedState;
    if (!targetState) {
      toast.error("Workflow state not found");
      setTogglingId(null);
      return;
    }

    try {
      await updateIssue.mutateAsync({
        issueId: task.id,
        data: {
          workflowStateId: targetState.id,
          completedAt: isDone ? null : new Date().toISOString(),
        },
      });

      if (!isDone) {
        toast.success(`Completed "${task.title}"`);
      } else {
        toast.info(`Reopened "${task.title}"`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update task status");
    } finally {
      setTogglingId(null);
    }
  };

  // Create task
  const handleCreateTask = async (data: any) => {
    try {
      await createIssue.mutateAsync({
        ...data,
        teamId,
        projectId: data.projectId || activeProjectId || undefined,
      });
      toast.success("Team task created successfully!");
      setCreateDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to create task");
    }
  };

  // Update task
  const handleUpdateTask = async (data: any) => {
    if (!selectedTask) return;
    try {
      await updateIssue.mutateAsync({
        issueId: selectedTask.id,
        data,
      });
      toast.success("Task updated successfully!");
      setEditDialogOpen(false);
      setSelectedTask(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to update task");
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId: string) => {
    if (deletingId) return;
    setDeletingId(taskId);
    try {
      await deleteIssue.mutateAsync(taskId);
      toast.success("Task deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete task");
    } finally {
      setDeletingId(null);
    }
  };

  if (teamLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <DashboardLoader
          message="Loading Team Workspace"
          submessage="Preparing team tasks and projects..."
        />
      </div>
    );
  }

  // If user has not been added to any teams
  if (!teamId || !team) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4">
        <Card className="bg-[#121316] border-white/[0.08] p-10 text-center relative overflow-hidden">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center mb-4 border border-amber-500/20">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            You have not been added to teams
          </h2>
          <p className="text-sm text-neutral-400 max-w-md mx-auto mb-6">
            Team tasks are collaborative workspaces. You need to join an existing
            team or be invited by an administrator before viewing team tasks and projects.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button
              onClick={() => router.push("/dashboard")}
              variant="outline"
              size="sm"
              className="bg-[#17181c] border-white/[0.08] text-neutral-300 hover:text-white"
            >
              Return to Home
            </Button>
            <Button
              onClick={() => router.push("/dashboard/members")}
              size="sm"
              className="bg-primary text-primary-foreground font-medium"
            >
              Manage Members & Invites
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Team Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
              <ListTodo className="w-4 h-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>Team Tasks</span>
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
              {team.name || "Team Workspace"}
            </span>
            {team.key && (
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-neutral-400 border border-white/[0.08]">
                {team.key}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1.5">
            Collaborative tasks and issue tracking across all team projects.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={() => setCreateDialogOpen(true)}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>New Team Task</span>
          </Button>
        </div>
      </div>

      {/* Projects Sub-Navigation Bar */}
      <div className="bg-[#121316] border border-white/[0.08] rounded-xl p-2.5">
        <div className="flex items-center justify-between gap-2 mb-2 px-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            <Folder className="w-3.5 h-3.5 text-indigo-400" />
            <span>Team Projects</span>
            <span className="text-neutral-500 text-[10px]">({projects.length})</span>
          </div>
          {activeProjectId && (
            <button
              onClick={() => handleSelectProject("")}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition-colors"
            >
              <span>View All Projects</span>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 pt-0.5">
          {/* All Projects Pill */}
          <button
            onClick={() => handleSelectProject("")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 border",
              !activeProjectId
                ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30 shadow-xs"
                : "bg-[#17181c] text-neutral-400 border-white/[0.06] hover:text-white hover:bg-white/[0.04]"
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Projects</span>
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full",
                !activeProjectId
                  ? "bg-indigo-500/30 text-indigo-200"
                  : "bg-white/[0.06] text-neutral-400"
              )}
            >
              {allTeamIssues.length}
            </span>
          </button>

          {/* Each Team Project Pill */}
          {projects.map((project) => {
            const isSelected = activeProjectId === project.id;
            const taskCount = projectIssueCounts[project.id] || 0;

            return (
              <button
                key={project.id}
                onClick={() => handleSelectProject(project.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 border",
                  isSelected
                    ? "bg-indigo-500/15 text-indigo-200 border-indigo-500/30 shadow-xs"
                    : "bg-[#17181c] text-neutral-400 border-white/[0.06] hover:text-white hover:bg-white/[0.04]"
                )}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: project.color || "#6366f1" }}
                />
                <span className="truncate max-w-[140px]">{project.name}</span>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                    isSelected
                      ? "bg-indigo-500/30 text-indigo-200"
                      : "bg-white/[0.06] text-neutral-400"
                  )}
                >
                  {taskCount}
                </span>
              </button>
            );
          })}

          {projects.length === 0 && !projectsLoading && (
            <span className="text-xs text-neutral-500 italic py-1 px-2">
              No projects created for this team yet.
            </span>
          )}
        </div>
      </div>

      {/* Active Project Banner (if viewing a specific project sub-view) */}
      {currentProject && (
        <div className="bg-[#14151a] border border-indigo-500/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-white font-bold text-sm shadow-xs"
              style={{ backgroundColor: currentProject.color || "#6366f1" }}
            >
              {currentProject.key || currentProject.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">
                  {currentProject.name}
                </h2>
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-white/[0.08] text-neutral-300">
                  {currentProject.key}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full capitalize bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {currentProject.status || "active"}
                </span>
              </div>
              {currentProject.description && (
                <p className="text-xs text-neutral-400 mt-1 max-w-xl">
                  {currentProject.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSelectProject("")}
              className="h-8 text-xs bg-[#17181c] border-white/[0.08] text-neutral-300 hover:text-white"
            >
              All Projects
            </Button>
            <Button
              size="sm"
              onClick={() => setCreateDialogOpen(true)}
              className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add to {currentProject.key || currentProject.name}
            </Button>
          </div>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-[#121316] border-white/[0.08] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">Total Tasks</span>
            <ListTodo className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{stats.total}</div>
          <div className="text-[11px] text-neutral-500 mt-1">
            {currentProject ? `In ${currentProject.name}` : "Across all projects"}
          </div>
        </Card>

        <Card className="bg-[#121316] border-white/[0.08] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">Active & In Progress</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400 mt-2">{stats.active}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Pending resolution</div>
        </Card>

        <Card className="bg-[#121316] border-white/[0.08] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">Urgent Priority</span>
            <Flame className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 mt-2">{stats.urgent}</div>
          <div className="text-[11px] text-neutral-500 mt-1">High-priority blockers</div>
        </Card>

        <Card className="bg-[#121316] border-white/[0.08] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">{stats.completed}</div>
          <div className="text-[11px] text-neutral-500 mt-1">Closed items</div>
        </Card>
      </div>

      {/* Filter and View Controls Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Left: Tab Pills & Search */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-[#17181c] rounded-lg p-0.5 border border-white/[0.08] text-xs">
            <button
              onClick={() => setActiveTab("active")}
              className={cn(
                "px-3 py-1.5 rounded-md transition-colors font-medium",
                activeTab === "active"
                  ? "bg-[#25272e] text-white shadow-xs"
                  : "text-neutral-400 hover:text-white"
              )}
            >
              Active
            </button>
            <button
              onClick={() => setActiveTab("completed")}
              className={cn(
                "px-3 py-1.5 rounded-md transition-colors font-medium",
                activeTab === "completed"
                  ? "bg-[#25272e] text-white shadow-xs"
                  : "text-neutral-400 hover:text-white"
              )}
            >
              Completed
            </button>
            <button
              onClick={() => setActiveTab("all")}
              className={cn(
                "px-3 py-1.5 rounded-md transition-colors font-medium",
                activeTab === "all"
                  ? "bg-[#25272e] text-white shadow-xs"
                  : "text-neutral-400 hover:text-white"
              )}
            >
              All Tasks
            </button>
          </div>

          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search team tasks, assignees..."
              className="h-8 pl-8 text-xs bg-[#17181c] border-white/[0.08]"
            />
          </div>
        </div>

        {/* Right: Dropdowns & View Switcher */}
        <div className="flex items-center gap-2 justify-end flex-wrap">
          {/* Priority Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs bg-[#17181c] border-white/[0.08]"
              >
                <Filter className="w-3.5 h-3.5 mr-1.5 text-neutral-400" />
                <span>Priority</span>
                {selectedPriorities.length > 0 && (
                  <span className="ml-1 px-1 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px]">
                    {selectedPriorities.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs">Filter by Priority</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {["urgent", "high", "medium", "low", "none"].map((p) => (
                <DropdownMenuCheckboxItem
                  key={p}
                  checked={selectedPriorities.includes(p)}
                  onCheckedChange={(checked) => {
                    setSelectedPriorities((prev) =>
                      checked ? [...prev, p] : prev.filter((x) => x !== p)
                    );
                  }}
                  className="capitalize text-xs"
                >
                  {p}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Assignee Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs bg-[#17181c] border-white/[0.08]"
              >
                <Users className="w-3.5 h-3.5 mr-1.5 text-neutral-400" />
                <span>Assignee</span>
                {selectedAssignees.length > 0 && (
                  <span className="ml-1 px-1 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px]">
                    {selectedAssignees.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs">Filter by Assignee</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={selectedAssignees.includes("unassigned")}
                onCheckedChange={(checked) => {
                  setSelectedAssignees((prev) =>
                    checked
                      ? [...prev, "unassigned"]
                      : prev.filter((x) => x !== "unassigned")
                  );
                }}
                className="text-xs"
              >
                <span className="text-neutral-400 italic">Unassigned</span>
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {teamMembers.map((member: any) => {
                const memberId = member.userId || member.id;
                const name = member.displayName || member.userName || member.email || "Member";
                return (
                  <DropdownMenuCheckboxItem
                    key={member.id}
                    checked={selectedAssignees.includes(memberId)}
                    onCheckedChange={(checked) => {
                      setSelectedAssignees((prev) =>
                        checked
                          ? [...prev, memberId]
                          : prev.filter((x) => x !== memberId)
                      );
                    }}
                    className="text-xs"
                  >
                    <span className="truncate">{name}</span>
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Reset Filters if any active */}
          {(selectedPriorities.length > 0 ||
            selectedAssignees.length > 0 ||
            searchQuery.trim() !== "") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedPriorities([]);
                setSelectedAssignees([]);
                setSearchQuery("");
              }}
              className="h-8 text-xs text-neutral-400 hover:text-white"
            >
              Reset
            </Button>
          )}

          {/* View Toggles */}
          <div className="flex items-center bg-[#17181c] rounded-lg p-0.5 border border-white/[0.08]">
            <button
              onClick={() => setCurrentView("list")}
              className={cn(
                "p-1.5 rounded transition-colors",
                currentView === "list"
                  ? "bg-[#25272e] text-white"
                  : "text-neutral-400 hover:text-white"
              )}
              title="List view"
            >
              <LayoutList className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentView("table")}
              className={cn(
                "p-1.5 rounded transition-colors",
                currentView === "table"
                  ? "bg-[#25272e] text-white"
                  : "text-neutral-400 hover:text-white"
              )}
              title="Table view"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Task List / View */}
      {issuesLoading ? (
        <div className="flex items-center justify-center py-20 text-neutral-400 text-sm gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
          <span>Fetching team tasks...</span>
        </div>
      ) : filteredTasks.length === 0 ? (
        /* Empty State */
        <Card className="bg-[#121316] border-white/[0.08] p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 mx-auto flex items-center justify-center mb-3">
            <ListTodo className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">No tasks found</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1 mb-4">
            {searchQuery ||
            selectedPriorities.length > 0 ||
            selectedAssignees.length > 0 ||
            activeProjectId
              ? "No team tasks match your current filter criteria."
              : activeTab === "completed"
              ? "The team hasn't completed any tasks yet."
              : "No active tasks in this project. Create one to get started!"}
          </p>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            <span>Create a Task</span>
          </Button>
        </Card>
      ) : currentView === "table" ? (
        /* Table View */
        <div className="bg-[#121316] border border-white/[0.08] rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#17181c] text-neutral-400 border-b border-white/[0.06] select-none">
              <tr>
                <th className="py-2.5 px-4 w-10">Done</th>
                <th className="py-2.5 px-4">Task</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Priority</th>
                <th className="py-2.5 px-4">Project</th>
                <th className="py-2.5 px-4">Assignee</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredTasks.map((task) => {
                const isDone = task.workflowState?.type === "completed";
                const isToggling = togglingId === task.id;

                return (
                  <tr
                    key={task.id}
                    onClick={() => {
                      setSelectedTask(task);
                      setEditDialogOpen(true);
                    }}
                    className="hover:bg-white/[0.02] cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleToggleTask(task)}
                        disabled={isToggling}
                        className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${
                          isDone
                            ? "bg-emerald-500 text-black border border-emerald-500"
                            : "border border-neutral-600 hover:border-emerald-400 hover:bg-emerald-500/10"
                        }`}
                      >
                        {isToggling ? (
                          <Loader2 className="w-2.5 h-2.5 animate-spin text-neutral-400" />
                        ) : isDone ? (
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        ) : null}
                      </button>
                    </td>

                    <td className="py-3 px-4 font-medium max-w-md">
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-500 text-[11px] font-mono shrink-0">
                          {team.key ? `${team.key}-${task.number || task.id.slice(-4)}` : `#${task.number || task.id.slice(-4)}`}
                        </span>
                        <span className={cn("truncate", isDone ? "line-through text-neutral-500" : "text-white")}>
                          {task.title}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {task.workflowState && (
                        <StatusBadge status={task.workflowState} />
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <PriorityIcon
                        priority={(task.priority || "none") as PriorityLevel}
                        showLabel
                      />
                    </td>

                    <td className="py-3 px-4">
                      {task.project ? (
                        <div className="flex items-center gap-1.5 text-neutral-300">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: task.project.color }}
                          />
                          <span className="truncate max-w-[120px]">{task.project.name}</span>
                        </div>
                      ) : (
                        <span className="text-neutral-500">General</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {task.assignee ? (
                        <div className="flex items-center gap-1.5 text-neutral-300">
                          <UserAvatar name={task.assignee} size="sm" />
                          <span className="truncate max-w-[100px]">{task.assignee}</span>
                        </div>
                      ) : (
                        <span className="text-neutral-500 italic">Unassigned</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedTask(task);
                            setEditDialogOpen(true);
                          }}
                          className="h-7 px-2 text-xs text-neutral-400 hover:text-white"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTask(task.id)}
                          disabled={deletingId === task.id}
                          className="h-7 px-2 text-xs text-neutral-400 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* List View */
        <div className="bg-[#121316] border border-white/[0.08] rounded-xl divide-y divide-white/[0.04] overflow-hidden">
          {filteredTasks.map((task) => {
            const isDone = task.workflowState?.type === "completed";
            const isToggling = togglingId === task.id;

            return (
              <div
                key={task.id}
                onClick={() => {
                  setSelectedTask(task);
                  setEditDialogOpen(true);
                }}
                className="flex items-center justify-between p-4 hover:bg-white/[0.02] cursor-pointer transition-colors group gap-4"
              >
                {/* Left: Check circle + Key + Title */}
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleTask(task);
                    }}
                    disabled={isToggling}
                    className={`w-4 h-4 rounded-full flex items-center justify-center transition-all shrink-0 ${
                      isDone
                        ? "bg-emerald-500 text-black border border-emerald-500"
                        : "border border-neutral-600 hover:border-emerald-400 hover:bg-emerald-500/10"
                    }`}
                  >
                    {isToggling ? (
                      <Loader2 className="w-2.5 h-2.5 animate-spin text-neutral-400" />
                    ) : isDone ? (
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    ) : (
                      <Check className="w-2 h-2 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </button>

                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-neutral-500 text-xs font-mono shrink-0">
                      {team.key ? `${team.key}-${task.number || task.id.slice(-4)}` : `#${task.number || task.id.slice(-4)}`}
                    </span>
                    <span
                      className={cn(
                        "text-sm tracking-tight truncate",
                        isDone ? "line-through text-neutral-500" : "text-neutral-200 group-hover:text-white font-medium"
                      )}
                    >
                      {task.title}
                    </span>
                  </div>
                </div>

                {/* Right: Status, Priority, Project, Assignee, Actions */}
                <div className="flex items-center gap-3 shrink-0 text-xs">
                  {/* Status Badge */}
                  {task.workflowState && (
                    <StatusBadge status={task.workflowState} />
                  )}

                  {/* Priority Icon */}
                  <PriorityIcon
                    priority={(task.priority || "none") as PriorityLevel}
                    showLabel
                  />

                  {/* Project Pill */}
                  {task.project ? (
                    <div className="hidden sm:flex items-center gap-1.5 text-neutral-400">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: task.project.color }}
                      />
                      <span className="truncate max-w-[110px]">{task.project.name}</span>
                    </div>
                  ) : null}

                  {/* Assignee Avatar */}
                  {task.assignee ? (
                    <div className="hidden md:flex items-center gap-1.5 text-neutral-300" title={`Assigned to ${task.assignee}`}>
                      <UserAvatar name={task.assignee} size="sm" />
                      <span className="truncate max-w-[80px] text-[11px]">{task.assignee}</span>
                    </div>
                  ) : (
                    <div className="hidden md:flex items-center gap-1 text-neutral-500 text-[11px]">
                      <User className="w-3 h-3" />
                      <span>Unassigned</span>
                    </div>
                  )}

                  {/* Quick Edit & Delete */}
                  <div
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedTask(task);
                        setEditDialogOpen(true);
                      }}
                      className="h-7 w-7 p-0 text-neutral-400 hover:text-white"
                      title="Edit task"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTask(task.id)}
                      disabled={deletingId === task.id}
                      className="h-7 w-7 p-0 text-neutral-400 hover:text-rose-400"
                      title="Delete task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Task Dialog */}
      <IssueDialog
        action={ISSUE_ACTION.CREATE}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateTask}
        projects={projects}
        workflowStates={workflowStates}
        labels={labels}
        teamId={teamId}
        initialData={{
          projectId: activeProjectId || undefined,
          assigneeId: currentUser?.id || "",
        }}
        title="Create Team Task"
        description={
          currentProject
            ? `Create a collaborative task for project "${currentProject.name}".`
            : "Create a collaborative task for your team workspace."
        }
      />

      {/* Edit Task Dialog */}
      {selectedTask && (
        <IssueDialog
          action={ISSUE_ACTION.EDIT}
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setSelectedTask(null);
          }}
          onSubmit={handleUpdateTask}
          projects={projects}
          workflowStates={workflowStates}
          labels={labels}
          teamId={teamId}
          initialData={{
            title: selectedTask.title,
            description: selectedTask.description ?? undefined,
            projectId: selectedTask.project?.id,
            workflowStateId: selectedTask.workflowStateId,
            assigneeId: selectedTask.assigneeId || "",
            priority: selectedTask.priority as any,
            estimate: (selectedTask as any).estimate,
            labelIds: selectedTask.labels?.map((l: any) => l.label?.id || l.labelId || l.id) || [],
          }}
          title="Team Task Details"
          description="Update task details, assignment, priority, or workflow status."
        />
      )}
    </div>
  );
}

export { TeamTasksPage };
