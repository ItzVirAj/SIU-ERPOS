"use client"

import React, { useState } from "react"
import {
  EmployeeListItem,
  EmployeeListResponse,
  PasswordState,
} from "@/lib/types/admin"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  MoreHorizontal,
  Copy,
  Check,
  Eye,
  Edit2,
  ShieldAlert,
  KeyRound,
  LogOut,
  UserX,
  UserCheck,
  Trash2,
  AlertCircle,
  Clock,
} from "lucide-react"
import { toast } from "sonner"

interface Props {
  data?: EmployeeListResponse
  isLoading: boolean
  isError: boolean
  error?: Error | null
  refetch: () => void
  onRowClick: (emp: EmployeeListItem) => void
  onEditProfile: (emp: EmployeeListItem) => void
  onChangeRole: (emp: EmployeeListItem) => void
  onResetPassword: (emp: EmployeeListItem) => void
  onSuspend: (emp: EmployeeListItem) => void
  onRestore: (emp: EmployeeListItem) => void
  onRevokeSessions: (emp: EmployeeListItem) => void
  onDelete: (emp: EmployeeListItem) => void
  currentUserId?: string
  isViewOnlyActor: boolean
  currentPage: number
  onPageChange: (page: number) => void
}

function getRoleBadgeVariant(level?: number) {
  if (!level) return "bg-white/[0.05] text-neutral-300 border-white/[0.1]"
  if (level >= 80) return "bg-purple-500/10 text-purple-300 border-purple-500/20"
  if (level >= 60) return "bg-blue-500/10 text-blue-300 border-blue-500/20"
  if (level >= 40) return "bg-cyan-500/10 text-cyan-300 border-cyan-500/20"
  return "bg-neutral-500/10 text-neutral-400 border-neutral-500/20"
}

function getExpiryLabel(expiresAt?: string | Date | null): string {
  if (!expiresAt) return "Temporary password"
  const date = new Date(expiresAt)
  const now = new Date()
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return "Temporary password expired"
  if (diffDays === 1) return "Temporary password · expires in 1 day"
  return `Temporary password · expires in ${diffDays} days`
}

