"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
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
  Kanban,
  List,
  CalendarRange,
  Paperclip,
  Plus,
  Loader2,
} from "lucide-react";
import { useActiveTeam } from "@/lib/context/team-context";
import { useProjects, useCreateProject } from "@/lib/hooks/use-projects";
import { ProjectDialog } from "@/components/projects/project-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ProjectNavItem {
  id: string;
  name: string;
  key?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  dotColor?: string;
  hasLock?: boolean;
  status?: string;
}

function getProjectIconConfig(name: string, customColor?: string | null) {
  const lower = (name || "").toLowerCase();
  if (
    lower.includes("mobile") ||
    lower.includes("app") ||
    lower.includes("ios") ||
    lower.includes("android")
  ) {
    return {
      Icon: Smartphone,
      bg: "bg-[#1d294a]",
      color: "text-[#4d82f3]",
      hasLock: false,
    };
  }
  if (
    lower.includes("market") ||
    lower.includes("sales") ||
    lower.includes("campaign") ||
    lower.includes("growth")
  ) {
    return {
      Icon: Megaphone,
      bg: "bg-[#3c1e28]",
      color: "text-[#db4a79]",
      hasLock: false,
    };
  }
  if (
    lower.includes("launch") ||
    lower.includes("product") ||
    lower.includes("rocket") ||
    lower.includes("ship")
  ) {
    return {
      Icon: Rocket,
      bg: "bg-[#3a2717]",
      color: "text-[#d97706]",
      hasLock: false,
    };
  }
  if (
    lower.includes("design") ||
    lower.includes("system") ||
    lower.includes("ui") ||
    lower.includes("brand")
  ) {
    return {
      Icon: Component,
      bg: "bg-[#2e1d3d]",
      color: "text-[#a855f7]",
      hasLock: false,
    };
  }
  if (
    lower.includes("portal") ||
    lower.includes("customer") ||
    lower.includes("client") ||
    lower.includes("security")
  ) {
    return {
      Icon: Building2,
      bg: "bg-[#132d2c]",
      color: "text-[#14b8a6]",
      hasLock: true,
    };
  }
  // Default Globe or based on color
  return {
    Icon: Globe,
    bg: "bg-[#252243]",
    color: "text-[#7c82e6]",
    hasLock: false,
  };
}

