"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Sidebar,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Home,
  Inbox,
  CheckCircle2,
  Users,
  Calendar,
  ListTodo,
  FolderKanban,
  CalendarRange,
  Search,
  Moon,
  Sun,
  FileText,
  SlidersHorizontal,
  Key,
  Plus,
  PanelLeftClose,
  ShieldAlert,
  Target,
  MessageSquare,
  BarChart3,
  Workflow,
  CreditCard,
  Package,
} from "lucide-react";
import IconFiles from "@/components/ui/IconFiles";
import IconSquareChartLine from "@/components/ui/IconSquareChartLine";
import IconGearKeyhole from "@/components/ui/IconGearKeyhole";
import { useActiveTeam } from "@/lib/context/team-context";
import { useProjects, useCreateProject } from "@/lib/hooks/use-projects";
import { useInboxUnreadCount } from "@/lib/hooks/use-inbox";
import { ProjectDialog } from "@/components/projects/project-dialog";
import { authClient } from "@/lib/auth-client";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type NavigationItem = {
  name: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  type: "item" | "label";
  action?: () => void;
  badge?: number | string;
};

export const navigationItems = (openApiKeyDialog: () => void): NavigationItem[] => [
  {
    name: "Overview",
    href: "/dashboard",
    icon: Home,
    type: "item",
  },
  {
    name: "Inbox",
    href: "/dashboard/inbox",
    icon: Inbox,
    type: "item",
  },
  {
    name: "My Tasks",
    href: "/dashboard/my-tasks",
    icon: CheckCircle2,
    type: "item",
  },
  {
    name: "Issues",
    href: "/dashboard/issues",
    icon: IconFiles,
    type: "item",
  },
  {
    name: "Calendar",
    href: "/dashboard/calendar",
    icon: Calendar,
    type: "item",
  },
  {
    name: "CRM & Leads",
    href: "/dashboard/crm",
    icon: Target,
    type: "item",
  },
  {
    name: "Analytics & Reports",
    href: "/dashboard/reports",
    icon: BarChart3,
    type: "item",
  },
  {
    name: "Automations & Flows",
    href: "/dashboard/flows",
    icon: Workflow,
    type: "item",
  },
  {
    name: "Finance & Billing",
    href: "/dashboard/finance",
    icon: CreditCard,
    type: "item",
  },
  {
    name: "SaaS Products & IP",
    href: "/dashboard/products",
    icon: Package,
    type: "item",
  },
  {
    name: "Members",
    href: "/dashboard/members",
    icon: Users,
    type: "item",
  },
  {
    type: "label",
    name: "Teams",
  },
  {
    name: "Team Space & Chat",
    href: "/dashboard/team",
    icon: MessageSquare,
    type: "item",
  },
  {
    name: "Team Tasks",
    href: "/dashboard/team-tasks",
    icon: ListTodo,
    type: "item",
  },
  {
    name: "Team Projects",
    href: "/dashboard/projects",
    icon: FolderKanban,
    type: "item",
  },
  {
    name: "Team Timeline",
    href: "/dashboard/projects?view=timeline",
    icon: CalendarRange,
    type: "item",
  },
  {
    type: "label",
    name: "Support",
  },
  {
    name: "Audit log",
    href: "/dashboard/management",
    icon: FileText,
    type: "item",
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: SlidersHorizontal,
    type: "item",
  },
  {
    name: "API Keys",
    icon: Key,
    type: "item",
    action: openApiKeyDialog,
  },
];

// Curated colors for project letter squares matching the screenshot aesthetic
const AGENT_COLORS = [
  "#22c55e", // green (Support Triage)
  "#f97316", // orange (Lead Enrichment)
  "#f43f5e", // rose/pink (Refund Desk)
  "#3b82f6", // blue (Outbound SDR)
  "#a855f7", // purple (PR Reviewer)
  "#ea580c", // dark orange (Hotfix Runner)
  "#84cc16", // lime green (Invoice Chaser)
  "#0ea5e9", // sky blue (Churn Sentinel)
];

