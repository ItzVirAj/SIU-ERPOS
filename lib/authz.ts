import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from './auth'
import { db } from './db'
import {
  AppModule,
  AccessLevel,
  EmployeeStatus,
  Prisma,
  PrismaClient,
} from './prisma-client'
import {
  hasAccess,
  loadRoleAccess,
} from './permissions'
import { ROLES_BY_KEY } from './role-definitions'

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export const ROLE_HIERARCHY = {
  viewer: 1,
  developer: 2,
  admin: 3,
} as const

export type TeamRole = keyof typeof ROLE_HIERARCHY

export function getRoleRank(role: string): number {
  const normalized = (role || '').toLowerCase().trim()
  if (['admin', 'owner', 'ceo', 'cto'].includes(normalized)) return 3
  if (
    [
      'developer',
      'finance_manager',
      'project_manager',
      'sales_manager',
      'team_lead',
      'accountant',
      'sales_executive',
    ].includes(normalized)
  ) {
    return 2
  }
  if (normalized === 'viewer') return 1
  return ROLE_HIERARCHY[normalized as TeamRole] ?? 0
}

/**
 * 2. requireSession() -> session or HttpError(401).
 * Preserves message "Unauthorized" so existing routes work seamlessly.
 */
export async function requireSession() {
  const reqHeaders = await headers()
  const session = await auth.api.getSession({
    headers: reqHeaders,
  })

  if (!session?.user?.id) {
    throw new HttpError(401, 'Unauthorized', 'UNAUTHORIZED')
  }

  return session
}

export async function getSession() {
  const reqHeaders = await headers()
  return await auth.api.getSession({
    headers: reqHeaders,
  })
}

export async function getSessionOrNull() {
  return await getSession()
}

export interface AuthzOptions {
  allowPasswordChangePending?: boolean
}

/**
 * Validates that an employee exists, is ACTIVE, and has satisfied password requirements.
 * Rejects with HttpError(403) on missing, suspended, terminated, or password change pending.
 */
export async function assertEmployeeUsable(
  userId: string,
  options?: AuthzOptions
) {
  const employee = await db.employee.findUnique({
    where: { userId },
    include: {
      role: true,
      team: true,
    },
  })

  if (!employee) {
    throw new HttpError(403, 'No employee profile', 'NO_EMPLOYEE_PROFILE')
  }

  if (employee.status === EmployeeStatus.SUSPENDED) {
    throw new HttpError(403, 'Account suspended', 'ACCOUNT_SUSPENDED')
  }

  if (employee.status === EmployeeStatus.TERMINATED) {
    throw new HttpError(403, 'Account terminated', 'ACCOUNT_TERMINATED')
  }

  if (employee.mustChangePassword && !options?.allowPasswordChangePending) {
    throw new HttpError(
      403,
      'Password change required',
      'PASSWORD_CHANGE_REQUIRED'
    )
  }

  return employee
}

export async function getUserId(options?: AuthzOptions): Promise<string> {
  const session = await requireSession()
  await assertEmployeeUsable(session.user.id, options)
  return session.user.id
}

export async function requireUserId(options?: AuthzOptions): Promise<string> {
  return await getUserId(options)
}

export async function getUser(options?: AuthzOptions) {
  const session = await requireSession()
  await assertEmployeeUsable(session.user.id, options)
  return session.user
}

/**
 * 3. requireEmployee() -> loads Employee (+ role + RoleAccess map) for the session user.
 * Always queries DB on every call (no caching of status).
 */
export async function requireEmployee(options?: AuthzOptions) {
  const session = await requireSession()
  const userId = session.user.id

  const employee = await assertEmployeeUsable(userId, options)
  const access = await loadRoleAccess(employee.role.key)

  return {
    session,
    employee,
    role: employee.role,
    access,
  }
}

/**
 * 4. requireAccess(module, level) -> calls requireEmployee, checks hasAccess.
 */
export async function requireAccess(
  module: AppModule,
  level: AccessLevel,
  options?: AuthzOptions
) {
  const context = await requireEmployee(options)

  if (!hasAccess(context.access, module, level)) {
    throw new HttpError(403, 'Forbidden', 'FORBIDDEN')
  }

  return context
}

