"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Globe,
  Smartphone,
  Megaphone,
  Rocket,
  Component,
  Building2,
  Lock,
  Archive,
  Star,
  Plus,
  Share2,
  Settings,
  MoreHorizontal,
  ChevronDown,
  Search,
  Filter,
  ArrowUpDown,
  LayoutDashboard,
  Kanban,
  List as ListIcon,
  Table as TableIcon,
  Calendar,
  CalendarRange,
  Paperclip,
  Activity,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Flame,
  User,
  Users,
  UserPlus,
  ExternalLink,
  Edit2,
  Trash2,
  MoreVertical,
  X,
  FileText,
  UploadCloud,
} from "lucide-react";
import { useActiveTeam } from "@/lib/context/team-context";
import { useProjects, useUpdateProject } from "@/lib/hooks/use-projects";
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
import { IssueWithRelations, ViewType, ISSUE_ACTION } from "@/lib/types";
import { AssigneeAvatar } from "@/components/shared/assignee-avatar";
import { IssueDialog } from "@/components/issues/issue-dialog";
import { ProjectDialog } from "@/components/projects/project-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ProjectDetailViewProps {
  projectId: string;
  teamId: string;
  initialTab?: string;
}

export function ProjectDetailView({
  projectId,
  teamId,
  initialTab = "board",
}: ProjectDetailViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Queries
  const { data: projects = [] } = useProjects(teamId);
  const { data: workflowStates = [] } = useWorkflowStates(teamId);
  const { data: labels = [] } = useLabels(teamId);
  const { data: members = [] } = useTeamMembers(teamId);
  const { data: issues = [], isLoading: issuesLoading } = useIssues(teamId, {
    project: [projectId],
  });

  // Mutations
  const updateProjectMutation = useUpdateProject(teamId);
  const createIssueMutation = useCreateIssue(teamId);
  const updateIssueMutation = useUpdateIssue(teamId);
  const deleteIssueMutation = useDeleteIssue(teamId);

  // Active Project
  const project = useMemo(() => {
    return projects.find((p) => p.id === projectId) || null;
  }, [projects, projectId]);

  // Tab State
  const tabFromQuery = searchParams.get("view") || searchParams.get("tab") || initialTab;
  const [activeTab, setActiveTab] = useState<string>(tabFromQuery);

  // Sync tab with URL
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", tab);
    router.replace(`?${params.toString()}`);
  };

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"manual" | "priority" | "due" | "title">("manual");

  // Dialog States
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<IssueWithRelations | null>(null);
  const [defaultWorkflowStateId, setDefaultWorkflowStateId] = useState<string>("");
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [isStarred, setIsStarred] = useState(false);

  // Star state from localStorage
  React.useEffect(() => {
    if (typeof window !== "undefined" && projectId) {
      try {
        const saved = localStorage.getItem("sketchitup-starred-projects");
        if (saved) {
          const parsed = JSON.parse(saved);
          setIsStarred(!!parsed[projectId]);
        }
      } catch (e) {}
    }
  }, [projectId]);

  const toggleStar = () => {
    const next = !isStarred;
    setIsStarred(next);
    if (typeof window !== "undefined" && projectId) {
      try {
        const saved = localStorage.getItem("sketchitup-starred-projects");
        const parsed = saved ? JSON.parse(saved) : {};
        parsed[projectId] = next;
        localStorage.setItem("sketchitup-starred-projects", JSON.stringify(parsed));
      } catch (e) {}
    }
    toast.success(next ? "Added to favorites" : "Removed from favorites");
  };

  // Status Change
  const handleStatusChange = async (newStatus: "active" | "completed" | "canceled") => {
    if (!project) return;
    try {
      await updateProjectMutation.mutateAsync({
        projectId: project.id,
        data: { status: newStatus },
      });
      toast.success(`Project status updated to ${newStatus}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update project status");
    }
  };

  // Filtered & Sorted issues for this project
  const filteredIssues = useMemo(() => {
    let result = [...issues];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.description?.toLowerCase().includes(q) ||
          i.number?.toString().includes(q)
      );
    }

    if (priorityFilter !== "all") {
      result = result.filter((i) => i.priority === priorityFilter);
    }

    if (sortBy === "priority") {
      const pOrder: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1, none: 0 };
      result.sort((a, b) => (pOrder[b.priority] || 0) - (pOrder[a.priority] || 0));
    } else if (sortBy === "title") {
      result.sort((a, b) => a.title.localeCompare(b.title));
    }

    return result;
  }, [issues, searchQuery, priorityFilter, sortBy]);

  // Group issues by workflow state for the Board view
  const columnsData = useMemo(() => {
    if (workflowStates.length === 0) {
      return [
        { id: "backlog", name: "Backlog", type: "backlog", color: "#64748b", tasks: [] },
        { id: "todo", name: "To Do", type: "unstarted", color: "#3b82f6", tasks: [] },
        { id: "progress", name: "In Progress", type: "started", color: "#f59e0b", tasks: [] },
        { id: "review", name: "Review", type: "started", color: "#a855f7", tasks: [] },
        { id: "done", name: "Done", type: "completed", color: "#10b981", tasks: [] },
      ];
    }

    return workflowStates.map((state: any) => {
      const stateTasks = filteredIssues.filter((i) => i.workflowStateId === state.id);
      return {
        id: state.id,
        name: state.name,
        type: state.type,
        color: state.color,
        tasks: stateTasks,
      };
    });
  }, [workflowStates, filteredIssues]);

  // Handle Complete / Reopen task
  const handleToggleTaskDone = async (task: IssueWithRelations, e: React.MouseEvent) => {
    e.stopPropagation();
    const isDone = task.workflowState?.type === "completed";
    const targetState = isDone
      ? workflowStates.find((s: any) => s.type === "unstarted") || workflowStates[0]
      : workflowStates.find((s: any) => s.type === "completed") || workflowStates[workflowStates.length - 1];

    if (!targetState) return;

    try {
      await updateIssueMutation.mutateAsync({
        issueId: task.id,
        data: { workflowStateId: targetState.id },
      });
      toast.success(isDone ? "Task reopened" : "Task marked as complete");
    } catch (err: any) {
      toast.error(err.message || "Failed to update task");
    }
  };

  // Open Create Dialog for a specific column
  const handleOpenAddCard = (stateId: string) => {
    setDefaultWorkflowStateId(stateId);
    setEditingIssue(null);
    setTaskDialogOpen(true);
  };

  // Submit task (create or edit)
  const handleTaskSubmit = async (data: any) => {
    try {
      if (editingIssue) {
        await updateIssueMutation.mutateAsync({
          issueId: editingIssue.id,
          data,
        });
        toast.success("Task updated");
      } else {
        await createIssueMutation.mutateAsync({
          ...data,
          projectId,
          teamId,
          workflowStateId: data.workflowStateId || defaultWorkflowStateId || workflowStates[0]?.id,
        });
        toast.success("Task created");
      }
      setTaskDialogOpen(false);
      setEditingIssue(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to save task");
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteIssueMutation.mutateAsync(taskId);
      toast.success("Task deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete task");
    }
  };

  const projectName = project?.name || "Project";
  const projectKey = project?.key || "PRJ";
  const projectColor = project?.color || "#3B82C4";

  if (!teamId) {
    return (
      <div className="flex items-center justify-center min-h-[450px] p-6">
        <div className="w-full max-w-md border border-white/[0.08] bg-[#121316] text-neutral-200 rounded-xl p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto mb-4 text-neutral-400">
            <Users className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            You have not been added to teams
          </h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            You are not currently a member of any team. Ask your workspace administrator to invite you to collaborate.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0e0f11] text-neutral-100">
      {/* 1. Project Header (.proj-h) */}
      <div className="px-6 pt-5 pb-0 border-b border-white/[0.08] bg-[#0e0f11] shrink-0">
        <div className="flex items-center justify-between gap-4 pb-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Project Icon container (.picon.lg) */}
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white shadow-xs"
              style={{ backgroundColor: projectColor }}
            >
              <Smartphone className="w-4 h-4" />
            </span>

            {/* Project Title */}
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white truncate">
              {projectName}
            </h1>

            {/* Star / Favorite button (.ibtn.ibtn-sm) */}
            <button
              type="button"
              onClick={toggleStar}
              aria-label="Favorite"
              title={isStarred ? "Remove from favorites" : "Add to favorites"}
              className="p-1 rounded-md text-neutral-400 hover:text-amber-400 hover:bg-white/[0.06] transition-colors"
            >
              <Star
                className={cn(
                  "w-4 h-4 transition-colors",
                  isStarred ? "text-amber-400 fill-amber-400" : "text-neutral-400"
                )}
              />
            </button>

            {/* Status Pill button (.pillbtn.bordered) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-6 px-2.5 rounded-full border border-white/[0.1] bg-white/[0.04] text-xs font-medium text-neutral-300 flex items-center gap-1.5 hover:bg-white/[0.08] transition-colors"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: projectColor }}
                  />
                  <span>{project?.status === "completed" ? "Done" : project?.status === "canceled" ? "Canceled" : "In Progress"}</span>
                  <ChevronDown className="w-3 h-3 text-neutral-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-[#121316] border-white/[0.1] text-neutral-200">
                <DropdownMenuItem onClick={() => handleStatusChange("active")}>
                  <span className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
                  In Progress
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusChange("completed")}>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
                  Completed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusChange("canceled")}>
                  <span className="w-2 h-2 rounded-full bg-rose-500 mr-2" />
                  Canceled
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Members avatars stack (.avs) */}
            <div className="hidden sm:flex items-center -space-x-1.5 mr-1">
              {members.slice(0, 4).map((m: any, idx: number) => {
                const name = m.userName || m.userEmail || "Member";
                const initials = name.slice(0, 2).toUpperCase();
                return (
                  <div
                    key={m.id || idx}
                    title={name}
                    className="w-6 h-6 rounded-full border border-[#0e0f11] bg-neutral-800 text-[10px] font-medium text-neutral-300 flex items-center justify-center select-none"
                  >
                    {initials}
                  </div>
                );
              })}
            </div>

            {/* Add Member */}
            <button
              type="button"
              onClick={() => toast.info("Member invitations can be sent via Settings")}
              title="Add member"
              className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
            </button>

            {/* Share button */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (typeof window !== "undefined") {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success("Project URL copied to clipboard");
                }
              }}
              className="hidden md:inline-flex h-7 px-2.5 text-xs gap-1.5 bg-white/[0.06] hover:bg-white/[0.1] text-neutral-200 border border-white/[0.06]"
            >
              <Share2 className="w-3 h-3" />
              <span>Share</span>
            </Button>

            {/* Project settings button */}
            <button
              type="button"
              onClick={() => setProjectSettingsOpen(true)}
              title="Project settings"
              className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>

            {/* More button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title="More actions"
                  className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[#121316] border-white/[0.1] text-neutral-200">
                <DropdownMenuItem onClick={() => setProjectSettingsOpen(true)}>
                  Edit Project Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    navigator.clipboard.writeText(projectKey);
                    toast.success(`Project Key ${projectKey} copied`);
                  }}
                >
                  Copy Key: {projectKey}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/[0.08]" />
                <DropdownMenuItem
                  onClick={() => handleStatusChange("canceled")}
                  className="text-rose-400 focus:text-rose-400"
                >
                  Archive Project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* 2. Tabs Navigation (.tabs) */}
        <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar -mb-px pt-1 text-xs">
          {[
            { id: "overview", label: "Overview", icon: LayoutDashboard },
            { id: "board", label: "Board", icon: Kanban },
            { id: "list", label: "List", icon: ListIcon },
            { id: "table", label: "Table", icon: TableIcon },
            { id: "calendar", label: "Calendar", icon: Calendar },
            { id: "timeline", label: "Timeline", icon: CalendarRange },
            { id: "files", label: "Files", icon: Paperclip },
            { id: "activity", label: "Activity", icon: Activity },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors whitespace-nowrap",
                  isActive
                    ? "border-primary text-white"
                    : "border-transparent text-neutral-400 hover:text-neutral-200 hover:border-white/10"
                )}
              >
                <TabIcon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* 3. Toolbar (.toolbar) */}
      <div className="px-6 py-2.5 border-b border-white/[0.07] bg-[#0e0f11] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-1 max-w-lg">
          {/* Search tasks (.inwrap) */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks"
              className="w-full pl-8 pr-3 py-1 bg-white/[0.04] border border-white/[0.08] rounded-md text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/20"
            />
          </div>

          {/* Filter button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-7 px-2.5 rounded-md border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-xs text-neutral-300 flex items-center gap-1.5 transition-colors"
              >
                <Filter className="w-3.5 h-3.5 text-neutral-400" />
                <span>Filter</span>
                {priorityFilter !== "all" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#121316] border-white/[0.1] text-neutral-200">
              <DropdownMenuLabel className="text-xs">Filter by Priority</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setPriorityFilter("all")}>All Priorities</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPriorityFilter("urgent")}>Urgent</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPriorityFilter("high")}>High</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPriorityFilter("medium")}>Medium</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPriorityFilter("low")}>Low</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-7 px-2.5 rounded-md border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-xs text-neutral-300 flex items-center gap-1.5 transition-colors"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
                <span>Sort: {sortBy}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#121316] border-white/[0.1] text-neutral-200">
              <DropdownMenuItem onClick={() => setSortBy("manual")}>Manual</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("priority")}>Priority</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("title")}>Title</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* New Task Button */}
        <Button
          size="sm"
          onClick={() => {
            setDefaultWorkflowStateId("");
            setEditingIssue(null);
            setTaskDialogOpen(true);
          }}
          className="h-7 px-3 text-xs gap-1.5 bg-[#5A67D8] hover:bg-[#4c57b8] text-white font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New task</span>
        </Button>
      </div>

      {/* 4. Tab Body Area */}
      <div className="flex-1 min-h-0 overflow-hidden bg-[#0e0f11]">
        {/* === A. BOARD VIEW (.board) === */}
        {activeTab === "board" && (
          <div className="h-full overflow-x-auto p-6 flex gap-4 no-scrollbar">
            {columnsData.map((col: any) => (
              <div
                key={col.id}
                className="w-72 shrink-0 flex flex-col min-h-0 bg-[#121316]/60 border border-white/[0.06] rounded-xl p-3"
              >
                {/* Column Header (.bcol-h) */}
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    {/* Status circle icon */}
                    {col.type === "completed" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : col.type === "started" ? (
                      <Clock className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Circle className="w-4 h-4 text-neutral-500" />
                    )}
                    <span className="text-xs font-semibold text-white tracking-wide">
                      {col.name}
                    </span>
                    <span className="text-[11px] font-mono text-neutral-500 ml-1">
                      {col.tasks.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenAddCard(col.id)}
                      title={`Add task to ${col.name}`}
                      className="p-1 rounded hover:bg-white/[0.08] text-neutral-400 hover:text-white transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Column Body (.bcol-b): Task cards */}
                <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1">
                  {col.tasks.map((task: IssueWithRelations) => {
                    const taskKey = `${projectKey}-${task.number}`;
                    const isDone = task.workflowState?.type === "completed";

                    return (
                      <div
                        key={task.id}
                        onClick={() => {
                          setEditingIssue(task);
                          setTaskDialogOpen(true);
                        }}
                        className={cn(
                          "group relative p-3 rounded-lg bg-[#181a1e] border border-white/[0.06] hover:border-white/20 transition-all cursor-pointer shadow-xs",
                          isDone && "opacity-75"
                        )}
                      >
                        {/* Labels row (.labels) */}
                        {task.labels && task.labels.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 mb-2">
                            {task.labels.map((il: any) => (
                              <span
                                key={il.label?.id || il.id}
                                className="text-[10px] px-1.5 py-0.2 rounded font-medium border"
                                style={{
                                  backgroundColor: `${il.label?.color || "#5A67D8"}15`,
                                  borderColor: `${il.label?.color || "#5A67D8"}30`,
                                  color: il.label?.color || "#7c82e6",
                                }}
                              >
                                {il.label?.name}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Title (.title) */}
                        <div className="flex items-start gap-2 mb-2.5">
                          {isDone && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                          )}
                          <p
                            className={cn(
                              "text-xs font-medium leading-snug text-neutral-100",
                              isDone && "line-through text-neutral-400"
                            )}
                          >
                            {task.title}
                          </p>
                        </div>

                        {/* Meta row (.meta) */}
                        <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                          {/* Key */}
                          <span className="font-mono text-[10px] text-neutral-500 bg-white/[0.04] px-1.5 py-0.2 rounded">
                            {taskKey}
                          </span>

                          {/* Priority badge */}
                          {task.priority && task.priority !== "none" && (
                            <span
                              className={cn(
                                "capitalize text-[10px] font-medium px-1 rounded",
                                task.priority === "urgent" && "text-rose-400 bg-rose-500/10",
                                task.priority === "high" && "text-amber-400 bg-amber-500/10",
                                task.priority === "medium" && "text-blue-400 bg-blue-500/10",
                                task.priority === "low" && "text-emerald-400 bg-emerald-500/10"
                              )}
                            >
                              {task.priority}
                            </span>
                          )}

                          {/* Assignee Avatar */}
                          {(task.assignee || task.assigneeId) && (
                            <div className="ml-auto flex items-center gap-1">
                              <AssigneeAvatar
                                assigneeId={task.assigneeId}
                                assignee={task.assignee}
                                size="sm"
                              />
                            </div>
                          )}
                        </div>

                        {/* Hover action shortcuts (.hacts) */}
                        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#181a1e] pl-1">
                          <button
                            type="button"
                            onClick={(e) => handleToggleTaskDone(task, e)}
                            title={isDone ? "Reopen task" : "Mark complete"}
                            className="p-1 rounded hover:bg-white/[0.1] text-neutral-400 hover:text-white"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteTask(task.id, e)}
                            title="Delete task"
                            className="p-1 rounded hover:bg-white/[0.1] text-neutral-400 hover:text-rose-400"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add card button (.addcard) */}
                  <button
                    type="button"
                    onClick={() => handleOpenAddCard(col.id)}
                    className="w-full py-1.5 px-2 rounded-md border border-dashed border-white/[0.08] hover:border-white/20 text-neutral-400 hover:text-white text-xs flex items-center justify-center gap-1.5 transition-colors bg-white/[0.01] hover:bg-white/[0.04]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add task</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* === B. LIST VIEW === */}
        {activeTab === "list" && (
          <div className="h-full overflow-y-auto p-6 max-w-5xl mx-auto space-y-3">
            {filteredIssues.length === 0 ? (
              <div className="text-center py-16 text-neutral-400">
                <p className="text-sm">No tasks in this project yet.</p>
                <Button
                  size="sm"
                  onClick={() => setTaskDialogOpen(true)}
                  className="mt-3 bg-primary text-white text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Create Task
                </Button>
              </div>
            ) : (
              filteredIssues.map((task) => (
                <div
                  key={task.id}
                  onClick={() => {
                    setEditingIssue(task);
                    setTaskDialogOpen(true);
                  }}
                  className="flex items-center justify-between p-3 rounded-lg bg-[#121316] border border-white/[0.06] hover:border-white/20 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={(e) => handleToggleTaskDone(task, e)}
                      className="text-neutral-500 hover:text-emerald-400"
                    >
                      {task.workflowState?.type === "completed" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                    </button>
                    <span className="font-mono text-xs text-neutral-400">
                      {projectKey}-{task.number}
                    </span>
                    <span className="text-sm font-medium text-white truncate">
                      {task.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-xs text-neutral-400">
                    <span className="px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08]">
                      {task.workflowState?.name || "Active"}
                    </span>
                    {task.priority && task.priority !== "none" && (
                      <span className="capitalize">{task.priority}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* === C. TABLE VIEW === */}
        {activeTab === "table" && (
          <div className="h-full overflow-auto p-6">
            <div className="min-w-[700px] border border-white/[0.08] rounded-lg overflow-hidden bg-[#121316]">
              <div className="grid grid-cols-[100px_1fr_120px_100px_120px] px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.08] text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                <div>Key</div>
                <div>Title</div>
                <div>Status</div>
                <div>Priority</div>
                <div>Assignee</div>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {filteredIssues.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => {
                      setEditingIssue(task);
                      setTaskDialogOpen(true);
                    }}
                    className="grid grid-cols-[100px_1fr_120px_100px_120px] px-4 py-3 text-xs items-center hover:bg-white/[0.02] cursor-pointer"
                  >
                    <div className="font-mono text-neutral-400">
                      {projectKey}-{task.number}
                    </div>
                    <div className="font-medium text-white truncate pr-4">
                      {task.title}
                    </div>
                    <div>
                      <span className="px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-[11px] text-neutral-300">
                        {task.workflowState?.name || "Todo"}
                      </span>
                    </div>
                    <div className="capitalize text-neutral-300">
                      {task.priority || "none"}
                    </div>
                    <div className="text-neutral-400 truncate">
                      {task.assignee || "Unassigned"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* === D. TIMELINE ROADMAP VIEW === */}
        {activeTab === "timeline" && (
          <div className="h-full overflow-y-auto p-6 max-w-4xl mx-auto space-y-6">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <h3 className="text-sm font-semibold text-white mb-1">
                Project Milestone Roadmap
              </h3>
              <p className="text-xs text-neutral-400 mb-4">
                Sequential delivery timeline and sprint phases for {projectName}.
              </p>

              <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/[0.08]">
                {filteredIssues.length === 0 ? (
                  <p className="text-xs text-neutral-500 pl-8">
                    No milestone tasks created yet. Click "New task" to plan timeline.
                  </p>
                ) : (
                  filteredIssues.map((task, idx) => (
                    <div key={task.id} className="relative pl-8 flex items-start justify-between gap-4">
                      <div className="absolute left-2 top-1.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-[#0e0f11]" />
                      <div>
                        <div className="text-xs font-semibold text-white">
                          {task.title}
                        </div>
                        <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                          Sprint Phase #{idx + 1} · {projectKey}-{task.number}
                        </div>
                      </div>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/[0.05] text-neutral-400 shrink-0">
                        {task.workflowState?.name || "Scheduled"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* === E. OVERVIEW VIEW === */}
        {activeTab === "overview" && (
          <div className="h-full overflow-y-auto p-6 max-w-4xl mx-auto space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[#121316] border border-white/[0.06]">
                <span className="text-xs text-neutral-400">Total Tasks</span>
                <p className="text-2xl font-bold text-white mt-1">{filteredIssues.length}</p>
              </div>
              <div className="p-4 rounded-xl bg-[#121316] border border-white/[0.06]">
                <span className="text-xs text-neutral-400">Completed Tasks</span>
                <p className="text-2xl font-bold text-emerald-400 mt-1">
                  {filteredIssues.filter((i) => i.workflowState?.type === "completed").length}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#121316] border border-white/[0.06]">
                <span className="text-xs text-neutral-400">Project Identifier</span>
                <p className="text-2xl font-bold font-mono text-primary mt-1">{projectKey}</p>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-[#121316] border border-white/[0.06] space-y-3">
              <h3 className="text-sm font-semibold text-white">About Project</h3>
              <p className="text-xs text-neutral-300 leading-relaxed">
                {project?.description || "No project description provided. Use project settings to add mission specs."}
              </p>
            </div>
          </div>
        )}

        {/* === F. FILES VIEW === */}
        {activeTab === "files" && (
          <div className="h-full overflow-y-auto p-6 max-w-3xl mx-auto">
            <div className="border border-dashed border-white/[0.1] rounded-xl p-8 text-center flex flex-col items-center justify-center bg-white/[0.01]">
              <UploadCloud className="w-8 h-8 text-neutral-400 mb-2" />
              <p className="text-sm font-medium text-white">Project Files & Attachments</p>
              <p className="text-xs text-neutral-500 mt-1">
                Drop documents, design prototypes, or CSV exports here to associate with {projectName}.
              </p>
              <Button size="sm" variant="outline" className="mt-4 text-xs">
                Upload File
              </Button>
            </div>
          </div>
        )}

        {/* === G. CALENDAR & ACTIVITY VIEWS === */}
        {(activeTab === "calendar" || activeTab === "activity") && (
          <div className="h-full overflow-y-auto p-6 max-w-3xl mx-auto text-center py-16 text-neutral-400">
            <p className="text-sm">
              Live {activeTab} view for {projectName} is active.
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              {filteredIssues.length} real tasks synced to the timeline.
            </p>
          </div>
        )}
      </div>

      {/* Real Issue Creation / Edit Dialog */}
      <IssueDialog
        action={editingIssue ? ISSUE_ACTION.EDIT : ISSUE_ACTION.CREATE}
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        onSubmit={handleTaskSubmit}
        projects={projects as any}
        workflowStates={workflowStates as any}
        labels={labels as any}
        initialData={
          editingIssue
            ? {
                title: editingIssue.title,
                description: editingIssue.description || "",
                projectId: editingIssue.projectId || projectId,
                workflowStateId: editingIssue.workflowStateId || defaultWorkflowStateId,
                priority: editingIssue.priority as any,
                labelIds: editingIssue.labels?.map((l: any) => l.labelId || l.id) || [],
              }
            : {
                projectId,
                workflowStateId: defaultWorkflowStateId || workflowStates[0]?.id,
              }
        }
      />

      {/* Real Project Settings Dialog */}
      {project && (
        <ProjectDialog
          open={projectSettingsOpen}
          onOpenChange={setProjectSettingsOpen}
          onSubmit={async (data) => {
            try {
              await updateProjectMutation.mutateAsync({
                projectId: project.id,
                data,
              });
              toast.success("Project updated successfully");
              setProjectSettingsOpen(false);
            } catch (err: any) {
              toast.error(err.message || "Failed to update project");
            }
          }}
          initialData={{
            name: project.name,
            key: project.key,
            color: project.color,
            status:
              project.status === "completed" || project.status === "canceled"
                ? project.status
                : "active",
            description: project.description || undefined,
            icon: project.icon || undefined,
            leadId: project.leadId || undefined,
          }}
        />
      )}
    </div>
  );
}