export function SidebarProjects() {
  const { teamId } = useActiveTeam();
  const { data: realProjects = [], isLoading } = useProjects(teamId);
  const createProjectMutation = useCreateProject(teamId);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Create project dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Active project ID from search query
  const activeProjectId = searchParams.get("project");

  // Expanded project ID
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  // Starred IDs saved in localStorage
  const [starredIds, setStarredIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("sketchitup-starred-projects");
        if (saved) {
          setStarredIds(JSON.parse(saved));
        }
      } catch (err) {
        // ignore JSON parse error
      }
    }
  }, []);

  // Map real database projects to navigation items
  const projectsList = useMemo<ProjectNavItem[]>(() => {
    return realProjects.map((p) => {
      const iconConfig = getProjectIconConfig(p.name, p.color);
      return {
        id: p.id,
        name: p.name,
        key: p.key,
        icon: iconConfig.Icon,
        iconBg: iconConfig.bg,
        iconColor: iconConfig.color,
        dotColor: p.color || "#3b82f6",
        hasLock: iconConfig.hasLock,
        status: p.status,
      };
    });
  }, [realProjects]);

  // Keep expanded project in sync with active URL parameter
  useEffect(() => {
    if (activeProjectId) {
      setExpandedProjectId(activeProjectId);
    } else if (!expandedProjectId && projectsList.length > 0) {
      setExpandedProjectId(projectsList[0].id);
    }
  }, [activeProjectId, projectsList, expandedProjectId]);

  const toggleExpand = (projectId: string) => {
    setExpandedProjectId((prev) => (prev === projectId ? null : projectId));
  };

  const toggleStar = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setStarredIds((prev) => {
      const next = { ...prev, [projectId]: !prev[projectId] };
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            "sketchitup-starred-projects",
            JSON.stringify(next)
          );
        } catch (err) {
          // ignore storage error
        }
      }
      return next;
    });
  };

  const handleCreateProject = async (data: any) => {
    try {
      const created = await createProjectMutation.mutateAsync({
        ...data,
        teamId,
      });
      toast.success("Project created successfully");
      setCreateDialogOpen(false);
      if (created?.id) {
        setExpandedProjectId(created.id);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create project");
    }
  };

  const currentView = searchParams.get("view");
  const currentTab = searchParams.get("tab");
  const isArchivedActive = searchParams.get("status") === "archived";

  return (
    <>
      <div className="px-2 py-1.5 space-y-1">
        {/* Section Header */}
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-[11px] font-semibold tracking-wider text-neutral-400 uppercase select-none">
            PROJECTS
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setCreateDialogOpen(true)}
                className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                aria-label="Create new project"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              New Project
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Projects List */}
        <div className="space-y-0.5">
          {isLoading ? (
            <div className="px-3 py-2 space-y-2">
              <div className="h-6 w-full rounded bg-white/[0.04] animate-pulse" />
              <div className="h-6 w-3/4 rounded bg-white/[0.04] animate-pulse" />
            </div>
          ) : projectsList.length === 0 ? (
            <div className="px-3 py-2 text-xs text-neutral-400">
              <p className="text-[11px] text-neutral-500 mb-1.5">
                No projects created yet
              </p>
              <button
                type="button"
                onClick={() => setCreateDialogOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Project</span>
              </button>
            </div>
          ) : (
            projectsList.map((project) => {
              const isExpanded = expandedProjectId === project.id;
              const isStarred = !!starredIds[project.id];
              const isProjectActive = activeProjectId === project.id;
              const ProjectIcon = project.icon;

              return (
                <div key={project.id} className="flex flex-col">
                  {/* Project Row Button */}
                  <button
                    type="button"
                    onClick={() => {
                      toggleExpand(project.id);
                      router.push(`/dashboard/projects?project=${project.id}&view=board`);
                    }}
                    className={cn(
                      "group flex items-center justify-between w-full px-2 py-1.5 rounded-md text-xs transition-colors select-none text-left",
                      isExpanded || isProjectActive
                        ? "bg-white/[0.08] text-white"
                        : "text-neutral-300 hover:text-white hover:bg-white/[0.04]"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Icon container box */}
                      <div
                        className={cn(
                          "w-5 h-5 rounded flex items-center justify-center shrink-0 border border-white/[0.04]",
                          project.iconBg
                        )}
                      >
                        <ProjectIcon className={cn("w-3.5 h-3.5", project.iconColor)} />
                      </div>

                      {/* Name */}
                      <span
                        className={cn(
                          "truncate font-medium",
                          isExpanded || isProjectActive
                            ? "text-white"
                            : "text-neutral-300 group-hover:text-white"
                        )}
                      >
                        {project.name}
                      </span>
                    </div>

                    {/* Trailing Items: Star, Lock, Status Dot */}
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span
                        onClick={(e) => toggleStar(project.id, e)}
                        title={isStarred ? "Favorited" : "Favorite project"}
                        className="cursor-pointer p-0.5 rounded hover:bg-white/[0.1] transition-colors"
                      >
                        <Star
                          className={cn(
                            "w-3.5 h-3.5 transition-colors",
                            isStarred
                              ? "text-amber-400 fill-amber-400"
                              : "text-neutral-500 hover:text-neutral-300"
                          )}
                        />
                      </span>

                      {project.hasLock && (
                        <Lock className="w-3 h-3 text-neutral-400 shrink-0" />
                      )}

                      {project.dotColor && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: project.dotColor }}
                        />
                      )}
                    </div>
                  </button>

                  {/* Expanded Sub-Menu (Board, List, Timeline, Files) */}
                  {isExpanded && (
                    <div className="pl-6 pr-1 py-1 space-y-0.5">
                      {/* Board */}
                      <Link
                        href={`/dashboard/projects?project=${project.id}&view=board`}
                        className={cn(
                          "group flex items-center gap-2.5 px-2 py-1.5 rounded text-xs transition-colors",
                          pathname === "/dashboard/projects" &&
                            currentView === "board" &&
                            activeProjectId === project.id
                            ? "bg-white/[0.08] text-white font-medium"
                            : "text-neutral-400 hover:text-white hover:bg-white/[0.04]"
                        )}
                      >
                        <Kanban className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white shrink-0" />
                        <span>Board</span>
                      </Link>

                      {/* List */}
                      <Link
                        href={`/dashboard/projects?project=${project.id}&view=list`}
                        className={cn(
                          "group flex items-center gap-2.5 px-2 py-1.5 rounded text-xs transition-colors",
                          pathname === "/dashboard/projects" &&
                            (currentView === "list" || (!currentView && !currentTab)) &&
                            activeProjectId === project.id
                            ? "bg-white/[0.08] text-white font-medium"
                            : "text-neutral-400 hover:text-white hover:bg-white/[0.04]"
                        )}
                      >
                        <List className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white shrink-0" />
                        <span>List</span>
                      </Link>

                      {/* Timeline */}
                      <Link
                        href={`/dashboard/projects?project=${project.id}&view=timeline`}
                        className={cn(
                          "group flex items-center gap-2.5 px-2 py-1.5 rounded text-xs transition-colors",
                          pathname === "/dashboard/projects" &&
                            currentView === "timeline" &&
                            activeProjectId === project.id
                            ? "bg-white/[0.08] text-white font-medium"
                            : "text-neutral-400 hover:text-white hover:bg-white/[0.04]"
                        )}
                      >
                        <CalendarRange className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white shrink-0" />
                        <span>Timeline</span>
                      </Link>

                      {/* Files */}
                      <Link
                        href={`/dashboard/projects?project=${project.id}&tab=files`}
                        className={cn(
                          "group flex items-center gap-2.5 px-2 py-1.5 rounded text-xs transition-colors",
                          pathname === "/dashboard/projects" &&
                            currentTab === "files" &&
                            activeProjectId === project.id
                            ? "bg-white/[0.08] text-white font-medium"
                            : "text-neutral-400 hover:text-white hover:bg-white/[0.04]"
                        )}
                      >
                        <Paperclip className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white shrink-0" />
                        <span>Files</span>
                      </Link>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Archive Item */}
          <Link
            href="/dashboard/projects?status=archived"
            className={cn(
              "group flex items-center justify-between w-full px-2 py-1.5 rounded-md text-xs transition-colors select-none",
              isArchivedActive
                ? "bg-white/[0.08] text-white"
                : "text-neutral-400 hover:text-white hover:bg-white/[0.04]"
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-5 h-5 rounded flex items-center justify-center shrink-0">
                <Archive className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-200" />
              </div>
              <span className="truncate">Archive</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Create Project Dialog */}
      <ProjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateProject}
      />
    </>
  );
}
