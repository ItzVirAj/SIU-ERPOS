"use client";

import React, { useState, useMemo } from "react";
import { useActiveTeam } from "@/lib/context/team-context";
import {
  useCalendarEvents,
  CalendarEventItem,
} from "@/lib/hooks/use-calendar";
import { useProjects } from "@/lib/hooks/use-projects";
import { useTeamMembers } from "@/lib/hooks/use-team-data";
import { IssueWithRelations } from "@/lib/types";
import { IssueDialog } from "@/components/issues/issue-dialog";
import { EventDialog } from "@/components/calendar/event-dialog";
import { EventDetailsDialog } from "@/components/calendar/event-details-dialog";
import { StandupDialog } from "@/components/calendar/standup-dialog";
import { DashboardLoader } from "@/components/ui/dashboard-loader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Video,
  Zap,
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Flag,
  Sun,
  Bell,
  CheckSquare,
  List,
  Grid3X3,
  Columns,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function CalendarPage() {
  const { teamId, loading: teamLoading } = useActiveTeam();

  // Navigation & View State
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [calMode, setCalMode] = useState<"month" | "week" | "agenda">("month");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterProject, setFilterProject] = useState<string>("all");

  // Dialog State
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [standupDialogOpen, setStandupDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventItem | null>(null);
  const [selectedDateForNewEvent, setSelectedDateForNewEvent] = useState<string>("");

  // Queries
  const { data: allItems = [], isLoading: eventsLoading } = useCalendarEvents(teamId, {
    type: filterType !== "all" ? filterType : undefined,
    projectId: filterProject !== "all" ? filterProject : undefined,
    includeIssues: filterType === "all" || filterType === "task_deadline",
  });
  const { data: projects = [] } = useProjects(teamId);
  const { data: members = [] } = useTeamMembers(teamId);

  // Today key
  const todayStr = useMemo(() => formatDateKey(new Date()), []);

  // Filter items by search query
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!item.title.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allItems, searchQuery]);

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

  // Date navigation title
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthYearTitle = useMemo(() => {
    return currentDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }, [currentDate]);

  // Calendar Days calculation for Month and Week modes
  const calendarDays = useMemo(() => {
    if (calMode === "week") {
      const dayOfWeek = currentDate.getDay(); // 0 is Sunday
      const diffToMon = (dayOfWeek + 6) % 7; // distance back to Monday
      const monday = new Date(year, month, currentDate.getDate() - diffToMon);

      const days = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
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

    // Month mode
    const firstDay = new Date(year, month, 1);
    const dayOfWeek = firstDay.getDay();
    const startOffset = (dayOfWeek + 6) % 7;
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

  // Group events/tasks by date key
  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventItem[]>();
    filteredItems.forEach((item) => {
      const dateKey = String(item.startTime || item.endTime).slice(0, 10);
      if (dateKey) {
        const list = map.get(dateKey) || [];
        list.push(item);
        map.set(dateKey, list);
      }
    });
    return map;
  }, [filteredItems]);

  const handleNav = (d: number) => {
    if (d === 0) {
      setCurrentDate(new Date());
    } else if (calMode === "month") {
      setCurrentDate(new Date(year, month + d, 1));
    } else {
      const copy = new Date(currentDate);
      copy.setDate(copy.getDate() + d * 7);
      setCurrentDate(copy);
    }
  };

  const handleDayClick = (dateStr: string) => {
    setSelectedDateForNewEvent(dateStr);
    setEventDialogOpen(true);
  };

  const handleItemClick = (item: CalendarEventItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEvent(item);
    setDetailsDialogOpen(true);
  };

  // Helper for item badge visual styling
  const getItemVisual = (item: CalendarEventItem) => {
    switch (item.type) {
      case "meeting":
        return {
          icon: <Video className="w-3 h-3 text-indigo-400 shrink-0" />,
          color: "#6366f1",
          label: "Meeting",
          border: "border-indigo-500/40",
          bg: "bg-indigo-950/30",
        };
      case "standup":
        return {
          icon: <Zap className="w-3 h-3 text-amber-400 shrink-0" />,
          color: "#f59e0b",
          label: "Standup",
          border: "border-amber-500/40",
          bg: "bg-amber-950/30",
        };
      case "milestone":
        return {
          icon: <Flag className="w-3 h-3 text-purple-400 shrink-0" />,
          color: "#a855f7",
          label: "Milestone",
          border: "border-purple-500/40",
          bg: "bg-purple-950/30",
        };
      case "leave":
        return {
          icon: <Sun className="w-3 h-3 text-rose-400 shrink-0" />,
          color: "#f43f5e",
          label: "Leave",
          border: "border-rose-500/40",
          bg: "bg-rose-950/30",
        };
      case "followup":
        return {
          icon: <Bell className="w-3 h-3 text-orange-400 shrink-0" />,
          color: "#f97316",
          label: "Follow-up",
          border: "border-orange-500/40",
          bg: "bg-orange-950/30",
        };
      default:
        return {
          icon: <CheckSquare className="w-3 h-3 text-emerald-400 shrink-0" />,
          color: item.project?.color || "#10b981",
          label: "Task",
          border: "border-emerald-500/40",
          bg: "bg-neutral-900/60",
        };
    }
  };

  if (teamLoading || !teamId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <DashboardLoader message="Loading Calendar & Meetings" submessage="Syncing events and meeting notes..." />
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#0e0f11] text-neutral-100 flex flex-col">
      {/* 1. Header with Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-neutral-800/80 px-6 py-4 gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-indigo-400" />
            Calendar & Meeting Intelligence
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            PRD 6.2 (CAL): Client meetings, Google Meet sync, daily stand-ups, AI meeting notes, and deadlines.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => setStandupDialogOpen(true)}
            className="bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-medium"
          >
            <Zap className="w-3.5 h-3.5 mr-1.5" />
            Daily Stand-up
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setSelectedDateForNewEvent(todayStr);
              setEventDialogOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-sm shadow-indigo-600/30"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Schedule Event
          </Button>
        </div>
      </div>

      {/* 2. Filter & Navigation Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-6 py-2.5 border-b border-neutral-800/80 bg-[#111215] gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search meetings & tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-neutral-900 border border-neutral-800 rounded-md text-xs text-neutral-100 pl-8 pr-3 py-1.5 w-48 sm:w-56 focus:outline-none focus:border-neutral-700"
            />
          </div>

          {/* Event Type Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 border-neutral-800 text-xs text-neutral-300 bg-neutral-900">
                <Filter className="w-3 h-3 mr-1.5 text-neutral-400" />
                Type: {filterType === "all" ? "All Types" : filterType.replace("_", " ")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#18191c] border-neutral-800 text-xs text-neutral-200">
              <DropdownMenuItem onClick={() => setFilterType("all")}>All Types</DropdownMenuItem>
              <DropdownMenuSeparator className="bg-neutral-800" />
              <DropdownMenuItem onClick={() => setFilterType("meeting")}>🤝 Client Meetings</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterType("standup")}>⚡ Daily Stand-ups</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterType("task_deadline")}>📅 Task Deadlines</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterType("milestone")}>🏁 Project Milestones</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterType("followup")}>🔔 Lead Follow-ups</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterType("leave")}>🏖️ Leaves / Absence</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Project Filter */}
          {projects.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 border-neutral-800 text-xs text-neutral-300 bg-neutral-900">
                  Project: {filterProject === "all" ? "All Projects" : projects.find((p) => p.id === filterProject)?.name || "Project"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#18191c] border-neutral-800 text-xs text-neutral-200">
                <DropdownMenuItem onClick={() => setFilterProject("all")}>All Projects</DropdownMenuItem>
                <DropdownMenuSeparator className="bg-neutral-800" />
                {projects.map((p) => (
                  <DropdownMenuItem key={p.id} onClick={() => setFilterProject(p.id)}>
                    {p.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* View Switcher & Date Controls */}
        <div className="flex items-center gap-3">
          {/* Today, Prev, Next */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleNav(0)}
              className="h-8 px-2.5 border-neutral-800 text-xs text-neutral-300 bg-neutral-900"
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleNav(-1)}
              className="h-8 w-8 p-0 text-neutral-400 hover:text-white"
            >
              ‹
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleNav(1)}
              className="h-8 w-8 p-0 text-neutral-400 hover:text-white"
            >
              ›
            </Button>
            <span className="text-sm font-semibold text-neutral-100 ml-1">{monthYearTitle}</span>
          </div>

          {/* Mode Switcher: Month, Week, Agenda */}
          <div className="flex p-0.5 rounded-lg bg-neutral-900 border border-neutral-800">
            <button
              onClick={() => setCalMode("month")}
              className={`px-2.5 py-1 text-xs rounded-md transition-all ${
                calMode === "month"
                  ? "bg-neutral-800 text-white font-medium"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setCalMode("week")}
              className={`px-2.5 py-1 text-xs rounded-md transition-all ${
                calMode === "week"
                  ? "bg-neutral-800 text-white font-medium"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setCalMode("agenda")}
              className={`px-2.5 py-1 text-xs rounded-md transition-all ${
                calMode === "agenda"
                  ? "bg-neutral-800 text-white font-medium"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Agenda
            </button>
          </div>
        </div>
      </div>

      {/* 3. CALENDAR BODY */}
      <div className="flex-1 flex flex-col p-4">
        {calMode === "agenda" ? (
          /* AGENDA / LIST VIEW (CAL-01) */
          <div className="max-w-4xl mx-auto w-full space-y-4">
            {filteredItems.length === 0 ? (
              <div className="p-12 text-center text-neutral-500 text-sm border border-neutral-800/60 rounded-xl bg-neutral-900/30">
                No events or tasks found for this view.
              </div>
            ) : (
              filteredItems.map((item) => {
                const visual = getItemVisual(item);
                const itemDateStr = new Date(item.startTime || item.endTime).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                });
                const timeStr = item.allDay
                  ? "All Day"
                  : `${new Date(item.startTime).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })} - ${new Date(item.endTime).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}`;

                return (
                  <div
                    key={item.id}
                    onClick={(e) => handleItemClick(item, e)}
                    className="p-3.5 rounded-xl bg-neutral-900/50 hover:bg-neutral-900 border border-neutral-800/80 transition-all flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border"
                        style={{
                          backgroundColor: `${visual.color}15`,
                          borderColor: `${visual.color}35`,
                        }}
                      >
                        {visual.icon}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-neutral-100">{item.title}</h4>
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase font-mono tracking-wider"
                            style={{ color: visual.color, borderColor: `${visual.color}40` }}
                          >
                            {visual.label}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-neutral-400 mt-1">
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="w-3.5 h-3.5 text-neutral-500" />
                            {itemDateStr}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-neutral-500" />
                            {timeStr}
                          </span>
                          {item.project && (
                            <span className="flex items-center gap-1 text-neutral-300">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: item.project.color }}
                              ></span>
                              {item.project.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.meetUrl && (
                        <Button
                          size="sm"
                          asChild
                          onClick={(e) => e.stopPropagation()}
                          className="h-7 text-xs bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30"
                        >
                          <a href={item.meetUrl} target="_blank" rel="noopener noreferrer">
                            <Video className="w-3 h-3 mr-1" />
                            Join
                          </a>
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-neutral-400">
                        Details ›
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* MONTH & WEEK GRID VIEWS */
          <div className="flex flex-col flex-1 border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950/60">
            {/* Days Header */}
            <div className="grid grid-cols-7 bg-neutral-900/80 border-b border-neutral-800 text-center py-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
              <div>Sun</div>
            </div>

            {/* Grid Days */}
            <div
              className={`grid grid-cols-7 gap-[1px] bg-neutral-800/40 flex-1 ${
                calMode === "week" ? "min-h-[500px]" : "min-h-[640px]"
              }`}
            >
              {calendarDays.map((day) => {
                const dayItems = itemsByDate.get(day.dateStr) || [];

                return (
                  <div
                    key={day.dateStr}
                    onClick={() => handleDayClick(day.dateStr)}
                    className={`bg-[#0e0f11] hover:bg-[#131417] p-2 flex flex-col gap-1 transition-colors relative cursor-pointer group ${
                      !day.isCurrentMonth ? "opacity-35 bg-neutral-950/80" : ""
                    } ${day.isToday ? "ring-1 ring-inset ring-indigo-500/50" : ""}`}
                  >
                    {/* Day Number Header */}
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs w-6 h-6 rounded-full flex items-center justify-center font-medium ${
                          day.isToday
                            ? "bg-indigo-600 text-white font-bold shadow-sm shadow-indigo-600/50"
                            : "text-neutral-400 group-hover:text-neutral-200"
                        }`}
                      >
                        {day.dayNumber}
                      </span>

                      {/* Add button on hover */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDayClick(day.dateStr);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-opacity text-xs"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Day Event Chips */}
                    <div className="space-y-1 overflow-y-auto max-h-36 flex-1">
                      {dayItems.slice(0, 4).map((item) => {
                        const visual = getItemVisual(item);
                        return (
                          <div
                            key={item.id}
                            onClick={(e) => handleItemClick(item, e)}
                            className={`p-1.5 rounded text-[11px] border truncate flex items-center gap-1.5 transition-all hover:scale-[1.01] ${visual.bg} ${visual.border}`}
                            title={item.title}
                          >
                            {visual.icon}
                            <span className="truncate font-medium text-neutral-200">{item.title}</span>
                          </div>
                        );
                      })}

                      {dayItems.length > 4 && (
                        <div className="text-[10px] text-neutral-500 px-1 font-medium">
                          +{dayItems.length - 4} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modals & Dialogs */}
      <EventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        teamId={teamId}
        defaultDate={selectedDateForNewEvent}
      />

      <StandupDialog
        open={standupDialogOpen}
        onOpenChange={setStandupDialogOpen}
        teamId={teamId}
      />

      <EventDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        event={selectedEvent}
        teamId={teamId}
      />
    </div>
  );
}