function getProjectColor(project: any, index: number): string {
  if (project.color && project.color !== "#6366f1") {
    return project.color;
  }
  return AGENT_COLORS[index % AGENT_COLORS.length];
}

function getStatusDotColor(status?: string | null, index: number = 0): string {
  if (status === "active" || !status) return "#22c55e"; // green dot
  if (status === "in_progress" || status === "warning") return "#f59e0b"; // amber dot
  if (status === "completed" || status === "archived") return "#737373"; // gray dot
  const defaults = ["#22c55e", "#22c55e", "#22c55e", "#22c55e", "#22c55e", "#f59e0b", "#22c55e", "#737373"];
  return defaults[index % defaults.length];
}

export function DashboardAppSidebar({
  items,
}: {
  items: NavigationItem[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { teamId, team, loading: teamLoading } = useActiveTeam();
  const { data: session } = authClient.useSession();
  const { state, isMobile, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed" && !isMobile;

  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<"dark" | "light">("dark");

  const hasTeam = !teamLoading && Boolean(teamId && team);
  const { data: projects = [] } = useProjects(teamId);
  const createProject = useCreateProject(teamId);
  const { data: unreadData } = useInboxUnreadCount();

  // Group items into sections
  const missionItems = useMemo(() => {
    return items
      .filter((item) => {
        if (item.type === "label") return false;
        return [
          "/dashboard",
          "/dashboard/inbox",
          "/dashboard/my-tasks",
          "/dashboard/issues",
          "/dashboard/calendar",
          "/dashboard/members",
        ].includes(item.href || "");
      })
      .map((item) => {
        if (item.href === "/dashboard/inbox" && unreadData?.count && unreadData.count > 0) {
          return { ...item, badge: unreadData.count };
        }
        return item;
      });
  }, [items, unreadData?.count]);

  const teamItems = useMemo(() => {
    return items.filter((item) => {
      if (item.type === "label") return false;
      return [
        "/dashboard/team",
        "/dashboard/team-tasks",
        "/dashboard/projects",
        "/dashboard/projects?view=timeline",
      ].includes(item.href || "");
    });
  }, [items]);

  const supportItems = useMemo(() => {
    return items.filter((item) => {
      if (item.type === "label") return false;
      return (
        item.href === "/dashboard/management" ||
        item.name === "Settings" ||
        item.action !== undefined
      );
    });
  }, [items]);

  // User initials (e.g. DW)
  const userInitials = useMemo(() => {
    if (session?.user?.name) {
      const parts = session.user.name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return session.user.name.slice(0, 2).toUpperCase();
    }
    if (team?.name) {
      return team.name.slice(0, 2).toUpperCase();
    }
    return "DW";
  }, [session?.user?.name, team?.name]);

  // Subtitle (e.g. Coastline Software · Ops)
  const orgSubtitle = useMemo(() => {
    const org = team?.name || "Coastline Software";
    const unit = team?.key || "Ops";
    return `${org} · ${unit}`;
  }, [team?.name, team?.key]);

  // Quick search / AI Assistant opener
  const handleOpenSearch = () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "k",
        metaKey: true,
        ctrlKey: true,
      })
    );
  };

  const handleCreateProject = async (data: any) => {
    try {
      await createProject.mutateAsync(data);
      toast.success("Project created successfully");
      setCreateProjectOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to create project");
    }
  };

  const isItemActive = (item: NavigationItem) => {
    const currentView = searchParams.get("view");
    const isTimelineItem = item.href === "/dashboard/projects?view=timeline";
    const isProjectsItem = item.href === "/dashboard/projects";

    if (item.href === "/dashboard") {
      return pathname === "/dashboard";
    }
    if (isTimelineItem) {
      return pathname === "/dashboard/projects" && currentView === "timeline";
    }
    if (isProjectsItem) {
      return (
        pathname === "/dashboard/projects" &&
        currentView !== "timeline" &&
        !searchParams.get("project")
      );
    }
    if (item.href) {
      return pathname === item.href || pathname.startsWith(`${item.href}/`);
    }
    return false;
  };

  return (
    <>
      <Sidebar
        collapsible="icon"
        variant="floating"
        className="z-20 p-2 bg-transparent border-none [&_[data-sidebar=sidebar]]:rounded-[24px] [&_[data-sidebar=sidebar]]:bg-[#141416] [&_[data-sidebar=sidebar]]:border [&_[data-sidebar=sidebar]]:border-white/[0.08] [&_[data-sidebar=sidebar]]:shadow-2xl [&_[data-sidebar=sidebar]]:overflow-hidden"
        style={
          {
            "--sidebar-width": "17.5rem",
            "--sidebar-width-icon": "4.5rem",
          } as React.CSSProperties
        }
      >
        <TooltipProvider delayDuration={150}>
          {isCollapsed ? (
            /* ========================================================= */
            /* COLLAPSED ICON RAIL (Matches Left Column in Screenshot)   */
            /* ========================================================= */
            <div className="flex flex-col h-full w-full py-3 px-1.5 items-center justify-between select-none">
              {/* Top: DW Avatar Badge & Search */}
              <div className="flex flex-col items-center gap-3 w-full">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={toggleSidebar}
                      className="w-9 h-9 rounded-xl bg-white text-neutral-900 font-bold flex items-center justify-center text-xs shadow-xs hover:scale-105 active:scale-95 transition-all"
                    >
                      {userInitials}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <span>
                      {session?.user?.name || "Workspace"} ({orgSubtitle})
                    </span>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleOpenSearch}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                    >
                      <Search className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <span>Search (⌘ F)</span>
                  </TooltipContent>
                </Tooltip>

                <div className="w-5 h-px bg-white/[0.08] my-0.5" />
              </div>

              {/* Middle: Mission + Projects + Support Icons */}
              <div className="flex-1 w-full flex flex-col items-center gap-1.5 overflow-y-auto no-scrollbar py-1">
                {/* Mission Icons */}
                {missionItems.map((item) => {
                  const active = isItemActive(item);
                  const Icon = item.icon || Home;
                  const hasBadge = item.badge !== undefined;

                  return (
                    <Tooltip key={item.name}>
                      <TooltipTrigger asChild>
                        <Link
                          href={item.href || "/dashboard"}
                          className={cn(
                            "relative w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                            active
                              ? "bg-[#252528] text-white shadow-xs"
                              : "text-neutral-400 hover:text-white hover:bg-white/[0.04]"
                          )}
                        >
                          <Icon className="w-4 h-4" />
                          {hasBadge && (
                            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
                          )}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <span>
                          {item.name} {hasBadge ? `(${item.badge})` : ""}
                        </span>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}

                <div className="w-5 h-px bg-white/[0.08] my-1" />

                {/* Team Space & Chat Icon */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href="/dashboard/team"
                      className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                        pathname === "/dashboard/team"
                          ? "bg-[#252528] text-white shadow-xs"
                          : "text-neutral-400 hover:text-white hover:bg-white/[0.04]"
                      )}
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <span>Team Space & Chat</span>
                  </TooltipContent>
                </Tooltip>

                {/* Team Tasks Icon */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href="/dashboard/team-tasks"
                      className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                        pathname === "/dashboard/team-tasks"
                          ? "bg-[#252528] text-white shadow-xs"
                          : "text-neutral-400 hover:text-white hover:bg-white/[0.04]"
                      )}
                    >
                      <ListTodo className="w-4 h-4" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <span>Team Tasks</span>
                  </TooltipContent>
                </Tooltip>

                {/* Colored Square Letter Badges for Projects */}
                {projects.slice(0, 8).map((project, idx) => {
                  const letter = project.name?.trim().charAt(0).toUpperCase() || "P";
                  const color = getProjectColor(project, idx);
                  const isProjActive =
                    pathname === "/dashboard/projects" &&
                    searchParams.get("project") === project.id;

                  return (
                    <Tooltip key={project.id}>
                      <TooltipTrigger asChild>
                        <Link
                          href={`/dashboard/projects?project=${project.id}`}
                          className={cn(
                            "w-6 h-6 rounded-[6px] text-white font-bold text-[11px] flex items-center justify-center shadow-xs transition-transform hover:scale-110",
                            isProjActive && "ring-2 ring-white/60"
                          )}
                          style={{ backgroundColor: color }}
                        >
                          {letter}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <span>{project.name}</span>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}

                <div className="w-5 h-px bg-white/[0.08] my-1" />

                {/* Support Icons */}
                {supportItems.map((item) => {
                  const active = isItemActive(item);
                  const Icon = item.icon || FileText;

                  if (item.action && !item.href) {
                    return (
                      <Tooltip key={item.name}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={item.action}
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/[0.04] transition-colors"
                          >
                            <Icon className="w-4 h-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <span>{item.name}</span>
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return (
                    <Tooltip key={item.name}>
                      <TooltipTrigger asChild>
                        <Link
                          href={item.href || "/dashboard/management"}
                          className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                            active
                              ? "bg-[#252528] text-white shadow-xs"
                              : "text-neutral-400 hover:text-white hover:bg-white/[0.04]"
                          )}
                        >
                          <Icon className="w-4 h-4" />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <span>{item.name}</span>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>

              {/* Bottom: Moon Theme Toggle */}
              <div className="pt-2 flex flex-col items-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        toast.info("Dark mode active (Default workspace theme)");
                      }}
                      className="w-8 h-8 rounded-full bg-[#1c1d21] border border-white/[0.08] flex items-center justify-center text-neutral-300 hover:text-white transition-colors"
                    >
                      <Moon className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <span>Dark Appearance</span>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          ) : (
            /* ========================================================= */
            /* FULL EXPANDED SIDEBAR (Matches Right Panel in Screenshot) */
            /* ========================================================= */
            <div className="flex flex-col h-full w-full p-3.5 justify-between select-none">
              {/* TOP HEADER */}
              <div className="space-y-3 shrink-0">
                {/* Brand Title Row: SketchItUp OS */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-semibold text-white text-base tracking-tight">
                      SketchItUp OS
                    </span>
                  </div>
                  {!isMobile && (
                    <button
                      onClick={toggleSidebar}
                      className="p-1 rounded-md text-neutral-500 hover:text-white hover:bg-white/[0.04] transition-colors"
                      title="Collapse sidebar"
                    >
                      <PanelLeftClose className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Profile / Workspace Card: DW Dana Whitfield */}
                <div className="flex items-center gap-2.5 px-1 py-0.5">
                  <div className="w-9 h-9 rounded-xl bg-white text-neutral-900 font-bold flex items-center justify-center text-xs shadow-xs shrink-0 select-none">
                    {userInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-medium text-sm leading-tight truncate">
                      {session?.user?.name || "Dana Whitfield"}
                    </div>
                    <div className="text-neutral-500 text-xs leading-tight truncate mt-0.5">
                      {orgSubtitle}
                    </div>
                  </div>
                </div>

                {/* Search Bar: Search ⌘ F */}
                <div
                  onClick={handleOpenSearch}
                  className="bg-[#1f2024] hover:bg-[#25262c] border border-white/[0.06] rounded-xl px-3 py-2 flex items-center justify-between text-xs text-neutral-400 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-200 shrink-0" />
                    <span className="text-neutral-400 group-hover:text-neutral-200">
                      Search
                    </span>
                  </div>
                  <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-neutral-400 border border-white/[0.06] font-medium">
                    ⌘ F
                  </kbd>
                </div>
              </div>

              {/* SCROLLABLE SECTIONS */}
              <div className="flex-1 overflow-y-auto no-scrollbar py-2.5 space-y-4">
                {/* SECTION 1: Mission */}
                <div>
                  <div className="text-[12px] font-normal text-neutral-500 px-2 py-1 tracking-normal">
                    Modules
                  </div>
                  <div className="space-y-0.5 mt-0.5">
                    {missionItems.map((item) => {
                      const active = isItemActive(item);
                      const Icon = item.icon || Home;
                      const hasBadge = item.badge !== undefined;

                      return (
                        <Link
                          key={item.name}
                          href={item.href || "/dashboard"}
                          className={cn(
                            "rounded-xl px-3 py-2 flex items-center justify-between text-sm transition-colors group",
                            active
                              ? "bg-[#252528] text-white font-medium shadow-xs"
                              : "text-neutral-400 hover:text-white hover:bg-white/[0.04] font-normal"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Icon
                              className={cn(
                                "w-4 h-4 shrink-0 transition-colors",
                                active
                                  ? "text-white"
                                  : "text-neutral-400 group-hover:text-white"
                              )}
                            />
                            <span className="truncate">{item.name}</span>
                          </div>
                          {hasBadge && (
                            <span className="bg-[#222328] text-neutral-300 text-xs px-2 py-0.5 rounded-full font-medium border border-white/[0.06]">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>

                {/* SECTION 2: Agents (Projects & Teams) */}
                <div>
                  <div className="text-[12px] font-normal text-neutral-500 px-2 py-1 tracking-normal flex items-center justify-between">
                    <span>Team</span>
                    {hasTeam && (
                      <button
                        onClick={() => setCreateProjectOpen(true)}
                        className="p-1 rounded text-neutral-500 hover:text-white hover:bg-white/[0.06] transition-colors"
                        title="Create Project"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* If user not added to teams */}
                  {!hasTeam && !teamLoading && (
                    <div className="px-3 py-2 my-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300/90 flex items-center gap-2">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                      <span>You have not been added to teams</span>
                    </div>
                  )}

                  {/* Core Team Links */}
                  <div className="space-y-0.5 mt-0.5">
                    {teamItems.map((item) => {
                      const active = isItemActive(item);
                      const Icon = item.icon || FolderKanban;

                      if (!hasTeam && !teamLoading) {
                        return (
                          <button
                            key={item.name}
                            onClick={() => toast.error("You have not been added to teams")}
                            className="w-full rounded-xl px-3 py-2 flex items-center justify-between text-xs text-neutral-500 hover:bg-white/[0.02] transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              <Icon className="w-4 h-4 shrink-0 text-neutral-600" />
                              <span>{item.name}</span>
                            </div>
                          </button>
                        );
                      }

                      return (
                        <Link
                          key={item.name}
                          href={item.href || "/dashboard/projects"}
                          className={cn(
                            "rounded-xl px-3 py-1.5 flex items-center justify-between text-xs transition-colors group",
                            active
                              ? "bg-[#252528] text-white font-medium"
                              : "text-neutral-400 hover:text-white hover:bg-white/[0.04]"
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon
                              className={cn(
                                "w-4 h-4 shrink-0 transition-colors",
                                active
                                  ? "text-white"
                                  : "text-neutral-400 group-hover:text-white"
                              )}
                            />
                            <span className="truncate">{item.name}</span>
                          </div>
                        </Link>
                      );
                    })}

                    {/* Colored Square Letter Project Items (Matches S, L, R, O, P, H, I, C in Screenshot) */}
                    {projects.map((project, idx) => {
                      const isProjActive =
                        pathname === "/dashboard/projects" &&
                        searchParams.get("project") === project.id;
                      const letter = project.name?.trim().charAt(0).toUpperCase() || "P";
                      const color = getProjectColor(project, idx);
                      const dotColor = getStatusDotColor(project.status, idx);

                      return (
                        <Link
                          key={project.id}
                          href={`/dashboard/projects?project=${project.id}`}
                          className={cn(
                            "rounded-xl px-3 py-1.5 flex items-center justify-between text-xs transition-colors group cursor-pointer",
                            isProjActive
                              ? "bg-[#252528] text-white font-medium"
                              : "text-neutral-400 hover:text-white hover:bg-white/[0.04]"
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-5 h-5 rounded-[6px] text-white font-bold text-[11px] flex items-center justify-center shrink-0 shadow-xs"
                              style={{ backgroundColor: color }}
                            >
                              {letter}
                            </span>
                            <span className="text-neutral-300 group-hover:text-white text-xs truncate font-normal">
                              {project.name}
                            </span>
                          </div>
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: dotColor }}
                          />
                        </Link>
                      );
                    })}

                    {projects.length === 0 && hasTeam && (
                      <button
                        onClick={() => setCreateProjectOpen(true)}
                        className="w-full text-left rounded-xl px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.02] flex items-center gap-2"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add first project</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* SECTION 3: Support */}
                <div>
                  <div className="text-[12px] font-normal text-neutral-500 px-2 py-1 tracking-normal">
                    Management
                  </div>
                  <div className="space-y-0.5 mt-0.5">
                    {supportItems.map((item) => {
                      const active = isItemActive(item);
                      const Icon = item.icon || FileText;

                      if (item.action && !item.href) {
                        return (
                          <button
                            key={item.name}
                            onClick={item.action}
                            className="w-full rounded-xl px-3 py-2 flex items-center justify-between text-sm text-neutral-400 hover:text-white hover:bg-white/[0.04] transition-colors group text-left"
                          >
                            <div className="flex items-center gap-3">
                              <Icon className="w-4 h-4 text-neutral-400 group-hover:text-white shrink-0" />
                              <span>{item.name}</span>
                            </div>
                          </button>
                        );
                      }

                      return (
                        <Link
                          key={item.name}
                          href={item.href || "/dashboard/management"}
                          className={cn(
                            "rounded-xl px-3 py-2 flex items-center justify-between text-sm transition-colors group",
                            active
                              ? "bg-[#252528] text-white font-medium shadow-xs"
                              : "text-neutral-400 hover:text-white hover:bg-white/[0.04] font-normal"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Icon
                              className={cn(
                                "w-4 h-4 shrink-0 transition-colors",
                                active
                                  ? "text-white"
                                  : "text-neutral-400 group-hover:text-white"
                              )}
                            />
                            <span className="truncate">{item.name}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* BOTTOM: Appearance Row */}
              <div className="border-t border-white/[0.06] pt-3 mt-auto px-1 flex items-center justify-between shrink-0">
                <span className="text-xs text-neutral-500 font-normal">
                  Appearance
                </span>
                <div className="bg-[#1c1d21] border border-white/[0.06] p-0.5 rounded-full flex items-center gap-0.5">
                  <button
                    onClick={() => {
                      setThemeMode("dark");
                      toast.info("Dark mode active");
                    }}
                    className={cn(
                      "p-1 rounded-full transition-colors",
                      themeMode === "dark"
                        ? "bg-[#2a2b30] text-white shadow-xs"
                        : "text-neutral-500 hover:text-neutral-300"
                    )}
                    title="Dark mode"
                  >
                    <Moon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      toast.info("Dark mode is the default palette");
                    }}
                    className={cn(
                      "p-1 rounded-full transition-colors",
                      themeMode === "light"
                        ? "bg-[#2a2b30] text-white shadow-xs"
                        : "text-neutral-500 hover:text-neutral-300"
                    )}
                    title="Light mode"
                  >
                    <Sun className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </TooltipProvider>
      </Sidebar>

      {/* Project Creation Dialog */}
      <ProjectDialog
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
        onSubmit={handleCreateProject}
      />
    </>
  );
}
