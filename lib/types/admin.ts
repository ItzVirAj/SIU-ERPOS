import { AppModule, AccessLevel, EmployeeStatus } from "@/lib/prisma-client"

export type PasswordState = "default_pending" | "default_expired" | "set"

export interface EmployeePermissions {
  view: boolean
  update: boolean
  suspend: boolean
  restore: boolean
  revokeSessions: boolean
  resetPassword: boolean
  changeRole: boolean
  delete: boolean
}

export interface EmployeeListItem {
  id: string
  userId?: string
  email: string
  personalEmail?: string | null
  fullName: string
  employeeCode: string
  position?: string | null
  department?: string | null
  phone?: string | null
  joiningDate?: string | Date | null
  status: EmployeeStatus
  mustChangePassword?: boolean
  defaultPasswordExpiresAt?: string | Date | null
  passwordState?: PasswordState
  suspendedAt?: string | Date | null
  suspendedReason?: string | null
  terminatedAt?: string | Date | null
  createdAt?: string | Date
  role: {
    key: string
    name: string
    level?: number
  }
  can: EmployeePermissions
}

export interface EmployeeListResponse {
  employees: EmployeeListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface EmployeeSessionItem {
  id: string
  createdAt: string | Date
  expiresAt: string | Date
  device: string
  ipAddress: string
}

export interface EmployeeAuditLogItem {
  id: string
  action: string
  actorName: string
  actorRole: string
  createdAt: string | Date
  details?: any
}

export interface EmployeeDetail extends EmployeeListItem {
  userId: string
  sessions: EmployeeSessionItem[]
  auditLogs: EmployeeAuditLogItem[]
}

export interface RoleListItem {
  key: string
  name: string
  description: string
  level: number
  access: Record<AppModule, AccessLevel>
  assignable: boolean
}

export interface RolesListResponse {
  roles: RoleListItem[]
  meta: {
    hardDeleteEnabled: boolean
  }
}

export interface MyAccessResponse {
  employee: {
    id: string
    fullName: string
    email: string
    status: EmployeeStatus
    mustChangePassword: boolean
  }
  role: {
    key: string
    name: string
    level: number
  }
  access: Record<AppModule, AccessLevel>
}

export interface CreateEmployeeInput {
  fullName: string
  email: string
  roleKey: string
  position?: string
  department?: string
  phone?: string
  joiningDate?: string
  confirmSecondOwner?: boolean
}

export interface CreateEmployeeResponse {
  employee: {
    id: string
    userId: string
    email: string
    fullName: string
    employeeCode: string
    position?: string | null
    department?: string | null
    role: {
      key: string
      name: string
    }
    status: EmployeeStatus
    mustChangePassword: boolean
  }
  defaultPasswordApplied: true
  expiresAt: string | Date
}

export interface UpdateEmployeeInput {
  fullName?: string
  personalEmail?: string
  position?: string
  department?: string
  phone?: string
  joiningDate?: string
  email?: string
}

export interface ChangeRoleInput {
  roleKey: string
  confirmSecondOwner?: boolean
}

export interface SuspendEmployeeInput {
  reason: string
}

export interface RevokeSessionsInput {
  sessionId?: string
}

export interface ResetPasswordInput {
  actorPassword: string
}

export interface ResetPasswordResponse {
  defaultPasswordApplied: true
  expiresAt: string | Date
}

export interface DeleteEmployeeInput {
  hard?: boolean
  confirmEmail?: string
}