/**
 * Non-throwing getActor() for server components.
 */
export async function getActor() {
  try {
    return await requireEmployee()
  } catch {
    return null
  }
}

export type ManageAction =
  | 'view'
  | 'update'
  | 'suspend'
  | 'restore'
  | 'revoke_sessions'
  | 'reset_password'
  | 'change_role'
  | 'delete'
  | 'hard_delete'

export interface ActorParam {
  id: string
  role: {
    level: number
    key: string
  }
  status?: EmployeeStatus
  access?: Record<AppModule, AccessLevel>
}

export interface TargetParam {
  id: string
  role: {
    level: number
    key: string
  }
  status: EmployeeStatus
  teamId?: string
}

/**
 * 5. assertCanManage(actor, target, action)
 * Pure, synchronous rules on {id, role.level, role.key, status}.
 */
export function assertCanManage(
  actor: ActorParam,
  target: TargetParam,
  action: ManageAction
): void {
  // Terminated targets can ONLY be viewed
  if (target.status === EmployeeStatus.TERMINATED && action !== 'view') {
    throw new HttpError(403, 'Cannot manage a terminated employee', 'TARGET_TERMINATED')
  }

  // Self-protection
  const selfForbiddenActions: ManageAction[] = [
    'suspend',
    'delete',
    'hard_delete',
    'change_role',
    'revoke_sessions',
    'reset_password',
  ]
  if (selfForbiddenActions.includes(action) && actor.id === target.id) {
    throw new HttpError(403, 'Cannot perform this action on yourself', 'SELF_MANAGEMENT_FORBIDDEN')
  }

  // Action permission requirement:
  // resolve actor's EMPLOYEES module access level
  const actorAccess =
    actor.access ?? ROLES_BY_KEY[actor.role.key]?.access ?? {}
  const empAccess = actorAccess[AppModule.EMPLOYEES] ?? AccessLevel.NONE

  if (action === 'hard_delete') {
    if (actor.role.key !== 'owner') {
      throw new HttpError(403, 'Only the owner can hard-delete employees', 'FORBIDDEN')
    }
  } else if (action === 'change_role' || action === 'delete') {
    if (!hasAccess(actorAccess, AppModule.EMPLOYEES, AccessLevel.MANAGE)) {
      throw new HttpError(403, 'Forbidden: action requires MANAGE access on EMPLOYEES', 'FORBIDDEN')
    }
  } else if (
    action === 'update' ||
    action === 'suspend' ||
    action === 'restore' ||
    action === 'revoke_sessions' ||
    action === 'reset_password'
  ) {
    if (!hasAccess(actorAccess, AppModule.EMPLOYEES, AccessLevel.WRITE)) {
      throw new HttpError(403, 'Forbidden: action requires WRITE access on EMPLOYEES', 'FORBIDDEN')
    }
  } else if (action === 'view') {
    if (!hasAccess(actorAccess, AppModule.EMPLOYEES, AccessLevel.VIEW)) {
      throw new HttpError(403, 'Forbidden: action requires VIEW access on EMPLOYEES', 'FORBIDDEN')
    }
  }

  // Hierarchy check:
  // actor.role.level must be strictly greater than target.role.level for every action except "view".
  // Owner role bypasses the strictly-greater rule (can manage anyone except self).
  if (action !== 'view') {
    const isOwner = actor.role.key === 'owner'
    if (!isOwner && actor.role.level <= target.role.level) {
      throw new HttpError(
        403,
        `Forbidden: cannot manage a user with equal or higher role level (${target.role.level} >= ${actor.role.level})`,
        'INSUFFICIENT_HIERARCHY_LEVEL'
      )
    }
  }
}

/**
 * 6. assertCanAssignRole(actor, newRole, { confirmSecondOwner?: boolean })
 * Actor can only assign roles whose level is strictly below actor's own;
 * Owner can assign any role, but assigning "owner" requires confirmSecondOwner === true.
 */
