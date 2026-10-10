"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  UserPlus,
  Search,
  MoreHorizontal,
  ChevronDown,
  Shield,
  Crown,
  Check,
  Trash2,
  Mail,
  Copy,
  ExternalLink,
  RefreshCw,
  FolderKanban,
  CheckCircle2,
  Layers,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { useActiveTeam } from "@/lib/context/team-context";
import { useTeamMembers, useTeamInvitations } from "@/lib/hooks/use-team-data";
import { useProjects } from "@/lib/hooks/use-projects";
import { useIssues } from "@/lib/hooks/use-issues";
import { authClient } from "@/lib/auth-client";
import { useAccess } from "@/lib/hooks/use-access";
import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Deterministic vibrant avatar background color generator
const AVATAR_COLORS = [
  "#5A67D8",
  "#C54B78",
  "#3B82C4",
  "#23918A",
  "#C48A1E",
  "#8662C9",
  "#3D8E5F",
  "#C0612B",
  "#E11D48",
  "#0D9488",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function getInitials(name?: string | null): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function MembersView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { teamId, team, loading: teamLoading } = useActiveTeam();
  const { data: session } = authClient.useSession();

  // Real backend queries
  const { data: members = [], isLoading: membersLoading } = useTeamMembers(teamId);
  const { data: invitations = [], isLoading: invitationsLoading } = useTeamInvitations(teamId);
  const { data: projects = [] } = useProjects(teamId);
  const { data: issues = [] } = useIssues(teamId);

  const { can } = useAccess();
  const hasAccessManagement = can(AppModule.EMPLOYEES, AccessLevel.VIEW);

  // UI state
  const [activeTab, setActiveTab] = useState<"members" | "teams" | "roles">("members");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("all");

  // Invite dialog
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [isInviting, setIsInviting] = useState(false);

  // Remove confirmation dialog
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<any | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Team display name
  const teamName = team?.name || "Workspace";

  // Compute stats per member (active projects and tasks)
  const memberStats = useMemo(() => {
    const stats: Record<string, { projectsCount: number; tasksCount: number }> = {};

    members.forEach((m: any) => {
      const uid = m.userId;
      const uname = m.userName;

      // Real assigned tasks from issues
      const assignedIssues = issues.filter(
        (i) => i.assigneeId === uid || (uname && i.assignee === uname)
      );
      const tasksCount = assignedIssues.length;

      // Real active projects (projects that have tasks assigned to this member or where member is lead)
      const projectIdsWithTasks = new Set(
        assignedIssues.map((i) => i.projectId).filter(Boolean)
      );
      projects.forEach((p) => {
        if (p.leadId === uid) {
          projectIdsWithTasks.add(p.id);
        }
      });
      const projectsCount = projectIdsWithTasks.size;

      stats[m.id] = {
        projectsCount,
        tasksCount,
      };
    });

    return stats;
  }, [members, issues, projects]);

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return members.filter((m: any) => {
      // Role filter
      if (selectedRoleFilter !== "all") {
        const userRole = (m.role || "member").toLowerCase();
        if (userRole !== selectedRoleFilter.toLowerCase()) {
          return false;
        }
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = m.userName?.toLowerCase().includes(q);
        const matchEmail = m.userEmail?.toLowerCase().includes(q);
        if (!matchName && !matchEmail) return false;
      }

      return true;
    });
  }, [members, selectedRoleFilter, searchQuery]);

  // Filtered invitations list
  const filteredInvitations = useMemo(() => {
    return invitations.filter((inv: any) => {
      if (selectedRoleFilter !== "all") {
        const invRole = (inv.role || "member").toLowerCase();
        if (invRole !== selectedRoleFilter.toLowerCase()) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!inv.email?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [invitations, selectedRoleFilter, searchQuery]);

  // Handle send invitation
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteEmail.includes("@")) {
      toast.error("Please provide a valid email address");
      return;
    }

    try {
      setIsInviting(true);
      const res = await fetch(`/api/teams/${teamId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole.toLowerCase(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send invitation");
      }

      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setInviteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["invitations", teamId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to send invitation");
    } finally {
      setIsInviting(false);
    }
  };

  // Handle update member role
  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          role: newRole.toLowerCase(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update member role");
      }

      toast.success(`Role updated to ${newRole}`);
      queryClient.invalidateQueries({ queryKey: ["members", teamId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    }
  };

  // Handle remove member
  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    try {
      setIsRemoving(true);
      const res = await fetch(
        `/api/teams/${teamId}/members?memberId=${memberToRemove.id}`,
        { method: "DELETE" }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to remove member");
      }

      toast.success(`${memberToRemove.userName || "Member"} removed from team`);
      setRemoveDialogOpen(false);
      setMemberToRemove(null);
      queryClient.invalidateQueries({ queryKey: ["members", teamId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to remove member");
    } finally {
      setIsRemoving(false);
    }
  };

  // Handle cancel invitation
  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const res = await fetch(
        `/api/teams/${teamId}/invitations?invitationId=${invitationId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        throw new Error("Failed to cancel invitation");
      }
      toast.success("Invitation cancelled");
      queryClient.invalidateQueries({ queryKey: ["invitations", teamId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel invitation");
    }
  };

  // Helper for member role badge
  const formatRole = (role?: string) => {
    if (!role) return "Member";
    const lower = role.toLowerCase();
    if (lower === "owner" || lower === "admin") {
      return lower === "owner" ? "Owner" : "Admin";
    }
    if (lower === "guest") return "Guest";
    return "Member";
  };

  return (
    <div
      className="content w-full min-h-screen bg-[#0e0f11] text-neutral-200"
      id="main-content"
      tabIndex={-1}
      data-keep="c:members:::"
    >
      <div className="page wide max-w-[1200px] mx-auto p-6 lg:p-8">
        {/* 1. Header (.ph) */}
        <div className="ph flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Members</h1>
            <p className="text-xs text-neutral-400 mt-1">
              {members.length} {members.length === 1 ? "person" : "people"} in {teamName}
              {invitations.length > 0 && ` · ${invitations.length} pending`}
            </p>
          </div>
        </div>

        {/* Access Management Banner */}
        <div className="my-4 p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-neutral-200">
            <Shield className="w-4 h-4 text-primary shrink-0" />
            <span>
              Employee accounts and roles are managed in{" "}
              {hasAccessManagement ? (
                <Link
                  href="/dashboard/access-management"
                  className="text-primary hover:underline font-semibold"
                >
                  Access Management
                </Link>
              ) : (
                <span className="font-semibold text-white">Access Management</span>
              )}
              .
            </span>
          </div>
          {hasAccessManagement && (
            <Link href="/dashboard/access-management">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/15 shrink-0"
              >
                <span>Open Access Management</span>
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          )}
        </div>

        {/* 2. Tabs (.tabs) */}
        <div className="tabs flex items-center gap-1 border-b border-white/[0.08] my-4">
          <button
            type="button"
            onClick={() => setActiveTab("members")}
            className={cn(
              "tab px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px",
              activeTab === "members"
                ? "border-primary text-white font-semibold"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            )}
            data-a="set"
            data-k="membersTab"
            data-v="members"
          >
            Members
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("teams")}
            className={cn(
              "tab px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px",
              activeTab === "teams"
                ? "border-primary text-white font-semibold"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            )}
            data-a="set"
            data-k="membersTab"
            data-v="teams"
          >
            Teams
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("roles")}
            className={cn(
              "tab px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px",
              activeTab === "roles"
                ? "border-primary text-white font-semibold"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            )}
            data-a="set"
            data-k="membersTab"
            data-v="roles"
          >
            Roles &amp; permissions
          </button>
        </div>

        {/* === TAB 1: MEMBERS VIEW === */}
        {activeTab === "members" && (
          <>
            {/* 3. Filter Row (.row) */}
            <div className="row flex items-center justify-between gap-3 mb-4 flex-wrap">
              {/* Search input (.inwrap) */}
              <div className="inwrap relative flex items-center min-w-[240px] sm:min-w-[280px] bg-[#14161a] border border-white/[0.08] rounded-md px-2.5 py-1 text-xs text-white focus-within:border-white/25 transition-colors">
                <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0 mr-2" />
                <input
                  className="input search-sm bg-transparent border-none outline-none text-xs text-white placeholder:text-neutral-500 w-full"
                  id="mem-q"
                  data-in="memQ"
                  placeholder="Search by name or email"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search members"
                />
              </div>

              {/* Segmented Role Controls (.seg) */}
              <div className="seg inline-flex items-center p-0.5 rounded-lg bg-[#14161a] border border-white/[0.08] text-xs">
                {(["all", "Owner", "Admin", "Member", "Guest"] as const).map((roleVal) => {
                  const isSelected = selectedRoleFilter.toLowerCase() === roleVal.toLowerCase();
                  return (
                    <button
                      key={roleVal}
                      type="button"
                      onClick={() => setSelectedRoleFilter(roleVal)}
                      className={cn(
                        "px-2.5 py-1 rounded text-xs transition-colors",
                        isSelected
                          ? "bg-white/[0.1] text-white font-medium"
                          : "text-neutral-400 hover:text-white hover:bg-white/[0.04]"
                      )}
                      data-a="set"
                      data-k="memRole"
                      data-v={roleVal}
                    >
                      {roleVal === "all" ? "All" : roleVal}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Members Table Panel (.panel) */}
            <div className="panel bg-[#121418] border border-white/[0.08] rounded-xl overflow-x-auto shadow-sm">
              <table className="perm-t w-full min-w-[880px] text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                    <th className="py-3 px-4 pl-4 text-left">Member</th>
                    <th className="py-3 px-4 text-left">Role</th>
                    <th className="py-3 px-4 text-left">Team</th>
                    <th className="py-3 px-4 text-center">Active projects</th>
                    <th className="py-3 px-4 text-center">Tasks</th>
                    <th className="py-3 px-4 text-left">Last active</th>
                    <th className="py-3 px-4 text-left">Status</th>
                    <th className="py-3 px-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {/* Real Members Rows */}
                  {filteredMembers.map((member: any) => {
                    const isCurrentUser = session?.user?.id === member.userId;
                    const roleLabel = formatRole(member.role);
                    const isOwner = roleLabel === "Owner";
                    const avatarColor = getAvatarColor(member.userName || member.userEmail || "U");
                    const stats = memberStats[member.id] || { projectsCount: 0, tasksCount: 0 };

                    return (
                      <tr
                        key={member.id}
                        data-ctx="member"
                        data-id={member.id}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        {/* Member Name + Email + Avatar */}
                        <td className="py-3 px-4 pl-4">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="av md w-7 h-7 rounded-full text-[11px] font-semibold flex items-center justify-center text-white shrink-0 border border-white/10"
                              style={{ backgroundColor: avatarColor }}
                              aria-label={member.userName}
                            >
                              {getInitials(member.userName || member.userEmail)}
                            </span>
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium text-white truncate">
                                {member.userName || "Unnamed User"}{" "}
                                {isCurrentUser && (
                                  <span className="faint text-neutral-500 font-normal">
                                    (you)
                                  </span>
                                )}
                              </span>
                              <span className="faint text-[11px] text-neutral-400 truncate">
                                {member.userEmail}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="py-3 px-4 text-left">
                          {isOwner ? (
                            <span className="pillbtn inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <Crown className="w-3 h-3 shrink-0" />
                              <span>Owner</span>
                            </span>
                          ) : (
                            <span className="pillbtn bordered inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/[0.05] border border-white/[0.1] text-neutral-200">
                              <span>{roleLabel}</span>
                            </span>
                          )}
                        </td>

                        {/* Team */}
                        <td className="py-3 px-4 text-left">
                          <span className="inline-flex items-center gap-1.5 text-neutral-300">
                            <Layers className="w-3.5 h-3.5 text-neutral-500" />
                            <span>{teamName}</span>
                          </span>
                        </td>

                        {/* Active projects count */}
                        <td className="py-3 px-4 text-center font-mono text-neutral-300">
                          {stats.projectsCount}
                        </td>

                        {/* Assigned tasks count */}
                        <td className="py-3 px-4 text-center font-mono text-neutral-300">
                          {stats.tasksCount}
                        </td>

                        {/* Last active */}
                        <td className="py-3 px-4 text-left text-neutral-400">
                          {isCurrentUser ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span>Online</span>
                            </span>
                          ) : (
                            <span className="text-neutral-400 text-xs">Active</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-left">
                          <span className="badge green inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="dot w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Active
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="ibtn ibtn-sm p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                                aria-label="Member options"
                              >
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 bg-[#181a1e] border-white/[0.1]">
                              <DropdownMenuItem
                                onClick={() => {
                                  navigator.clipboard.writeText(member.userEmail);
                                  toast.success("Email copied to clipboard");
                                }}
                                className="text-xs cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5 mr-2" />
                                <span>Copy email</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => router.push(`/dashboard/issues?assignee=${member.userId}`)}
                                className="text-xs cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                                <span>View tasks</span>
                              </DropdownMenuItem>
                              </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Pending Invitations Rows */}
                  {filteredInvitations.map((inv: any) => {
                    const roleLabel = formatRole(inv.role);
                    return (
                      <tr
                        key={inv.id}
                        data-ctx="invitation"
                        data-id={inv.id}
                        className="hover:bg-white/[0.02] transition-colors bg-amber-500/[0.01]"
                      >
                        {/* Invitee Email */}
                        <td className="py-3 px-4 pl-4">
                          <div className="flex items-center gap-2.5">
                            <span className="av md w-7 h-7 rounded-full text-[11px] font-semibold flex items-center justify-center text-amber-300 bg-amber-500/20 border border-amber-500/30 shrink-0">
                              <Mail className="w-3.5 h-3.5" />
                            </span>
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium text-white truncate">
                                {inv.email}
                              </span>
                              <span className="faint text-[11px] text-amber-400/80">
                                Pending invite
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="py-3 px-4 text-left">
                          <span className="pillbtn bordered inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/[0.05] border border-white/[0.1] text-neutral-300">
                            {roleLabel}
                          </span>
                        </td>

                        {/* Team */}
                        <td className="py-3 px-4 text-left">
                          <span className="inline-flex items-center gap-1.5 text-neutral-400">
                            <Layers className="w-3.5 h-3.5 text-neutral-500" />
                            <span>{teamName}</span>
                          </span>
                        </td>

                        {/* Active projects count */}
                        <td className="py-3 px-4 text-center font-mono text-neutral-500">
                          0
                        </td>

                        {/* Assigned tasks count */}
                        <td className="py-3 px-4 text-center font-mono text-neutral-500">
                          0
                        </td>

                        {/* Last active */}
                        <td className="py-3 px-4 text-left text-neutral-500">
                          —
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-left">
                          <span className="badge amber inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <span className="dot w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Invited
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="ibtn ibtn-sm p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                                aria-label="Invitation options"
                              >
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 bg-[#181a1e] border-white/[0.1]">
                              <DropdownMenuItem
                                onClick={() => handleCancelInvitation(inv.id)}
                                className="text-xs text-rose-400 hover:text-rose-300 cursor-pointer focus:text-rose-400"
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-2" />
                                <span>Cancel invite</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredMembers.length === 0 && filteredInvitations.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-neutral-400">
                        <Users className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                        <p className="text-sm font-medium text-white">No members found</p>
                        <p className="text-xs text-neutral-500 mt-1">
                          Try adjusting your search query or role filter.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* === TAB 2: TEAMS VIEW === */}
        {activeTab === "teams" && (
          <div className="space-y-6 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-xl bg-[#121418] border border-white/[0.08]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold">
                      {teamName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{teamName}</h3>
                      <p className="text-[11px] text-neutral-400">Primary Workspace Team</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 pt-2 border-t border-white/[0.04] text-xs text-neutral-300">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Total Members</span>
                    <span className="font-mono font-medium text-white">{members.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Active Projects</span>
                    <span className="font-mono font-medium text-white">{projects.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Open Issues</span>
                    <span className="font-mono font-medium text-white">
                      {issues.filter((i) => i.workflowState?.type !== "completed").length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* === TAB 3: ROLES & PERMISSIONS VIEW === */}
        {activeTab === "roles" && (
          <div className="space-y-6 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Owner */}
              <div className="p-4 rounded-xl bg-[#121418] border border-white/[0.08] space-y-3">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <h4 className="text-sm font-semibold text-white">Owner</h4>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Full control over team configuration, billing, security, member roles, and project lifecycle.
                </p>
                <div className="pt-2 border-t border-white/[0.04] space-y-1.5 text-[11px] text-neutral-300">
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Manage all projects &amp; issues</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Invite &amp; remove members</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Configure Groq &amp; API keys</span>
                  </div>
                </div>
              </div>

              {/* Admin */}
              <div className="p-4 rounded-xl bg-[#121418] border border-white/[0.08] space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <h4 className="text-sm font-semibold text-white">Admin</h4>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Can invite new collaborators, manage team workflows, create projects, and edit all team tasks.
                </p>
                <div className="pt-2 border-t border-white/[0.04] space-y-1.5 text-[11px] text-neutral-300">
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Create &amp; edit projects</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Send team invitations</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Manage workflow stages</span>
                  </div>
                </div>
              </div>

              {/* Member */}
              <div className="p-4 rounded-xl bg-[#121418] border border-white/[0.08] space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" />
                  <h4 className="text-sm font-semibold text-white">Member</h4>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Regular contributor. Can create, assign, and update issues across all active projects.
                </p>
                <div className="pt-2 border-t border-white/[0.04] space-y-1.5 text-[11px] text-neutral-300">
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Create &amp; update issues</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Assign tasks &amp; labels</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Comment &amp; view timelines</span>
                  </div>
                </div>
              </div>

              {/* Guest */}
              <div className="p-4 rounded-xl bg-[#121418] border border-white/[0.08] space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-amber-400" />
                  <h4 className="text-sm font-semibold text-white">Guest</h4>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  External client or freelance collaborator with scoped read/write access to assigned tasks.
                </p>
                <div className="pt-2 border-t border-white/[0.04] space-y-1.5 text-[11px] text-neutral-300">
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>View assigned tasks</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Update issue status</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Participate in task notes</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Invite Member Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-md bg-[#16181d] border-white/[0.1] text-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white">Invite member</DialogTitle>
            <DialogDescription className="text-xs text-neutral-400">
              Invite a teammate to collaborate on {teamName}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInviteSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Email address</label>
              <Input
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className="bg-[#121316] border-white/[0.1] text-white text-xs placeholder:text-neutral-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Role</label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="bg-[#121316] border-white/[0.1] text-white text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#181a1e] border-white/[0.1] text-white">
                  <SelectItem value="admin" className="text-xs">Admin</SelectItem>
                  <SelectItem value="member" className="text-xs">Member</SelectItem>
                  <SelectItem value="guest" className="text-xs">Guest</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setInviteDialogOpen(false)}
                className="text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isInviting}
                className="text-xs bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isInviting ? "Sending invite..." : "Send invite"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation Dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent className="sm:max-w-md bg-[#16181d] border-white/[0.1] text-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white">Remove member</DialogTitle>
            <DialogDescription className="text-xs text-neutral-400">
              Are you sure you want to remove{" "}
              <b className="text-white">{memberToRemove?.userName || memberToRemove?.userEmail}</b> from {teamName}?
              They will lose access to all team projects and tasks.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setRemoveDialogOpen(false);
                setMemberToRemove(null);
              }}
              className="text-xs text-neutral-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isRemoving}
              onClick={handleRemoveMember}
              className="text-xs"
            >
              {isRemoving ? "Removing..." : "Remove member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { MembersView as MembersPage };
export default MembersView;

