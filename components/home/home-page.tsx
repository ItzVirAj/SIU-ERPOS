"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import {
  Folder,
  FolderPlus,
  Plus,
  UserPlus,
  CheckCircle2,
  Clock,
  Target,
  ArrowUpRight,
  Calendar,
  Globe,
  Smartphone,
  Rocket,
  Check,
  AlertCircle,
  BarChart2,
  Sparkles,
  Mail,
  ChevronRight,
  Flame,
  AlertTriangle,
  Layers,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useIssues,
  useCreateIssue,
  useUpdateIssue,
  useMyTasks,
  useMyTasksStats,
} from "@/lib/hooks/use-issues";
import { useProjects } from "@/lib/hooks/use-projects";
import {
  useWorkflowStates,
  useLabels,
  useTeamMembers,
} from "@/lib/hooks/use-team-data";
import { IssueDialog } from "@/components/issues/issue-dialog";
import { ProjectDialog } from "@/components/projects/project-dialog";
import { ISSUE_ACTION, IssueWithRelations } from "@/lib/types";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface WorkspaceHomeProps {
  teamId: string;
}

function getRelativeTime(dateInput?: string | Date | null): string {
  if (!dateInput) return "Recently";
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function WorkspaceHome({ teamId }: WorkspaceHomeProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();

  // Real queries for database data
  const { data: realIssues = [] } = useIssues(teamId);
  const { data: realProjects = [] } = useProjects(teamId);
  const { data: workflowStates = [] } = useWorkflowStates(teamId);
  const { data: labels = [] } = useLabels(teamId);
  const { data: members = [] } = useTeamMembers(teamId);

  // Realtime "My Tasks" query & stats (strictly real-time from my-tasks endpoint)
  const { data: myTasks = [], isLoading: myTasksLoading } = useMyTasks(teamId, {
    type: "all",
  });
  const { data: myTasksStats } = useMyTasksStats(teamId);

  const createIssueMutation = useCreateIssue(teamId);
  const updateIssueMutation = useUpdateIssue(teamId);

  // Dialog states
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("developer");
  const [isInviting, setIsInviting] = useState(false);

  // Active tab in "My tasks"
  const [activeTaskTab, setActiveTaskTab] = useState<"upcoming" | "overdue" | "completed">("upcoming");
  const [showMoreDeadlines, setShowMoreDeadlines] = useState(false);
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);

  // Toggle task completion in real-time
  const toggleTaskCompletion = async (task: IssueWithRelations) => {
    if (togglingTaskId) return;
    setTogglingTaskId(task.id);

    const isDone = task.workflowState?.type === "completed";
    const completedState = workflowStates.find((ws: any) => ws.type === "completed");
    const unstartedState =
      workflowStates.find(
        (ws: any) => ws.type === "unstarted" || ws.type === "started"
      ) || workflowStates[0];
    const targetState = isDone ? unstartedState : completedState;

    if (!targetState) {
      setTogglingTaskId(null);
      return;
    }

    try {
      await updateIssueMutation.mutateAsync({
        issueId: task.id,
        data: {
          workflowStateId: targetState.id,
          completedAt: isDone ? null : new Date().toISOString(),
        },
      });
      queryClient.invalidateQueries({ queryKey: ["my-tasks", teamId] });
      queryClient.invalidateQueries({ queryKey: ["my-tasks-stats", teamId] });
      queryClient.invalidateQueries({ queryKey: ["issues", teamId] });
      if (!isDone) {
        toast.success(`Completed "${task.title}"!`);
      } else {
        toast.info(`Reopened "${task.title}"!`);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to update task");
    } finally {
      setTogglingTaskId(null);
    }
  };

  // User Greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const userName = useMemo(() => {
    if (session?.user?.name) {
      return session.user.name.split(" ")[0];
    }
    return "Team Member";
  }, [session]);

  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, []);

  // Filter real-time tasks for the 3 tabs in "My tasks"
  const upcomingTasks = useMemo(() => {
    return myTasks.filter(
      (t) =>
        t.workflowState?.type !== "completed" &&
        t.workflowState?.type !== "canceled"
    );
  }, [myTasks]);

  const overdueTasksList = useMemo(() => {
    return myTasks.filter(
      (t) =>
        t.workflowState?.type !== "completed" &&
        t.workflowState?.type !== "canceled" &&
        (t.priority === "urgent" || t.priority === "high")
    );
  }, [myTasks]);

  const completedTasksList = useMemo(() => {
    return myTasks.filter((t) => t.workflowState?.type === "completed");
  }, [myTasks]);

  // Real-time project progress calculation
  const projectsList = useMemo(() => {
    return realProjects.map((project) => {
      const projectIssues = realIssues.filter((i) => i.projectId === project.id);
      const total = projectIssues.length;
      const completed = projectIssues.filter((i) => i.workflowState?.type === "completed").length;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

      // Unique team member avatars
      const memberInitials = new Set<string>();
      projectIssues.forEach((i) => {
        if (i.assignee) {
          memberInitials.add(i.assignee.slice(0, 2).toUpperCase());
        }
      });
      if (memberInitials.size === 0 && project.lead) {
        memberInitials.add(project.lead.slice(0, 2).toUpperCase());
      }
      const teamAvatars = Array.from(memberInitials).slice(0, 3);
      if (teamAvatars.length === 0) teamAvatars.push("PR");

      return {
        id: project.id,
        name: project.name,
        color: project.color || "#3b82f6",
        status:
          project.status === "completed"
            ? "Completed"
            : project.status === "canceled"
            ? "Canceled"
            : "In Progress",
        progress,
        totalIssues: total,
        completedIssues: completed,
        teamAvatars,
      };
    });
  }, [realProjects, realIssues]);

  // Real-time upcoming deadlines (active tasks from myTasks with priority or active status)
  const deadlinesList = useMemo(() => {
    return upcomingTasks.slice(0, showMoreDeadlines ? 15 : 5);
  }, [upcomingTasks, showMoreDeadlines]);

  // Real-time recent activities from real issues
  const recentActivities = useMemo(() => {
    return realIssues.slice(0, 5).map((issue) => {
      const creatorName = issue.creator || issue.assignee || "Member";
      const isCompleted = issue.workflowState?.type === "completed";
      const initials = (creatorName ? creatorName.slice(0, 2) : "ME").toUpperCase();

      return {
        id: issue.id,
        user: creatorName,
        action: isCompleted ? "completed task" : "created task",
        target: issue.title,
        time: getRelativeTime(issue.updatedAt || issue.createdAt),
        avatar: initials,
      };
    });
  }, [realIssues]);

  // Handle Invite Member submission
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setIsInviting(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send invitation");
      }
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteDialogOpen(false);
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ["invitations", teamId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to send invitation");
    } finally {
      setIsInviting(false);
    }
  };

  // Handle Task Creation
  const handleCreateIssue = async (data: any) => {
    try {
      await createIssueMutation.mutateAsync({
        ...data,
        teamId,
      });
      toast.success("Task created successfully!");
      setTaskDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["my-tasks", teamId] });
      queryClient.invalidateQueries({ queryKey: ["my-tasks-stats", teamId] });
      queryClient.invalidateQueries({ queryKey: ["issues", teamId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to create task");
    }
  };

  // Handle Project Creation
  const handleCreateProject = async (data: any) => {
    try {
      const res = await fetch(`/api/teams/${teamId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to create project");
      }
      toast.success("Project created successfully!");
      setProjectDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["projects", teamId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to create project");
    }
  };

  return (
    <div className="w-full bg-[#0e0f11] text-neutral-100 space-y-7 max-w-[1440px] mx-auto pb-10">
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            {greeting}, {userName}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400">
            {formattedDate} &middot; Here&apos;s what&apos;s happening across your workspace.
          </p>
        </div>

        {/* Action Buttons Top Right */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setInviteDialogOpen(true)}
            className="h-9 px-3.5 bg-[#17181c] border-white/[0.08] hover:bg-neutral-800 text-neutral-200 text-xs font-medium rounded-lg transition-all"
          >
            <UserPlus className="w-3.5 h-3.5 mr-2 text-neutral-400" />
            Invite member
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setProjectDialogOpen(true)}
            className="h-9 px-3.5 bg-[#17181c] border-white/[0.08] hover:bg-neutral-800 text-neutral-200 text-xs font-medium rounded-lg transition-all"
          >
            <FolderPlus className="w-3.5 h-3.5 mr-2 text-neutral-400" />
            New project
          </Button>

          <Button
            size="sm"
            onClick={() => setTaskDialogOpen(true)}
            className="h-9 px-4 bg-[#7c82fb] hover:bg-[#6c72eb] text-white text-xs font-medium rounded-lg shadow-sm transition-all flex items-center"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New task
          </Button>
        </div>
      </div>

      {/* 2. Top Metric Stat Cards (4-column grid fetched from realtime data) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Projects */}
        <div className="bg-[#141619] border border-white/[0.07] rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-white/[0.12] transition-colors">
          <div className="flex items-center gap-2 text-neutral-400 text-xs font-medium">
            <Folder className="w-4 h-4 text-neutral-400" />
            <span>Active projects</span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-semibold tracking-tight text-white">
              {realProjects.length}
            </div>
            <div className="text-xs text-neutral-400 mt-1">
              {realProjects.filter((p) => p.status === "active" || !p.status).length} active
            </div>
          </div>
        </div>

        {/* Card 2: Open Tasks (Real-time from My Tasks) */}
        <div className="bg-[#141619] border border-white/[0.07] rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-white/[0.12] transition-colors">
          <div className="flex items-center gap-2 text-neutral-400 text-xs font-medium">
            <Target className="w-4 h-4 text-neutral-400" />
            <span>My open tasks</span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-semibold tracking-tight text-white">
              {myTasksStats?.active ?? upcomingTasks.length}
            </div>
            <div className="text-xs text-neutral-400 mt-1">
              {upcomingTasks.length} assigned to you
            </div>
          </div>
        </div>

        {/* Card 3: Completed Tasks */}
        <div className="bg-[#141619] border border-white/[0.07] rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-white/[0.12] transition-colors">
          <div className="flex items-center gap-2 text-neutral-400 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-neutral-400" />
            <span>Completed</span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-semibold tracking-tight text-white">
              {myTasksStats?.completed ?? completedTasksList.length}
            </div>
            <div className="text-xs text-emerald-400 font-medium mt-1">tasks completed</div>
          </div>
        </div>

        {/* Card 4: Urgent / Overdue */}
        <div className="bg-[#141619] border border-white/[0.07] rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-white/[0.12] transition-colors">
          <div className="flex items-center gap-2 text-neutral-400 text-xs font-medium">
            <Clock className="w-4 h-4 text-neutral-400" />
            <span>Urgent</span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-semibold tracking-tight text-rose-500">
              {myTasksStats?.urgent ?? overdueTasksList.length}
            </div>
            <div className="text-xs text-rose-400 font-medium mt-1">
              {overdueTasksList.length > 0 ? "need attention" : "all clear"}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Dashboard Layout (2 Columns: Left 7 cols, Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 of 12) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          {/* Card: My tasks (Real-time from My Tasks) */}
          <div className="bg-[#141619] border border-white/[0.07] rounded-xl p-5 hover:border-white/[0.12] transition-colors">
            {/* Header with Segmented Filter Pills */}
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.05]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <h2 className="text-sm sm:text-base font-semibold text-white">My tasks</h2>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="flex items-center bg-[#1c1e22] rounded-lg p-0.5 border border-white/[0.06] text-xs">
                  <button
                    onClick={() => setActiveTaskTab("upcoming")}
                    className={cn(
                      "px-2.5 py-1 rounded-md transition-colors",
                      activeTaskTab === "upcoming"
                        ? "bg-[#282a30] text-white font-medium shadow-xs"
                        : "text-neutral-400 hover:text-white"
                    )}
                  >
                    Upcoming <span className="opacity-70 ml-0.5">{upcomingTasks.length}</span>
                  </button>
                  <button
                    onClick={() => setActiveTaskTab("overdue")}
                    className={cn(
                      "px-2.5 py-1 rounded-md transition-colors",
                      activeTaskTab === "overdue"
                        ? "bg-[#282a30] text-white font-medium shadow-xs"
                        : "text-neutral-400 hover:text-white"
                    )}
                  >
                    Urgent <span className="opacity-70 ml-0.5">{overdueTasksList.length}</span>
                  </button>
                  <button
                    onClick={() => setActiveTaskTab("completed")}
                    className={cn(
                      "px-2.5 py-1 rounded-md transition-colors",
                      activeTaskTab === "completed"
                        ? "bg-[#282a30] text-white font-medium shadow-xs"
                        : "text-neutral-400 hover:text-white"
                    )}
                  >
                    Completed <span className="opacity-70 ml-0.5">{completedTasksList.length}</span>
                  </button>
                </div>

                <Link
                  href="/dashboard/my-tasks"
                  className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800/60 rounded-md transition-colors"
                  title="View full My Tasks page"
                >
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Task Item List */}
            <div className="divide-y divide-white/[0.04] min-h-[160px]">
              {(activeTaskTab === "upcoming"
                ? upcomingTasks
                : activeTaskTab === "overdue"
                ? overdueTasksList
                : completedTasksList
              ).length === 0 ? (
                <div className="py-12 text-center text-neutral-400">
                  <CheckCircle2 className="w-8 h-8 text-neutral-600 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium text-white">
                    {activeTaskTab === "upcoming"
                      ? "No upcoming tasks"
                      : activeTaskTab === "overdue"
                      ? "No urgent tasks"
                      : "No completed tasks yet"}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1 mb-4">
                    {activeTaskTab === "upcoming"
                      ? "You're all caught up! Create a task to track your work."
                      : "Tasks you complete will appear here."}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setTaskDialogOpen(true)}
                    className="text-xs h-8 border-white/[0.1] bg-white/[0.03] text-neutral-300 hover:text-white"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    New task
                  </Button>
                </div>
              ) : (
                (activeTaskTab === "upcoming"
                  ? upcomingTasks
                  : activeTaskTab === "overdue"
                  ? overdueTasksList
                  : completedTasksList
                ).map((task) => {
                  const isChecked = task.workflowState?.type === "completed";
                  const isUrgent = task.priority === "urgent";

                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between py-3 px-1 hover:bg-white/[0.02] rounded-lg transition-colors group"
                    >
                      {/* Left: Check button + Title */}
                      <div className="flex items-center gap-3 min-w-0 pr-4">
                        <button
                          type="button"
                          onClick={() => toggleTaskCompletion(task)}
                          disabled={togglingTaskId === task.id}
                          className={cn(
                            "w-4 h-4 rounded-full flex items-center justify-center transition-all shrink-0",
                            isChecked
                              ? "bg-emerald-500 text-black border border-emerald-500"
                              : isUrgent
                              ? "border border-amber-400/80 bg-amber-400/10 text-amber-400"
                              : "border border-neutral-600 hover:border-neutral-400"
                          )}
                        >
                          {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          {!isChecked && isUrgent && (
                            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                          )}
                        </button>

                        <span
                          className={cn(
                            "text-sm tracking-tight truncate",
                            isChecked
                              ? "line-through text-neutral-500"
                              : "text-neutral-200 group-hover:text-white"
                          )}
                        >
                          {task.title}
                        </span>
                      </div>

                      {/* Right: Project Pill, Priority, Status */}
                      <div className="flex items-center gap-4 shrink-0 text-xs">
                        {/* Project Pill with Colored Dot */}
                        {task.project && (
                          <div className="flex items-center gap-1.5 text-neutral-400 hidden sm:flex">
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: task.project.color || "#3b82f6" }}
                            />
                            <span className="truncate max-w-[120px]">{task.project.name}</span>
                          </div>
                        )}

                        {/* Priority Indicator */}
                        {task.priority && task.priority !== "none" && (
                          <div className="flex items-center">
                            {task.priority === "urgent" ? (
                              <div className="w-3.5 h-3.5 bg-rose-500/20 border border-rose-500/40 rounded flex items-center justify-center text-rose-400 text-[10px] font-bold">
                                !
                              </div>
                            ) : task.priority === "high" ? (
                              <div className="w-3.5 h-3.5 bg-amber-500/20 border border-amber-500/40 rounded flex items-center justify-center text-amber-400 text-[10px] font-bold">
                                ↑
                              </div>
                            ) : (
                              <div className="flex items-end gap-0.5 h-3 w-3">
                                <span className="w-0.5 h-1 bg-neutral-500 rounded-full" />
                                <span className="w-0.5 h-2 bg-neutral-400 rounded-full" />
                                <span
                                  className={cn(
                                    "w-0.5 h-3 rounded-full",
                                    task.priority === "medium" ? "bg-amber-400" : "bg-neutral-600"
                                  )}
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Status name */}
                        <span className="w-16 text-right text-neutral-400 truncate">
                          {task.workflowState?.name || "Active"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Card: Project progress (Real-time from Database) */}
          <div className="bg-[#141619] border border-white/[0.07] rounded-xl p-5 hover:border-white/[0.12] transition-colors">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.05]">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-primary" />
                <h2 className="text-sm sm:text-base font-semibold text-white">Project progress</h2>
              </div>
              <Link
                href="/dashboard/projects"
                className="text-xs text-neutral-400 hover:text-white transition-colors"
              >
                All projects
              </Link>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 text-xs font-medium text-neutral-400 py-3 px-1 border-b border-white/[0.03]">
              <div className="col-span-5 sm:col-span-4">Project</div>
              <div className="col-span-3 sm:col-span-3">Status</div>
              <div className="col-span-4 sm:col-span-3">Progress</div>
              <div className="hidden sm:block sm:col-span-2 text-right">Team</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-white/[0.04]">
              {projectsList.length === 0 ? (
                <div className="py-8 text-center text-neutral-400">
                  <p className="text-xs">No projects created yet.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setProjectDialogOpen(true)}
                    className="mt-2 text-xs h-7"
                  >
                    Create Project
                  </Button>
                </div>
              ) : (
                projectsList.map((project) => (
                  <div
                    key={project.id}
                    onClick={() => router.push(`/dashboard/projects?project=${project.id}&view=board`)}
                    className="grid grid-cols-12 items-center py-3.5 px-1 hover:bg-white/[0.02] rounded-lg transition-colors text-xs cursor-pointer"
                  >
                    {/* Project Column */}
                    <div className="col-span-5 sm:col-span-4 flex items-center gap-2.5 min-w-0 pr-2">
                      <div
                        className="w-6 h-6 rounded-md border border-white/[0.05] flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${project.color}20` }}
                      >
                        <Globe className="w-3.5 h-3.5" style={{ color: project.color }} />
                      </div>
                      <span className="font-medium text-neutral-200 truncate">{project.name}</span>
                    </div>

                    {/* Status Column */}
                    <div className="col-span-3 sm:col-span-3 flex items-center gap-1.5 text-neutral-300">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: project.color }}
                      />
                      <span className="truncate">{project.status}</span>
                    </div>

                    {/* Progress Column */}
                    <div className="col-span-4 sm:col-span-3 pr-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-primary h-full rounded-full transition-all duration-300"
                            style={{ width: `${project.progress}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-neutral-400 w-8 text-right">
                          {project.progress}%
                        </span>
                      </div>
                    </div>

                    {/* Team Column */}
                    <div className="hidden sm:flex sm:col-span-2 items-center justify-end -space-x-1.5">
                      {project.teamAvatars.map((initials, idx) => (
                        <div
                          key={idx}
                          className="w-5 h-5 rounded-full border border-[#141619] bg-neutral-800 text-[9px] font-medium text-neutral-300 flex items-center justify-center"
                        >
                          {initials}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column (5 of 12) */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          {/* Card: Upcoming deadlines (Real-time from My Tasks) */}
          <div className="bg-[#141619] border border-white/[0.07] rounded-xl p-5 hover:border-white/[0.12] transition-colors">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.05]">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm sm:text-base font-semibold text-white">Upcoming deadlines</h2>
              </div>
              <button
                type="button"
                onClick={() => router.push("/dashboard/my-tasks")}
                className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>My Tasks</span>
              </button>
            </div>

            {/* Real Deadlines List */}
            <div className="space-y-3 pt-3">
              {deadlinesList.length === 0 ? (
                <div className="py-6 text-center text-neutral-500 text-xs">
                  No upcoming deadlines scheduled.
                </div>
              ) : (
                deadlinesList.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-1.5 px-2 hover:bg-white/[0.02] rounded-md transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.project?.color || "#3b82f6" }}
                      />
                      <span className="text-neutral-200 truncate">{item.title}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.priority === "urgent" ? (
                        <div className="w-3.5 h-3.5 bg-rose-500/20 border border-rose-500/40 rounded flex items-center justify-center text-rose-400 text-[10px] font-bold">
                          !
                        </div>
                      ) : (
                        <span className="text-[11px] text-neutral-500 font-mono">
                          {item.workflowState?.name || "Active"}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}

              {upcomingTasks.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowMoreDeadlines(!showMoreDeadlines)}
                  className="text-xs text-neutral-400 hover:text-white pt-1 pl-2 transition-colors block text-left"
                >
                  {showMoreDeadlines ? "Show less" : `+${upcomingTasks.length - 5} more`}
                </button>
              )}
            </div>
          </div>

          {/* Card: Recent activity (Real-time from Database Issues) */}
          <div className="bg-[#141619] border border-white/[0.07] rounded-xl p-5 hover:border-white/[0.12] transition-colors">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.05]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h2 className="text-sm sm:text-base font-semibold text-white">Recent activity</h2>
              </div>
              <Link
                href="/dashboard/issues"
                className="text-xs text-neutral-400 hover:text-white transition-colors"
              >
                View all
              </Link>
            </div>

            {/* Stream */}
            <div className="space-y-3 pt-3">
              {recentActivities.length === 0 ? (
                <div className="py-6 text-center text-neutral-500 text-xs">
                  No recent activity yet.
                </div>
              ) : (
                recentActivities.map((act) => (
                  <div key={act.id} className="flex items-start gap-3 text-xs">
                    <div className="w-6 h-6 rounded-full bg-neutral-800 text-neutral-300 flex items-center justify-center font-medium text-[10px] shrink-0 mt-0.5 border border-white/[0.08]">
                      {act.avatar}
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-neutral-300 leading-snug">
                        <span className="font-medium text-white">{act.user}</span>{" "}
                        <span className="text-neutral-400">{act.action}</span>{" "}
                        <span className="text-neutral-200 font-medium">{act.target}</span>
                      </p>
                      <span className="text-[11px] text-neutral-500 block">{act.time}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Invite Member Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-md bg-[#16181d] border-white/[0.08] text-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-medium text-white">Invite team member</DialogTitle>
            <DialogDescription className="text-xs text-neutral-400">
              Send an email invitation to collaborate on tasks and projects.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleInviteSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="inviteEmail" className="text-xs text-neutral-300">Email Address</Label>
              <Input
                id="inviteEmail"
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className="bg-[#121316] border-white/[0.08] text-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inviteRole" className="text-xs text-neutral-300">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="bg-[#121316] border-white/[0.08] text-white">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent className="bg-[#16181d] border-white/[0.08] text-white">
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setInviteDialogOpen(false)}
                className="border-white/[0.08] bg-transparent text-neutral-300 hover:bg-neutral-800"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isInviting}
                className="bg-[#7c82fb] hover:bg-[#6c72eb] text-white"
              >
                {isInviting ? "Sending..." : "Send invitation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Task Dialog */}
      <IssueDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        onSubmit={handleCreateIssue}
        projects={realProjects as any}
        workflowStates={workflowStates as any}
        labels={labels as any}
        teamId={teamId}
        action={ISSUE_ACTION.CREATE}
        title="Create new task"
      />

      {/* New Project Dialog */}
      <ProjectDialog
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
        onSubmit={handleCreateProject}
        teamId={teamId}
        title="Create new project"
      />
    </div>
  );
}

export { WorkspaceHome as HomePage };
export default WorkspaceHome;
