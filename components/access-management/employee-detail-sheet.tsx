"use client"

import React from "react"
import { useQuery } from "@tanstack/react-query"
import { adminClient } from "@/lib/api/admin-client"
import { EmployeeDetail, EmployeeListItem } from "@/lib/types/admin"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  KeyRound,
  Shield,
  Clock,
  Laptop,
  Activity,
  User,
  Calendar,
  Building,
  Briefcase,
  Phone,
  Mail,
  LogOut,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

interface Props {
  employeeId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEditProfile: (emp: EmployeeListItem) => void
  onChangeRole: (emp: EmployeeListItem) => void
  onResetPassword: (emp: EmployeeListItem) => void
  onSuspend: (emp: EmployeeListItem) => void
  onRestore: (emp: EmployeeListItem) => void
  onRevokeAllSessions: (emp: EmployeeListItem) => void
  onRevokeSingleSession: (emp: EmployeeListItem, sessionId: string) => void
  onDelete: (emp: EmployeeListItem) => void
  isSelf: boolean
}

function formatRelativeTime(dateInput?: string | Date | null): string {
  if (!dateInput) return "Unknown"
  const date = new Date(dateInput)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHour / 24)

  if (diffSec < 60) return "Just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function getAuditSentence(action: string): string {
  switch (action) {
    case "employee.create":
      return "Employee account created"
    case "employee.update":
      return "Profile details updated"
    case "employee.role_change":
      return "Role reassigned"
    case "employee.suspend":
      return "Account suspended"
    case "employee.restore":
      return "Account restored to active"
    case "employee.password_reset":
      return "Password reset to default"
    case "employee.password_changed":
      return "Employee changed their password"
    case "employee.sessions_revoked":
      return "Active sessions revoked"
    case "employee.delete":
      return "Employee offboarded"
    case "employee.hard_delete":
      return "Employee record purged"
    default:
      return action.replace("employee.", "").replace(/_/g, " ")
  }
}