export function assertCanAssignRole(
  actor: { id: string; role: { level: number; key: string } },
  newRole: { level: number; key: string },
  options?: { confirmSecondOwner?: boolean }
): void {
  const isOwner = actor.role.key === 'owner'

  if (isOwner) {
    if (newRole.key === 'owner' && !options?.confirmSecondOwner) {
      throw new HttpError(
        400,
        'Assigning the owner role requires explicit confirmation (confirmSecondOwner)',
        'CONFIRMATION_REQUIRED'
      )
    }
    return
  }

  if (actor.role.level <= newRole.level) {
    throw new HttpError(
      403,
      `Cannot assign a role with equal or higher level (${newRole.level} >= ${actor.role.level})`,
      'ROLE_ASSIGNMENT_FORBIDDEN'
    )
  }
}

/**
 * 7. assertNotLastOwner(tx, target)
 * Inside a transaction, if target is an ACTIVE owner and count of ACTIVE owners in team is 1, throws HttpError(409).
 */
export async function assertNotLastOwner(
  tx: PrismaClient | Prisma.TransactionClient,
  target: { role: { key: string }; status: EmployeeStatus; teamId?: string | null }
): Promise<void> {
  if (target.role.key === 'owner' && target.status === EmployeeStatus.ACTIVE && target.teamId) {
    const ownerRole = await tx.role.findUnique({
      where: { key: 'owner' },
    })

    if (ownerRole) {
      const activeOwnersCount = await tx.employee.count({
        where: {
          teamId: target.teamId,
          roleId: ownerRole.id,
          status: EmployeeStatus.ACTIVE,
        },
      })

      if (activeOwnersCount <= 1) {
        throw new HttpError(
          409,
          'Cannot remove the last active owner',
          'CANNOT_REMOVE_LAST_OWNER'
        )
      }
    }
  }
}

/**
 * 8. handleRouteError(error) -> NextResponse
 */
export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { error: error.message, ...(error.code ? { code: error.code } : {}) },
      { status: error.status }
    )
  }

  if (error instanceof z.ZodError) {
    const issues = error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }))
    return NextResponse.json(
      { error: 'Validation error', code: 'VALIDATION_ERROR', issues },
      { status: 400 }
    )
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    return NextResponse.json(
      {
        error: 'Resource conflict: unique constraint violation',
        code: 'CONFLICT',
      },
      { status: 409 }
    )
  }

  // Generic 500 without leaking sensitive schema or database details
  console.error('[API_ROUTE_ERROR]', error instanceof Error ? error.message : error)
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  )
}

/**
 * Legacy team member helpers (preserved for backward compatibility)
 */
export async function requireTeamMember(
  teamId: string,
  minRole?: TeamRole,
  options?: AuthzOptions
) {
  if (!teamId || typeof teamId !== 'string') {
    throw new HttpError(400, 'Team ID is required')
  }

  const session = await requireSession()
  const user = session.user
  const userId = user.id

  await assertEmployeeUsable(userId, options)

  const member = await db.teamMember.findFirst({
    where: {
      teamId,
      userId,
    },
  })

  if (!member) {
    throw new HttpError(403, 'Access denied: Not a member of this team')
  }

  if (minRole) {
    const requiredRank = ROLE_HIERARCHY[minRole] ?? 1
    const actualRank = getRoleRank(member.role)
    if (actualRank < requiredRank) {
      throw new HttpError(
        403,
        `Access denied: Action requires at least '${minRole}' role`
      )
    }
  }

  return {
    session,
    user,
    userId,
    member,
  }
}

export async function requireTeamAdmin(teamId: string, options?: AuthzOptions) {
  return await requireTeamMember(teamId, 'admin', options)
}

export async function isTeamMember(teamId: string, userId: string): Promise<boolean> {
  if (!teamId || !userId) return false
  const member = await db.teamMember.findFirst({
    where: { teamId, userId },
  })
  return !!member
}

export async function verifyTeamMembership(teamId: string, userId: string): Promise<void> {
  const isMember = await isTeamMember(teamId, userId)
  if (!isMember) {
    throw new HttpError(403, 'Access denied: Not a member of this team')
  }
}
