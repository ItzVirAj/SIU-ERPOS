"use client";

import React, { useState, useMemo } from "react";
import { useActiveTeam } from "@/lib/context/team-context";
import {
  useIssues,
  useCreateIssue,
  useUpdateIssue,
} from "@/lib/hooks/use-issues";
import { useProjects } from "@/lib/hooks/use-projects";
import {
  useWorkflowStates,
  useLabels,
  useTeamMembers,
} from "@/lib/hooks/use-team-data";
import { IssueWithRelations, ISSUE_ACTION } from "@/lib/types";
import { IssueDialog } from "@/components/issues/issue-dialog";
import { DashboardLoader } from "@/components/ui/dashboard-loader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Project & avatar color palettes
const COLOR_PALETTE = [
  "#5A67D8",
  "#3B82C4",
  "#C54B78",
  "#C48A1E",
  "#8662C9",
  "#23918A",
  "#3D8E5F",
  "#C0612B",
  "#E11D48",
];

function getColorForString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLOR_PALETTE.length;
  return COLOR_PALETTE[index];
}

function getInitials(name?: string | null): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function CalendarPage() {
  const { teamId, loading: teamLoading } = useActiveTeam();

  // Queries
  const { data: issues = [], isLoading: issuesLoading } = useIssues(teamId);
  const { data: projects = [] } = useProjects(teamId);
  const { data: workflowStates = [] } = useWorkflowStates(teamId);
  const { data: labels = [] } = useLabels(teamId);
  const { data: members = [] } = useTeamMembers(teamId);

  // Mutations
  const createIssue = useCreateIssue(teamId);
  const updateIssue = useUpdateIssue(teamId);

  // Navigation & View State
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [calMode, setCalMode] = useState<"month" | "week">("month");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"manual" | "priority" | "title">("manual");

  // Dialog State
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<IssueWithRelations | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newTaskDueDate, setNewTaskDueDate] = useState<string>("");
  const [overflowModalDate, setOverflowModalDate] = useState<string | null>(null);

  // Today key
  const todayStr = useMemo(() => formatDateKey(new Date()), []);

  // Filtered issues
  const filteredIssues = useMemo(() => {
    return issues.filter((task) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!task.title.toLowerCase().includes(q)) return false;
      }
      if (filterPriority !== "all") {
        if ((task.priority || "none").toLowerCase() !== filterPriority) return false;
      }
      if (filterStatus !== "all") {
        const isDone =
          task.workflowState?.type === "completed" || !!task.completedAt;
        if (filterStatus === "completed" && !isDone) return false;
        if (filterStatus === "active" && isDone) return false;
      }
      return true;
    });
  }, [issues, searchQuery, filterPriority, filterStatus]);

  // Project map for quick color lookup
  const projectMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    projects.forEach((p, idx) => {
      map.set(p.id, {
        name: p.name,
        color: p.color || COLOR_PALETTE[idx % COLOR_PALETTE.length],
      });
    });
    return map;
  }, [projects]);

  // Month navigation calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthYearTitle = useMemo(() => {
    return currentDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }, [currentDate]);

  // Calendar Days calculation
  const calendarDays = useMemo(() => {
    if (calMode === "week") {
      // Find Monday of the current week
      const dayOfWeek = currentDate.getDay(); // 0 is Sunday
      const diffToMon = (dayOfWeek + 6) % 7; // distance back to Monday
      const monday = new Date(year, month, currentDate.getDate() - diffToMon);

      const days = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(
          monday.getFullYear(),
          monday.getMonth(),
          monday.getDate() + i
        );
        const dateStr = formatDateKey(d);
        days.push({
          date: d,
          dateStr,
          dayNumber: d.getDate(),
          isCurrentMonth: true,
          isToday: dateStr === todayStr,
        });
      }
      return days;
    }

    // Month mode: 35 or 42 grid cells starting on Monday
    const firstDay = new Date(year, month, 1);
    const dayOfWeek = firstDay.getDay(); // 0 is Sunday
    const startOffset = (dayOfWeek + 6) % 7; // days before 1st of month

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = startOffset + daysInMonth > 35 ? 42 : 35;

    const days = [];
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(year, month, 1 - startOffset + i);
      const dateStr = formatDateKey(d);
      days.push({
        date: d,
        dateStr,
        dayNumber: d.getDate(),
        isCurrentMonth: d.getMonth() === month,
        isToday: dateStr === todayStr,
      });
    }
    return days;
  }, [year, month, currentDate, calMode, todayStr]);

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const map = new Map<string, IssueWithRelations[]>();
    filteredIssues.forEach((issue) => {
      let dateKey = "";
      const anyIssue = issue as any;
      if (anyIssue.dueDate) {
        dateKey = String(anyIssue.dueDate).slice(0, 10);
      } else if (issue.createdAt) {
        const cDate = new Date(issue.createdAt);
        if (!isNaN(cDate.getTime())) {
          dateKey = formatDateKey(cDate);
        }
      }

      if (dateKey) {
        const list = map.get(dateKey) || [];
        list.push(issue);
        map.set(dateKey, list);
      }
    });

    // Apply sorting
    if (sortBy === "priority") {
      const pOrder: Record<string, number> = {
        urgent: 1,
        high: 2,
        medium: 3,
        low: 4,
        none: 5,
      };
      map.forEach((list) => {
        list.sort(
          (a, b) =>
            (pOrder[(a.priority || "none").toLowerCase()] || 99) -
            (pOrder[(b.priority || "none").toLowerCase()] || 99)
        );
      });
    } else if (sortBy === "title") {
      map.forEach((list) => {
        list.sort((a, b) => a.title.localeCompare(b.title));
      });
    }

    return map;
  }, [filteredIssues, sortBy]);

  // Navigation handlers
  const handleNav = (d: number) => {
    if (d === 0) {
      setCurrentDate(new Date());
    } else if (calMode === "month") {
      setCurrentDate(new Date(year, month + d, 1));
    } else {
      setCurrentDate(new Date(year, month, currentDate.getDate() + d * 7));
    }
  };

  const handleCreateTask = async (data: any) => {
    try {
      await createIssue.mutateAsync({
        ...data,
        teamId,
      });
      toast.success("Task created successfully!");
      setCreateDialogOpen(false);
      setNewTaskDueDate("");
    } catch (err: any) {
      toast.error(err.message || "Failed to create task");
    }
  };

  // Update Task Submission
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

  if (teamLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <DashboardLoader message="Loading Calendar" submessage="Preparing deadlines and milestones..." />
      </div>
    );
  }

  // Active tasks for overflow modal
  const overflowTasks = overflowModalDate
    ? tasksByDate.get(overflowModalDate) || []
    : [];

  return (
    <div
      className="content fx-route"
      id="main-content"
      tabIndex={-1}
      data-keep="c:calendar:::"
    >
      <style jsx global>{`
        .content.fx-route {
          width: 100%;
          min-height: 100vh;
          background: #0e0f11;
          color: #f3f4f6;
          display: flex;
          flex-direction: column;
        }
        .page.flush {
          width: 100%;
          max-width: 100%;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          flex: 1;
        }
        .ph {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          padding: 24px 20px 12px;
        }
        .ph h1 {
          font-size: 20px;
          font-weight: 600;
          color: #fff;
          letter-spacing: -0.02em;
          margin: 0;
        }
        .ph p {
          font-size: 13px;
          color: #94a3b8;
          margin-top: 2px;
        }
        .toolbar {
          display: flex;
          align-items: center;
          padding: 10px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          background: #0e0f11;
          gap: 10px;
          flex-wrap: wrap;
        }
        .inwrap {
          position: relative;
          display: inline-flex;
          align-items: center;
        }
        .inwrap svg {
          position: absolute;
          left: 10px;
          color: #64748b;
          pointer-events: none;
        }
        .inwrap .input.search-sm {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          color: #fff;
          font-size: 12px;
          padding: 6px 10px 6px 30px;
          outline: none;
          width: 200px;
          transition: all 0.15s ease;
        }
        .inwrap .input.search-sm:focus {
          border-color: rgba(255, 255, 255, 0.25);
          background: rgba(255, 255, 255, 0.07);
        }
        .sp {
          flex: 1;
        }
        .row {
          display: flex;
          align-items: center;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 500;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-primary {
          background: hsl(var(--primary, 258 89% 66%));
          color: #fff;
          border: none;
        }
        .btn-primary:hover {
          opacity: 0.9;
        }
        .btn-secondary {
          background: rgba(255, 255, 255, 0.06);
          color: #e2e8f0;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .btn-ghost {
          background: transparent;
          color: #cbd5e1;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .btn-ghost:hover {
          background: rgba(255, 255, 255, 0.06);
          color: #fff;
        }
        .btn-sm {
          padding: 4px 10px;
          font-size: 11.5px;
        }
        .ibtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.15s;
        }
        .ibtn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }
        .ibtn-sm {
          width: 26px;
          height: 26px;
        }
        .ibtn-xs {
          width: 20px;
          height: 20px;
        }
        .pdot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--c, #5A67D8);
          display: inline-block;
          flex-shrink: 0;
        }
        .seg {
          display: inline-flex;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          padding: 2px;
          gap: 2px;
        }
        .seg button {
          padding: 3px 10px;
          font-size: 11.5px;
          border-radius: 4px;
          border: none;
          background: transparent;
          color: #94a3b8;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.15s;
        }
        .seg button.on {
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
        }
        .cal {
          display: flex;
          flex-direction: column;
          background: #0e0f11;
          flex: 1;
          min-height: 640px;
        }
        .cal-h {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          background: #0e0f11;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          text-align: center;
          font-size: 11.5px;
          font-weight: 600;
          color: #64748b;
          padding: 8px 0;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .cal-g {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          background: rgba(255, 255, 255, 0.06);
          gap: 1px;
          flex: 1;
        }
        .cday {
          background: #0e0f11;
          padding: 6px 8px 8px;
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-height: 112px;
          transition: background 0.15s;
        }
        .cday:hover {
          background: #121316;
        }
        .cday.out {
          background: #0b0c0d;
        }
        .cday.out .dn {
          color: #475569;
        }
        .cday.today {
          background: #0e0f11;
        }
        .cday .dn {
          font-size: 12px;
          font-weight: 500;
          color: #cbd5e1;
          width: 22px;
          height: 22px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }
        .cday.today .dn {
          background: hsl(var(--primary, 258 89% 66%));
          color: #fff;
          font-weight: 600;
        }
        .cday .add {
          position: absolute;
          top: 6px;
          right: 6px;
          opacity: 0;
          transition: opacity 0.15s;
        }
        .cday:hover .add {
          opacity: 1;
        }
        .cev {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-left: 3px solid var(--c, #5A67D8);
          border-radius: 4px;
          padding: 3px 6px;
          font-size: 11px;
          color: #e2e8f0;
          cursor: pointer;
          text-align: left;
          width: 100%;
          transition: all 0.15s ease;
        }
        .cev:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
          transform: translateY(-1px);
        }
        .cev.done {
          opacity: 0.65;
        }
        .cev.done .trunc {
          text-decoration: line-through;
          color: #94a3b8;
        }
        .trunc {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
          font-size: 11px;
        }
        .av {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--c, #3B82C4);
          color: #fff;
          font-size: 9px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          line-height: 1;
        }
        .cmore {
          background: transparent;
          border: none;
          font-size: 11px;
          color: #64748b;
          cursor: pointer;
          text-align: left;
          padding: 2px 4px;
          border-radius: 3px;
          margin-top: 2px;
          font-weight: 500;
        }
        .cmore:hover {
          color: #e2e8f0;
          background: rgba(255, 255, 255, 0.06);
        }
        @media (max-width: 768px) {
          .hide-m {
            display: none !important;
          }
        }
      `}</style>

      <div className="page flush">
        {/* 1. Header (.ph) */}
        <div style={{ padding: "24px 20px 12px" }} className="ph">
          <div>
            <h1>Calendar</h1>
            <p>Deadlines and events across every project.</p>
          </div>
          <div className="acts">
            <button
              className="btn btn-primary"
              data-a="newTask"
              onClick={() => {
                setNewTaskDueDate(todayStr);
                setCreateDialogOpen(true);
              }}
            >
              <svg
                className="i"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14"></path>
                <path d="M12 5v14"></path>
              </svg>
              New task
            </button>
          </div>
        </div>

        {/* 2. Top Toolbar */}
        <div className="toolbar" role="toolbar">
          <div className="inwrap">
            <svg
              className="i"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.3-4.3"></path>
            </svg>
            <input
              className="input search-sm"
              id="vq-cal"
              data-in="viewQ"
              data-key="cal"
              placeholder="Search tasks"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search tasks"
            />
          </div>

          {/* Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="btn btn-ghost"
                data-a="pop"
                data-pop="filter"
                data-key="cal"
              >
                <svg
                  className="i"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 6h18"></path>
                  <path d="M7 12h10"></path>
                  <path d="M10 18h4"></path>
                </svg>
                Filter {filterPriority !== "all" || filterStatus !== "all" ? "•" : ""}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="bg-[#121316] border-white/[0.1] text-xs text-white"
            >
              <div className="px-2 py-1.5 font-semibold text-neutral-400">Status</div>
              <DropdownMenuItem onClick={() => setFilterStatus("all")}>
                All Statuses {filterStatus === "all" ? "✓" : ""}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus("active")}>
                Active Tasks {filterStatus === "active" ? "✓" : ""}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus("completed")}>
                Completed Tasks {filterStatus === "completed" ? "✓" : ""}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/[0.08]" />
              <div className="px-2 py-1.5 font-semibold text-neutral-400">Priority</div>
              <DropdownMenuItem onClick={() => setFilterPriority("all")}>
                All Priorities {filterPriority === "all" ? "✓" : ""}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterPriority("urgent")}>
                Urgent {filterPriority === "urgent" ? "✓" : ""}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterPriority("high")}>
                High {filterPriority === "high" ? "✓" : ""}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterPriority("medium")}>
                Medium {filterPriority === "medium" ? "✓" : ""}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterPriority("low")}>
                Low {filterPriority === "low" ? "✓" : ""}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="btn btn-ghost"
                data-a="pop"
                data-pop="sort"
                data-key="cal"
              >
                <svg
                  className="i"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m21 16-4 4-4-4"></path>
                  <path d="M17 20V4"></path>
                  <path d="m3 8 4-4 4 4"></path>
                  <path d="M7 4v16"></path>
                </svg>
                <span className="hide-m">Sort:</span>{" "}
                {sortBy === "manual" ? "Manual" : sortBy === "priority" ? "Priority" : "Title"}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="bg-[#121316] border-white/[0.1] text-xs text-white"
            >
              <DropdownMenuItem onClick={() => setSortBy("manual")}>
                Manual {sortBy === "manual" ? "✓" : ""}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("priority")}>
                Priority {sortBy === "priority" ? "✓" : ""}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("title")}>
                Title {sortBy === "title" ? "✓" : ""}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="sp"></span>
        </div>

        {/* 3. Calendar Body (.cal) */}
        <div className="cal" style={{ minHeight: "640px" }}>
          {/* Sub Toolbar */}
          <div className="toolbar" style={{ gap: "8px" }}>
            <button
              className="btn btn-secondary btn-sm"
              data-a="calNav"
              data-d="0"
              onClick={() => handleNav(0)}
            >
              Today
            </button>
            <div className="row" style={{ gap: 0 }}>
              <button
                className="ibtn ibtn-sm"
                data-a="calNav"
                data-d="-1"
                aria-label="Previous"
                onClick={() => handleNav(-1)}
              >
                <svg
                  className="i"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m15 18-6-6 6-6"></path>
                </svg>
              </button>
              <button
                className="ibtn ibtn-sm"
                data-a="calNav"
                data-d="1"
                aria-label="Next"
                onClick={() => handleNav(1)}
              >
                <svg
                  className="i"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m9 18 6-6-6-6"></path>
                </svg>
              </button>
            </div>
            <h2
              style={{
                fontSize: "15px",
                fontWeight: 600,
                margin: "0 4px",
                letterSpacing: "-.01em",
              }}
              aria-live="polite"
            >
              {monthYearTitle}
            </h2>

            <span className="sp"></span>

            {/* Dynamic Real Projects Legend */}
            {projects.length > 0 && (
              <span
                className="row hide-m"
                style={{
                  gap: "10px",
                  fontSize: "11.5px",
                  color: "var(--text-2, #94a3b8)",
                  marginRight: "8px",
                }}
              >
                {projects.slice(0, 6).map((proj) => {
                  const pColor = projectMap.get(proj.id)?.color || "#5A67D8";
                  return (
                    <span key={proj.id} className="row" style={{ gap: "4px" }}>
                      <span
                        className="pdot"
                        style={{ "--c": pColor } as React.CSSProperties}
                      ></span>
                      {proj.name}
                    </span>
                  );
                })}
              </span>
            )}

            {/* Month / Week Segment */}
            <div className="seg">
              <button
                className={calMode === "month" ? "on" : ""}
                data-a="set"
                data-k="calMode"
                data-v="month"
                onClick={() => setCalMode("month")}
              >
                Month
              </button>
              <button
                className={calMode === "week" ? "on" : ""}
                data-a="set"
                data-k="calMode"
                data-v="week"
                onClick={() => setCalMode("week")}
              >
                Week
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="cal-h">
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
            <div>Sun</div>
          </div>

          {/* Grid of Days */}
          <div
            className="cal-g"
            style={{
              gridTemplateRows:
                calMode === "week"
                  ? "minmax(400px, 1fr)"
                  : `repeat(${calendarDays.length / 7}, minmax(112px, 1fr))`,
            }}
          >
            {calendarDays.map((day) => {
              const dayTasks = tasksByDate.get(day.dateStr) || [];
              const visibleTasks = dayTasks.slice(0, 3);
              const extraCount = dayTasks.length - 3;

              return (
                <div
                  key={day.dateStr}
                  className={cn(
                    "cday",
                    !day.isCurrentMonth && "out",
                    day.isToday && "today"
                  )}
                  data-drop-day={day.dateStr}
                >
                  <span
                    className="dn"
                    {...(day.isToday ? { "aria-current": "date" } : {})}
                  >
                    {day.dayNumber}
                  </span>

                  {/* Add task button on hover */}
                  <button
                    className="ibtn ibtn-xs add"
                    data-a="newTask"
                    data-due={day.dateStr}
                    aria-label={`Add task on ${day.dateStr}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setNewTaskDueDate(day.dateStr);
                      setCreateDialogOpen(true);
                    }}
                  >
                    <svg
                      className="i"
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14"></path>
                      <path d="M12 5v14"></path>
                    </svg>
                  </button>

                  {/* Task Pills */}
                  {visibleTasks.map((task) => {
                    const isDone =
                      task.workflowState?.type === "completed" ||
                      !!task.completedAt;
                    const pInfo = task.projectId
                      ? projectMap.get(task.projectId)
                      : null;
                    const pColor = pInfo?.color || getColorForString(task.id);
                    const assigneeName =
                      task.assignee || task.assigneeId || "Unassigned";
                    const assigneeInitials = getInitials(assigneeName);
                    const assigneeColor = getColorForString(assigneeName);

                    const isUrgent =
                      task.priority === "urgent" || task.priority === "high";

                    return (
                      <button
                        key={task.id}
                        className={cn("cev", isDone && "done")}
                        style={{ "--c": pColor } as React.CSSProperties}
                        draggable="true"
                        data-drag-cal={task.id}
                        data-a="openTask"
                        data-id={task.id}
                        data-ctx="task"
                        title={task.title}
                        onClick={() => {
                          setSelectedTask(task);
                          setEditDialogOpen(true);
                        }}
                      >
                        {isDone ? (
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 14 14"
                            aria-hidden="true"
                            style={{ flexShrink: 0 }}
                          >
                            <circle
                              cx="7"
                              cy="7"
                              r="6.2"
                              fill="var(--st-done, #10b981)"
                            ></circle>
                            <path
                              d="M4.4 7.2 6.2 9 9.7 5.3"
                              fill="none"
                              stroke="var(--surface, #0e0f11)"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            ></path>
                          </svg>
                        ) : isUrgent ? (
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 14 14"
                            aria-hidden="true"
                            style={{ flexShrink: 0 }}
                          >
                            <rect
                              x="1"
                              y="1"
                              width="12"
                              height="12"
                              rx="3"
                              fill="var(--red, #ef4444)"
                            ></rect>
                            <path
                              d="M7 3.8v4"
                              stroke="#fff"
                              strokeWidth="1.7"
                              strokeLinecap="round"
                            ></path>
                            <circle cx="7" cy="10.1" r=".95" fill="#fff"></circle>
                          </svg>
                        ) : (
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 14 14"
                            aria-hidden="true"
                            style={{ flexShrink: 0 }}
                          >
                            <rect
                              x="1.8"
                              y="7.5"
                              width="2.6"
                              height="4.5"
                              rx="1"
                              fill="var(--text-2, #94a3b8)"
                            ></rect>
                            <rect
                              x="5.7"
                              y="4.5"
                              width="2.6"
                              height="7.5"
                              rx="1"
                              fill="var(--text-2, #94a3b8)"
                            ></rect>
                            <rect
                              x="9.6"
                              y="1.5"
                              width="2.6"
                              height="10.5"
                              rx="1"
                              fill="var(--border-strong, #475569)"
                            ></rect>
                          </svg>
                        )}
                        <span className="trunc">{task.title}</span>
                        <span
                          className="av"
                          style={{ "--c": assigneeColor } as React.CSSProperties}
                          aria-label={assigneeName}
                        >
                          {assigneeInitials}
                        </span>
                      </button>
                    );
                  })}

                  {/* +X more indicator */}
                  {extraCount > 0 && (
                    <button
                      className="cmore"
                      data-a="pop"
                      data-pop="daylist"
                      data-date={day.dateStr}
                      data-key="cal"
                      onClick={() => setOverflowModalDate(day.dateStr)}
                    >
                      +{extraCount} more
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Overflow Day Tasks Modal */}
      <Dialog
        open={!!overflowModalDate}
        onOpenChange={(open) => !open && setOverflowModalDate(null)}
      >
        <DialogContent className="sm:max-w-md bg-[#16181d] border-white/[0.1] text-white">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              Tasks on {overflowModalDate}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pt-2">
            {overflowTasks.map((task) => {
              const isDone =
                task.workflowState?.type === "completed" || !!task.completedAt;
              const pInfo = task.projectId ? projectMap.get(task.projectId) : null;
              const pColor = pInfo?.color || getColorForString(task.id);
              const assigneeName = task.assignee || "Unassigned";

              return (
                <div
                  key={task.id}
                  onClick={() => {
                    setOverflowModalDate(null);
                    setSelectedTask(task);
                    setEditDialogOpen(true);
                  }}
                  className="flex items-center justify-between p-2 rounded bg-white/[0.03] hover:bg-white/[0.08] cursor-pointer transition-all border border-white/[0.06]"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: pColor }}
                    />
                    <span
                      className={cn(
                        "text-xs truncate",
                        isDone && "line-through text-neutral-400"
                      )}
                    >
                      {task.title}
                    </span>
                  </div>
                  <span className="text-[10px] text-neutral-400 shrink-0 ml-2">
                    {assigneeName}
                  </span>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Real Issue Creation Dialog */}
      <IssueDialog
        action={ISSUE_ACTION.CREATE}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateTask}
        projects={projects as any}
        workflowStates={workflowStates as any}
        labels={labels as any}
        teamId={teamId}
        initialData={{
          workflowStateId: workflowStates[0]?.id,
        }}
        title="Create New Task"
        description="Schedule a task or event on the team calendar."
      />

      {/* Real Edit Issue Dialog */}
      {selectedTask && (
        <IssueDialog
          action={ISSUE_ACTION.EDIT}
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setSelectedTask(null);
          }}
          onSubmit={handleUpdateTask}
          projects={projects as any}
          workflowStates={workflowStates as any}
          labels={labels as any}
          teamId={teamId}
          initialData={{
            title: selectedTask.title,
            description: selectedTask.description ?? undefined,
            projectId: selectedTask.projectId || (selectedTask.project as any)?.id,
            workflowStateId: selectedTask.workflowStateId,
            assigneeId: selectedTask.assigneeId || "",
            priority: selectedTask.priority as any,
            estimate: (selectedTask as any).estimate,
            labelIds:
              selectedTask.labels?.map(
                (l: any) => l.label?.id || l.labelId || l.id
              ) || [],
          }}
          title="Task Details"
          description="View or update calendar task details."
        />
      )}
    </div>
  );
}

export default CalendarPage;