export function EmployeeDetailSheet({
  employeeId,
  open,
  onOpenChange,
  onEditProfile,
  onChangeRole,
  onResetPassword,
  onSuspend,
  onRestore,
  onRevokeAllSessions,
  onRevokeSingleSession,
  onDelete,
  isSelf,
}: Props) {
  const [copiedCode, setCopiedCode] = useState(false)

  const {
    data: detail,
    isLoading,
    isError,
    error,
  } = useQuery<EmployeeDetail, Error>({
    queryKey: ["admin", "employee", employeeId],
    queryFn: () => {
      if (!employeeId) throw new Error("No ID")
      return adminClient.getEmployee(employeeId)
    },
    enabled: Boolean(employeeId && open),
    retry: 1,
  })

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(true)
    toast.success("Employee code copied")
    setTimeout(() => setCopiedCode(false), 2000)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl bg-[#121214] border-l border-white/[0.08] text-foreground p-0 overflow-y-auto no-scrollbar"
      >
        {isLoading ? (
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
              <Skeleton className="w-14 h-14 rounded-2xl bg-white/[0.05]" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-40 bg-white/[0.05]" />
                <Skeleton className="h-4 w-56 bg-white/[0.05]" />
              </div>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-28 w-full rounded-xl bg-white/[0.05]" />
              <Skeleton className="h-32 w-full rounded-xl bg-white/[0.05]" />
              <Skeleton className="h-40 w-full rounded-xl bg-white/[0.05]" />
            </div>
          </div>
        ) : isError || !detail ? (
          <div className="p-8 text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
            <h3 className="text-base font-semibold text-white">Employee Not Found</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              {error?.message || "This employee record does not exist or belongs to another workspace team."}
            </p>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-white/[0.08] text-xs"
            >
              Close
            </Button>
          </div>
        ) : (
          <div className="flex flex-col min-h-full">
            {/* Header */}
            <div className="p-6 border-b border-white/[0.08] bg-[#161619] space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center text-lg font-bold">
                    {detail.fullName
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div>
                    <SheetTitle className="text-lg font-semibold text-white">
                      {detail.fullName}
                    </SheetTitle>
                    <p className="text-xs text-neutral-400">{detail.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  <Badge
                    variant="outline"
                    className="border-white/[0.1] bg-white/[0.04] text-xs text-neutral-200"
                  >
                    {detail.role.name}
                  </Badge>
                  {detail.status === "ACTIVE" && (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[11px]">
                      Active
                    </Badge>
                  )}
                  {detail.status === "SUSPENDED" && (
                    <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[11px]">
                      Suspended
                    </Badge>
                  )}
                  {detail.status === "TERMINATED" && (
                    <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-[11px]">
                      Terminated
                    </Badge>
                  )}
                </div>
              </div>

              {/* Monospace Code Pill */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#111113] border border-white/[0.05] text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-neutral-500 text-[11px]">Employee Code:</span>
                  <span className="font-mono text-neutral-200 font-semibold">{detail.employeeCode}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyCode(detail.employeeCode)}
                  className="text-neutral-400 hover:text-white p-1 rounded transition-colors"
                  title="Copy code"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                {detail.can.update && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEditProfile(detail)}
                    className="text-xs border-white/[0.08] hover:bg-white/[0.05]"
                  >
                    Edit Profile
                  </Button>
                )}
                {detail.can.changeRole && !isSelf && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onChangeRole(detail)}
                    className="text-xs border-white/[0.08] hover:bg-white/[0.05]"
                  >
                    Change Role
                  </Button>
                )}
                {detail.can.resetPassword && !isSelf && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onResetPassword(detail)}
                    className="text-xs border-white/[0.08] text-amber-300 hover:bg-amber-500/10"
                  >
                    Reset Password
                  </Button>
                )}
                {detail.can.revokeSessions && !isSelf && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRevokeAllSessions(detail)}
                    className="text-xs border-white/[0.08] text-neutral-300 hover:bg-white/[0.05]"
                  >
                    Revoke All Sessions
                  </Button>
                )}
                {detail.can.suspend && detail.status === "ACTIVE" && !isSelf && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSuspend(detail)}
                    className="text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  >
                    Suspend
                  </Button>
                )}
                {detail.can.restore && detail.status === "SUSPENDED" && !isSelf && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRestore(detail)}
                    className="text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  >
                    Restore
                  </Button>
                )}
                {detail.can.delete && !isSelf && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onDelete(detail)}
                    className="text-xs bg-rose-600/90 hover:bg-rose-700 ml-auto"
                  >
                    Offboard
                  </Button>
                )}
              </div>
            </div>

            {/* Content Sections */}
            <div className="p-6 space-y-6 flex-1">
              {/* Profile Section */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Directory Information
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#161619] border border-white/[0.05]">
                    <span className="text-neutral-500 block mb-1">Department</span>
                    <span className="text-neutral-200 font-medium">
                      {detail.department || "—"}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#161619] border border-white/[0.05]">
                    <span className="text-neutral-500 block mb-1">Position / Title</span>
                    <span className="text-neutral-200 font-medium">
                      {detail.position || "—"}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#161619] border border-white/[0.05]">
                    <span className="text-neutral-500 block mb-1">Phone Number</span>
                    <span className="text-neutral-200 font-medium">
                      {detail.phone || "—"}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#161619] border border-white/[0.05]">
                    <span className="text-neutral-500 block mb-1">Joining Date</span>
                    <span className="text-neutral-200 font-medium">
                      {detail.joiningDate
                        ? new Date(detail.joiningDate).toLocaleDateString()
                        : "—"}
                    </span>
                  </div>
                </div>
                {detail.personalEmail && (
                  <div className="p-3 rounded-xl bg-[#161619] border border-white/[0.05] text-xs">
                    <span className="text-neutral-500 block mb-1">Personal Contact Email</span>
                    <span className="text-neutral-200 font-medium">{detail.personalEmail}</span>
                  </div>
                )}
              </div>

              {/* Security Section */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Security & Password Status
                </h4>
                <div className="p-4 rounded-xl bg-[#161619] border border-white/[0.05] space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Password Lifecycle</span>
                    {detail.passwordState === "set" && (
                      <span className="text-emerald-400 font-medium">Personal Password Configured</span>
                    )}
                    {detail.passwordState === "default_pending" && (
                      <span className="text-amber-400 font-medium">Temporary Password (Change Pending)</span>
                    )}
                    {detail.passwordState === "default_expired" && (
                      <span className="text-rose-400 font-medium">Temporary Password Expired</span>
                    )}
                  </div>

                  {detail.mustChangePassword && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
                      The employee is using a temporary password and cannot access workspace tools until they update it at first login.
                      {detail.defaultPasswordExpiresAt && (
                        <div className="mt-1 font-semibold">
                          Expires: {new Date(detail.defaultPasswordExpiresAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
                    <span className="text-neutral-400">Active Login Sessions</span>
                    <span className="font-medium text-white">{detail.sessions.length} devices</span>
                  </div>
                </div>
              </div>

              {/* Sessions Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Laptop className="w-3.5 h-3.5" /> Connected Sessions ({detail.sessions.length})
                  </h4>
                </div>

                {detail.sessions.length === 0 ? (
                  <p className="text-xs text-neutral-500 p-3 bg-[#161619] rounded-xl border border-white/[0.05]">
                    No active sessions found for this user.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {detail.sessions.map((sess) => (
                      <div
                        key={sess.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-[#161619] border border-white/[0.05] text-xs"
                      >
                        <div className="space-y-0.5">
                          <p className="font-medium text-white flex items-center gap-1.5">
                            <Laptop className="w-3.5 h-3.5 text-neutral-400" />
                            {sess.device}
                          </p>
                          <p className="text-[11px] text-neutral-400">
                            IP: <span className="font-mono text-neutral-300">{sess.ipAddress}</span> · Logged in {formatRelativeTime(sess.createdAt)}
                          </p>
                        </div>
                        {detail.can.revokeSessions && !isSelf && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onRevokeSingleSession(detail, sess.id)}
                            className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 h-7 px-2"
                          >
                            Revoke
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Activity Timeline Section */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> Recent Activity Audit
                </h4>

                {detail.auditLogs.length === 0 ? (
                  <div className="p-3 rounded-xl bg-[#161619] border border-white/[0.05] text-xs text-neutral-500">
                    No audit records logged for this employee or audit log access is restricted.
                  </div>
                ) : (
                  <div className="relative pl-4 border-l border-white/[0.08] space-y-4">
                    {detail.auditLogs.map((log) => (
                      <div key={log.id} className="relative text-xs space-y-0.5">
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-primary/40 border border-primary" />
                        <p className="font-medium text-white">
                          {getAuditSentence(log.action)}
                        </p>
                        <p className="text-[11px] text-neutral-400">
                          by <span className="text-neutral-300 font-medium">{log.actorName}</span> ({log.actorRole}) · {formatRelativeTime(log.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
