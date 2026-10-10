"use client"

import React, { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { adminClient } from "@/lib/api/admin-client"
import { EmployeeListItem, RolesListResponse } from "@/lib/types/admin"
import { EmployeeToolbar } from "./employee-toolbar"
import { EmployeeTable } from "./employee-table"
import { AddEmployeeDialog } from "./add-employee-dialog"
import { EditEmployeeDialog } from "./edit-employee-dialog"
import { ChangeRoleDialog } from "./change-role-dialog"
import { ResetPasswordDialog } from "./reset-password-dialog"
import { SuspendDialog } from "./suspend-dialog"
import { RestoreDialog } from "./restore-dialog"
import { RevokeSessionsDialog } from "./revoke-sessions-dialog"
import { DeleteDialog } from "./delete-dialog"
import { EmployeeDetailSheet } from "./employee-detail-sheet"

interface Props {
  currentUserId?: string
  actorRoleKey?: string
  canProvision: boolean
  isViewOnlyActor: boolean
}

export function EmployeesTab({
  currentUserId,
  actorRoleKey,
  canProvision,
  isViewOnlyActor,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const page = parseInt(searchParams.get("page") || "1", 10)
  const search = searchParams.get("search") || undefined
  const role = searchParams.get("role") || undefined
  const status = searchParams.get("status") || undefined
  const deepLinkEmployeeId = searchParams.get("employee")

  // Selected employee for dialogs
  const [activeEmployee, setActiveEmployee] = useState<EmployeeListItem | null>(null)
  const [detailSheetEmployeeId, setDetailSheetEmployeeId] = useState<string | null>(null)
  const [singleRevokeSessionId, setSingleRevokeSessionId] = useState<string | undefined>(undefined)

  // Dialog open states
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [changeRoleDialogOpen, setChangeRoleDialogOpen] = useState(false)
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false)
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [revokeSessionsDialogOpen, setRevokeSessionsDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Sync deep link ?employee=<id>
  useEffect(() => {
    if (deepLinkEmployeeId) {
      setDetailSheetEmployeeId(deepLinkEmployeeId)
    }
  }, [deepLinkEmployeeId])

  // Fetch employees list
  const employeesQuery = useQuery({
    queryKey: ["admin", "employees", { page, search, role, status }],
    queryFn: () =>
      adminClient.listEmployees({
        page,
        pageSize: 20,
        search,
        roleKey: role,
        status,
      }),
  })

  // Fetch roles list for assignment check & meta flags
  const rolesQuery = useQuery<RolesListResponse>({
    queryKey: ["admin", "roles"],
    queryFn: () => adminClient.listRoles(),
  })

  const roles = rolesQuery.data?.roles || []
  const assignableRoles = roles.filter((r) => r.assignable)
  const canAddEmployee = canProvision && assignableRoles.length > 0
  const isOwner = actorRoleKey === "owner"
  const hardDeleteEnabled = rolesQuery.data?.meta?.hardDeleteEnabled || false

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", newPage.toString())
    router.push(`${pathname}?${params.toString()}`)
  }

  const handleRowClick = (emp: EmployeeListItem) => {
    setDetailSheetEmployeeId(emp.id)
    const params = new URLSearchParams(searchParams.toString())
    params.set("employee", emp.id)
    router.replace(`${pathname}?${params.toString()}`)
  }

  const handleCloseDetailSheet = (open: boolean) => {
    if (!open) {
      setDetailSheetEmployeeId(null)
      const params = new URLSearchParams(searchParams.toString())
      params.delete("employee")
      router.replace(`${pathname}?${params.toString()}`)
    }
  }

  return (
    <div className="space-y-4">
      <EmployeeToolbar
        totalCount={employeesQuery.data?.total || 0}
        roles={roles}
        canAddEmployee={canAddEmployee}
        onAddEmployee={() => setAddDialogOpen(true)}
      />

      <EmployeeTable
        data={employeesQuery.data}
        isLoading={employeesQuery.isLoading}
        isError={employeesQuery.isError}
        error={employeesQuery.error}
        refetch={() => employeesQuery.refetch()}
        onRowClick={handleRowClick}
        onEditProfile={(emp) => {
          setActiveEmployee(emp)
          setEditDialogOpen(true)
        }}
        onChangeRole={(emp) => {
          setActiveEmployee(emp)
          setChangeRoleDialogOpen(true)
        }}
        onResetPassword={(emp) => {
          setActiveEmployee(emp)
          setResetPasswordDialogOpen(true)
        }}
        onSuspend={(emp) => {
          setActiveEmployee(emp)
          setSuspendDialogOpen(true)
        }}
        onRestore={(emp) => {
          setActiveEmployee(emp)
          setRestoreDialogOpen(true)
        }}
        onRevokeSessions={(emp) => {
          setActiveEmployee(emp)
          setSingleRevokeSessionId(undefined)
          setRevokeSessionsDialogOpen(true)
        }}
        onDelete={(emp) => {
          setActiveEmployee(emp)
          setDeleteDialogOpen(true)
        }}
        currentUserId={currentUserId}
        isViewOnlyActor={isViewOnlyActor}
        currentPage={page}
        onPageChange={handlePageChange}
      />

      {/* Modals & Sheet */}
      <AddEmployeeDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        assignableRoles={assignableRoles}
      />

      <EditEmployeeDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        employee={activeEmployee}
      />

      <ChangeRoleDialog
        open={changeRoleDialogOpen}
        onOpenChange={setChangeRoleDialogOpen}
        employee={activeEmployee}
        assignableRoles={assignableRoles}
        canProvision={canProvision}
      />

      <ResetPasswordDialog
        open={resetPasswordDialogOpen}
        onOpenChange={setResetPasswordDialogOpen}
        employee={activeEmployee}
      />

      <SuspendDialog
        open={suspendDialogOpen}
        onOpenChange={setSuspendDialogOpen}
        employee={activeEmployee}
      />

      <RestoreDialog
        open={restoreDialogOpen}
        onOpenChange={setRestoreDialogOpen}
        employee={activeEmployee}
      />

      <RevokeSessionsDialog
        open={revokeSessionsDialogOpen}
        onOpenChange={setRevokeSessionsDialogOpen}
        employee={activeEmployee}
        sessionId={singleRevokeSessionId}
      />

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        employee={activeEmployee}
        isOwner={isOwner}
        hardDeleteEnabled={hardDeleteEnabled}
      />

      <EmployeeDetailSheet
        employeeId={detailSheetEmployeeId}
        open={Boolean(detailSheetEmployeeId)}
        onOpenChange={handleCloseDetailSheet}
        onEditProfile={(emp) => {
          setActiveEmployee(emp)
          setEditDialogOpen(true)
        }}
        onChangeRole={(emp) => {
          setActiveEmployee(emp)
          setChangeRoleDialogOpen(true)
        }}
        onResetPassword={(emp) => {
          setActiveEmployee(emp)
          setResetPasswordDialogOpen(true)
        }}
        onSuspend={(emp) => {
          setActiveEmployee(emp)
          setSuspendDialogOpen(true)
        }}
        onRestore={(emp) => {
          setActiveEmployee(emp)
          setRestoreDialogOpen(true)
        }}
        onRevokeAllSessions={(emp) => {
          setActiveEmployee(emp)
          setSingleRevokeSessionId(undefined)
          setRevokeSessionsDialogOpen(true)
        }}
        onRevokeSingleSession={(emp, sessionId) => {
          setActiveEmployee(emp)
          setSingleRevokeSessionId(sessionId)
          setRevokeSessionsDialogOpen(true)
        }}
        onDelete={(emp) => {
          setActiveEmployee(emp)
          setDeleteDialogOpen(true)
        }}
        isSelf={Boolean(currentUserId && activeEmployee?.userId === currentUserId)}
      />
    </div>
  )
}