export function EmployeeTable({
  data,
  isLoading,
  isError,
  error,
  refetch,
  onRowClick,
  onEditProfile,
  onChangeRole,
  onResetPassword,
  onSuspend,
  onRestore,
  onRevokeSessions,
  onDelete,
  currentUserId,
  isViewOnlyActor,
  currentPage,
  onPageChange,
}: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopyCode = (e: React.MouseEvent, code: string, id: string) => {
    e.stopPropagation()
    navigator.clipboard.writeText(code)
    setCopiedId(id)
    toast.success("Employee code copied")
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-[#141416] p-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-2">
            <Skeleton className="w-10 h-10 rounded-full bg-white/[0.04]" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-44 bg-white/[0.04]" />
              <Skeleton className="h-3 w-32 bg-white/[0.04]" />
            </div>
            <Skeleton className="h-6 w-20 rounded bg-white/[0.04]" />
            <Skeleton className="h-6 w-16 rounded bg-white/[0.04]" />
          </div>
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-[#141416] p-10 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
        <h3 className="text-sm font-semibold text-white">Failed to Load Employees</h3>
        <p className="text-xs text-neutral-400 max-w-sm mx-auto">
          {error?.message || "An unexpected error occurred while fetching the employee directory."}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          className="text-xs border-white/[0.08]"
        >
          Try Again
        </Button>
      </div>
    )
  }

  const employees = data?.employees || []

  if (employees.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-[#141416] p-12 text-center space-y-3">
        <div className="w-10 h-10 rounded-full bg-white/[0.04] text-neutral-400 flex items-center justify-center mx-auto">
          <Clock className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-medium text-white">No Employees Found</h3>
        <p className="text-xs text-neutral-400 max-w-xs mx-auto">
          No employee records match your search query or selected filter criteria.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Desktop Table */}
      <div className="hidden md:block rounded-xl border border-white/[0.08] bg-[#141416] overflow-hidden">
        <Table>
          <TableHeader className="bg-[#18181b]/70 border-b border-white/[0.08]">
            <TableRow className="border-white/[0.08] hover:bg-transparent">
              <TableHead className="text-xs font-semibold text-neutral-400">Employee</TableHead>
              <TableHead className="text-xs font-semibold text-neutral-400">Code</TableHead>
              <TableHead className="text-xs font-semibold text-neutral-400">Role</TableHead>
              <TableHead className="text-xs font-semibold text-neutral-400">Department</TableHead>
              <TableHead className="text-xs font-semibold text-neutral-400">Status</TableHead>
              <TableHead className="text-xs font-semibold text-neutral-400">Security</TableHead>
              {!isViewOnlyActor && (
                <TableHead className="text-xs font-semibold text-neutral-400 text-right w-12">
                  Actions
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((emp) => {
              const isSelf = Boolean(currentUserId && emp.userId === currentUserId)
              const initials = emp.fullName
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()

              return (
                <TableRow
                  key={emp.id}
                  onClick={() => onRowClick(emp)}
                  className="border-white/[0.05] hover:bg-white/[0.02] cursor-pointer transition-colors"
                >
                  {/* Name + Email + Avatar */}
                  <TableCell className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary border border-primary/25 flex items-center justify-center text-xs font-bold shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-white text-xs truncate">
                            {emp.fullName}
                          </span>
                          {isSelf && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/[0.08] text-neutral-300 font-normal">
                              You
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-neutral-400 truncate block">
                          {emp.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  {/* Monospace Employee Code */}
                  <TableCell className="py-3">
                    <div
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#1c1c1f] border border-white/[0.06] text-xs font-mono text-neutral-300 group"
                      onClick={(e) => handleCopyCode(e, emp.employeeCode, emp.id)}
                      title="Click to copy employee code"
                    >
                      <span>{emp.employeeCode}</span>
                      {copiedId === emp.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-neutral-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </TableCell>

                  {/* Role Badge */}
                  <TableCell className="py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${getRoleBadgeVariant(
                        emp.role.level
                      )}`}
                    >
                      {emp.role.name}
                    </span>
                  </TableCell>

                  {/* Department */}
                  <TableCell className="py-3 text-xs text-neutral-300">
                    {emp.department || "—"}
                  </TableCell>

                  {/* Status Badge */}
                  <TableCell className="py-3">
                    {emp.status === "ACTIVE" && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Active
                      </span>
                    )}
                    {emp.status === "SUSPENDED" && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        Suspended
                      </span>
                    )}
                    {emp.status === "TERMINATED" && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        Terminated
                      </span>
                    )}
                  </TableCell>

                  {/* Security / Password Status */}
                  <TableCell className="py-3">
                    {emp.passwordState === "default_pending" && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                        <Clock className="w-3 h-3 text-amber-400" />
                        {getExpiryLabel(emp.defaultPasswordExpiresAt)}
                      </span>
                    )}
                    {emp.passwordState === "default_expired" && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded font-medium">
                        <AlertCircle className="w-3 h-3 text-rose-400" />
                        Temporary password expired
                      </span>
                    )}
                    {(!emp.passwordState || emp.passwordState === "set") && (
                      <span className="text-xs text-neutral-500">Configured</span>
                    )}
                  </TableCell>

                  {/* Row Actions Menu */}
                  {!isViewOnlyActor && (
                    <TableCell className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-white/[0.08]"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-48 bg-[#18181b] border-white/[0.08] text-xs text-neutral-200"
                        >
                          <DropdownMenuItem
                            onClick={() => onRowClick(emp)}
                            className="cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 mr-2" /> View details
                          </DropdownMenuItem>

                          {emp.can.update && (
                            <DropdownMenuItem
                              onClick={() => onEditProfile(emp)}
                              className="cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5 mr-2" /> Edit profile
                            </DropdownMenuItem>
                          )}

                          {!isSelf && (
                            <>
                              {emp.can.changeRole && (
                                <DropdownMenuItem
                                  onClick={() => onChangeRole(emp)}
                                  className="cursor-pointer"
                                >
                                  <ShieldAlert className="w-3.5 h-3.5 mr-2 text-blue-400" /> Change role
                                </DropdownMenuItem>
                              )}

                              {emp.can.resetPassword && (
                                <DropdownMenuItem
                                  onClick={() => onResetPassword(emp)}
                                  className="cursor-pointer text-amber-300 hover:text-amber-200"
                                >
                                  <KeyRound className="w-3.5 h-3.5 mr-2 text-amber-400" /> Reset password
                                </DropdownMenuItem>
                              )}

                              {emp.can.revokeSessions && (
                                <DropdownMenuItem
                                  onClick={() => onRevokeSessions(emp)}
                                  className="cursor-pointer"
                                >
                                  <LogOut className="w-3.5 h-3.5 mr-2" /> Revoke sessions
                                </DropdownMenuItem>
                              )}

                              {emp.can.suspend && emp.status === "ACTIVE" && (
                                <DropdownMenuItem
                                  onClick={() => onSuspend(emp)}
                                  className="cursor-pointer text-amber-400 hover:text-amber-300"
                                >
                                  <UserX className="w-3.5 h-3.5 mr-2" /> Suspend
                                </DropdownMenuItem>
                              )}

                              {emp.can.restore && emp.status === "SUSPENDED" && (
                                <DropdownMenuItem
                                  onClick={() => onRestore(emp)}
                                  className="cursor-pointer text-emerald-400 hover:text-emerald-300"
                                >
                                  <UserCheck className="w-3.5 h-3.5 mr-2" /> Restore
                                </DropdownMenuItem>
                              )}

                              {emp.can.delete && (
                                <>
                                  <DropdownMenuSeparator className="bg-white/[0.08]" />
                                  <DropdownMenuItem
                                    onClick={() => onDelete(emp)}
                                    className="cursor-pointer text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 focus:text-rose-300 focus:bg-rose-500/10"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Offboard / Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Responsive Cards */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {employees.map((emp) => {
          const isSelf = Boolean(currentUserId && emp.userId === currentUserId)
          const initials = emp.fullName
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()

          return (
            <div
              key={emp.id}
              onClick={() => onRowClick(emp)}
              className="p-4 rounded-xl border border-white/[0.08] bg-[#141416] space-y-3 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 text-primary border border-primary/25 flex items-center justify-center text-sm font-bold shrink-0">
                    {initials}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-white text-sm">{emp.fullName}</span>
                      {isSelf && (
                        <span className="text-[10px] px-1.5 rounded bg-white/[0.08] text-neutral-300">
                          You
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-neutral-400">{emp.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded border ${getRoleBadgeVariant(
                      emp.role.level
                    )}`}
                  >
                    {emp.role.name}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-white/[0.05]">
                <span className="font-mono text-neutral-400">{emp.employeeCode}</span>
                <span className="text-neutral-300">{emp.department || "General"}</span>
                {emp.status === "ACTIVE" ? (
                  <span className="text-emerald-400 text-[11px]">Active</span>
                ) : emp.status === "SUSPENDED" ? (
                  <span className="text-amber-400 text-[11px]">Suspended</span>
                ) : (
                  <span className="text-rose-400 text-[11px]">Terminated</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination Bar */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between py-2 text-xs text-neutral-400">
          <span>
            Page {data.page} of {data.totalPages} ({data.total} total)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="h-8 text-xs border-white/[0.08] hover:bg-white/[0.05]"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= data.totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              className="h-8 text-xs border-white/[0.08] hover:bg-white/[0.05]"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
