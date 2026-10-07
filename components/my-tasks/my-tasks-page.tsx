"use client";

import React, { useState, useMemo } from "react";
import { useActiveTeam } from "@/lib/context/team-context";
import { authClient } from "@/lib/auth-client";
import {
  useMyTasks,
  useMyTasksStats,
  useCreateIssue,
  useUpdateIssue,
  useDeleteIssue,
} from "@/lib/hooks/use-issues";
import { useWorkflowStates, useLabels } from "@/lib/hooks/use-team-data";
import { useProjects } from "@/lib/hooks/use-projects";
import { IssueWithRelations, ISSUE_ACTION, PriorityLevel, ViewType } from "@/lib/types";
import { IssueDialog } from "@/components/issues/issue-dialog";
import { PriorityIcon } from "@/components/shared/priority-icon";
import { StatusBadge } from "@/components/shared/status-badge";
import { DashboardLoader } from "@/components/ui/dashboard-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
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
  AlertTriangle,
  Flame,
  LayoutList,
  LayoutGrid,
  Table as TableIcon,
  Folder,
  Calendar,
  MoreVertical,
  Trash2,
  Edit,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function MyTasksPage() {
  const { teamId, loading: teamLoading } = useActiveTeam();
  const { data: session } = authClient.useSession();

  // Filters & UI state
  const [activeTab, setActiveTab] = useState<"all" | "active" | "completed">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [currentView, setCurrentView] = useState<ViewType>("list");

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<IssueWithRelations | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Queries
  const {
    data: tasks = [],
    isLoading: tasksLoading,
    error: tasksError,
  } = useMyTasks(teamId, {
    search: searchQuery || undefined,
    type: activeTab,
    priority: selectedPriorities.length > 0 ? selectedPriorities : undefined,
    project: selectedProjects.length > 0 ? selectedProjects : undefined,
  });

  const { data: stats } = useMyTasksStats(teamId);
  const { data: workflowStates = [] } = useWorkflowStates(teamId);
  const { data: projects = [] } = useProjects(teamId);
  const { data: labels = [] } = useLabels(teamId);

  // Mutations
  const createIssue = useCreateIssue(teamId);
  const updateIssue = useUpdateIssue(teamId);
  const deleteIssue = useDeleteIssue(teamId);

  const currentUser = session?.user;

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
        assigneeId: data.assigneeId || currentUser?.id,
        assignee: data.assignee || currentUser?.name || currentUser?.email,
      });
      toast.success("Task created successfully!");
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
    try {
      await deleteIssue.mutateAsync(taskId);
      toast.success("Task deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete task");
    }
  };

  if (teamLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <DashboardLoader message="Loading Workspace" submessage="Preparing your tasks..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              <span>My Tasks</span>
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              Real-time
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Tasks strictly assigned or given to you across all projects in the ERP suite.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setCreateDialogOpen(true)}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>New Task</span>
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-[#121316] border-white/[0.08] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">Total Tasks</span>
            <ListTodo className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {stats ? stats.total : tasks.length}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">Assigned to you</div>
        </Card>

        <Card className="bg-[#121316] border-white/[0.08] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">Active & In Progress</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400 mt-2">
            {stats ? stats.active : tasks.filter((t) => t.workflowState?.type !== "completed").length}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">Pending completion</div>
        </Card>

        <Card className="bg-[#121316] border-white/[0.08] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">Urgent Priority</span>
            <Flame className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 mt-2">
            {stats ? stats.urgent : tasks.filter((t) => t.priority === "urgent").length}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">Needs immediate focus</div>
        </Card>

        <Card className="bg-[#121316] border-white/[0.08] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">
            {stats ? stats.completed : tasks.filter((t) => t.workflowState?.type === "completed").length}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">Finished tasks</div>
        </Card>
      </div>

      {/* Filter and View Controls */}
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

          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your tasks..."
              className="h-8 pl-8 text-xs bg-[#17181c] border-white/[0.08]"
            />
          </div>
        </div>

        {/* Right: Dropdown Filters & View Switcher */}
        <div className="flex items-center gap-2 justify-end">
          {/* Priority Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs bg-[#17181c] border-white/[0.08]">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-neutral-400" />
                <span>Priority</span>
                {selectedPriorities.length > 0 && (
                  <span className="ml-1 px-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px]">
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

          {/* Project Filter */}
          {projects.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs bg-[#17181c] border-white/[0.08]">
                  <Folder className="w-3.5 h-3.5 mr-1.5 text-neutral-400" />
                  <span>Project</span>
                  {selectedProjects.length > 0 && (
                    <span className="ml-1 px-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px]">
                      {selectedProjects.length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs">Filter by Project</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {projects.map((proj) => (
                  <DropdownMenuCheckboxItem
                    key={proj.id}
                    checked={selectedProjects.includes(proj.id)}
                    onCheckedChange={(checked) => {
                      setSelectedProjects((prev) =>
                        checked ? [...prev, proj.id] : prev.filter((x) => x !== proj.id)
                      );
                    }}
                    className="text-xs"
                  >
                    {proj.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* View Toggles */}
          <div className="flex items-center bg-[#17181c] rounded-lg p-0.5 border border-white/[0.08]">
            <button
              onClick={() => setCurrentView("list")}
              className={cn(
                "p-1.5 rounded transition-colors",
                currentView === "list" ? "bg-[#25272e] text-white" : "text-neutral-400 hover:text-white"
              )}
              title="List view"
            >
              <LayoutList className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentView("table")}
              className={cn(
                "p-1.5 rounded transition-colors",
                currentView === "table" ? "bg-[#25272e] text-white" : "text-neutral-400 hover:text-white"
              )}
              title="Table view"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Task List / View */}
      {tasksLoading ? (
        <div className="flex items-center justify-center py-20 text-neutral-400 text-sm gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Fetching your realtime tasks...</span>
        </div>
      ) : tasks.length === 0 ? (
        /* Empty State */
        <Card className="bg-[#121316] border-white/[0.08] p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">No tasks found</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1 mb-4">
            {searchQuery || selectedPriorities.length > 0 || selectedProjects.length > 0
              ? "No tasks match your current filter criteria."
              : activeTab === "completed"
              ? "You haven't completed any tasks yet."
              : "You are all caught up! There are no tasks currently assigned to you."}
          </p>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
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
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {tasks.map((task) => {
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

                    <td className="py-3 px-4 font-medium">
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-500 text-[11px] font-mono">
                          #{task.number || task.id.slice(-4)}
                        </span>
                        <span className={cn(isDone ? "line-through text-neutral-500" : "text-white")}>
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
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: task.project.color }}
                          />
                          <span>{task.project.name}</span>
                        </div>
                      ) : (
                        <span className="text-neutral-500">General</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
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
          {tasks.map((task) => {
            const isDone = task.workflowState?.type === "completed";
            const isToggling = togglingId === task.id;

            return (
              <div
                key={task.id}
                onClick={() => {
                  setSelectedTask(task);
                  setEditDialogOpen(true);
                }}
                className="flex items-center justify-between p-4 hover:bg-white/[0.02] cursor-pointer transition-colors group"
              >
                {/* Left: Check circle + Key + Title */}
                <div className="flex items-center gap-3 min-w-0 pr-4">
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
                      #{task.number || task.id.slice(-4)}
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

                {/* Right: Badges, Priority, Project, Actions */}
                <div className="flex items-center gap-4 shrink-0 text-xs">
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
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: task.project.color }}
                      />
                      <span className="truncate max-w-[120px]">{task.project.name}</span>
                    </div>
                  ) : null}

                  {/* Quick Edit */}
                  <div
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
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
                    >
                      <Edit className="w-3.5 h-3.5" />
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
          assigneeId: currentUser?.id || "",
        }}
        title="Create My Task"
        description="Create a task assigned directly to you."
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
          title="Task Details"
          description="View or update your assigned task."
        />
      )}
    </div>
  );
}

export { MyTasksPage };

