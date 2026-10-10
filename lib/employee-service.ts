import crypto from 'crypto'
import { hashPassword, verifyPassword } from 'better-auth/crypto'
import { db } from './db'
import {
  Prisma,
  EmployeeStatus,
  AppModule,
  AccessLevel,
} from './prisma-client'
import {
  HttpError,
  assertCanManage,
  assertCanAssignRole,
  assertNotLastOwner,
  ManageAction,
} from './authz'
import {
  writeAudit,
  maskIp,
  AUDIT_ACTIONS,
} from './audit'
import { enforceRateLimit, rateLimit } from './rate-limit'
import { revokeAllSessions, revokeSession } from './session-admin'
import {
  canProvision,
  DEFAULT_PASSWORD,
  defaultPasswordExpiry,
} from './employee-policy'
import {
  normalizeEmail,
  updateUserEmail,
  syncEmployeeFromUser,
  syncTeamMemberRole,
} from './employee-sync'
import { generateEmployeeCode } from './employee-code'

export type PasswordState = 'default_pending' | 'default_expired' | 'set'

export function computePasswordState(
  mustChangePassword: boolean,
  defaultPasswordExpiresAt?: Date | null
): PasswordState {
  if (!mustChangePassword) return 'set'
  if (defaultPasswordExpiresAt && new Date() > new Date(defaultPasswordExpiresAt)) {
    return 'default_expired'
  }
  return 'default_pending'
}

/**
 * Hand-written lightweight User-Agent device parser.
 */
export function parseDevice(userAgent?: string | null): string {
  if (!userAgent) return 'Unknown Device'

  let browser = 'Unknown Browser'
  if (userAgent.includes('Firefox/')) browser = 'Firefox'
  else if (userAgent.includes('Edg/')) browser = 'Edge'
  else if (userAgent.includes('Chrome/')) browser = 'Chrome'
  else if (userAgent.includes('Safari/')) browser = 'Safari'

  let os = 'Unknown OS'
  if (userAgent.includes('Macintosh') || userAgent.includes('Mac OS')) os = 'macOS'
  else if (userAgent.includes('Windows')) os = 'Windows'
  else if (userAgent.includes('Android')) os = 'Android'
  else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS'
  else if (userAgent.includes('Linux')) os = 'Linux'

  return `${browser} on ${os}`
}

export interface EmployeeActor {
  session: {
    user: {
      id: string
      email: string
      name?: string | null
    }
  }
  employee: {
    id: string
    teamId: string
    userId: string
    email: string
    status: EmployeeStatus
  }
  role: {
    key: string
    level: number
  }
  access: Record<AppModule, AccessLevel>
}

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

export function computeEmployeePermissions(
  actor: EmployeeActor,
  target: {
    id: string
    role: { key: string; level: number }
    status: EmployeeStatus
  }
): EmployeePermissions {
  const check = (action: ManageAction): boolean => {
    try {
      assertCanManage(
        {
          id: actor.session.user.id,
          role: actor.role,
          status: actor.employee.status,
          access: actor.access,
        },
        target,
        action
      )
      return true
    } catch {
      return false
    }
  }

  const isProvisioner = canProvision(actor.role.key)

  return {
    view: check('view'),
    update: check('update'),
    suspend: check('suspend'),
    restore: check('restore'),
    revokeSessions: check('revoke_sessions'),
    resetPassword: check('reset_password'),
    changeRole: isProvisioner && check('change_role'),
    delete: check('delete'),
  }
}

// -------------------------------------------------------------------
// 1. List Employees
// -------------------------------------------------------------------
export interface ListEmployeesParams {
  search?: string
  roleKey?: string
  status?: EmployeeStatus
  page?: number
  pageSize?: number
}

export async function listEmployees(
  actor: EmployeeActor,
  params: ListEmployeesParams
) {
  enforceRateLimit(actor.session.user.id, 'list')

  const teamId = actor.employee.teamId
  const page = Math.max(1, params.page || 1)
  const pageSize = Math.min(50, Math.max(1, params.pageSize || 20))
  const skip = (page - 1) * pageSize

  const whereClause: Prisma.EmployeeWhereInput = {
    teamId,
  }

  if (params.status) {
    whereClause.status = params.status
  }

  if (params.roleKey) {
    whereClause.role = { key: params.roleKey }
  }

  if (params.search) {
    const s = params.search.trim()
    whereClause.OR = [
      { fullName: { contains: s, mode: 'insensitive' } },
      { email: { contains: s, mode: 'insensitive' } },
      { employeeCode: { contains: s, mode: 'insensitive' } },
      { department: { contains: s, mode: 'insensitive' } },
    ]
  }

  const [total, items] = await Promise.all([
    db.employee.count({ where: whereClause }),
    db.employee.findMany({
      where: whereClause,
      include: {
        role: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
  ])

  const actorEmpAccess = actor.access[AppModule.EMPLOYEES] ?? AccessLevel.NONE
  const isViewOnly = actorEmpAccess === AccessLevel.VIEW

  const employees = items.map((emp) => {
    const passwordState = computePasswordState(
      emp.mustChangePassword,
      emp.defaultPasswordExpiresAt
    )

    const can = computeEmployeePermissions(actor, emp)

    if (isViewOnly) {
      return {
        id: emp.id,
        fullName: emp.fullName,
        email: emp.email,
        employeeCode: emp.employeeCode,
        position: emp.position,
        department: emp.department,
        status: emp.status,
        role: {
          key: emp.role.key,
          name: emp.role.name,
        },
        can,
      }
    }

    return {
      id: emp.id,
      userId: emp.userId,
      email: emp.email,
      personalEmail: emp.personalEmail,
      fullName: emp.fullName,
      employeeCode: emp.employeeCode,
      position: emp.position,
      department: emp.department,
      phone: emp.phone,
      joiningDate: emp.joiningDate,
      status: emp.status,
      mustChangePassword: emp.mustChangePassword,
      defaultPasswordExpiresAt: emp.defaultPasswordExpiresAt,
      passwordState,
      suspendedAt: emp.suspendedAt,
      suspendedReason: emp.suspendedReason,
      terminatedAt: emp.terminatedAt,
      createdAt: emp.createdAt,
      role: {
        key: emp.role.key,
        name: emp.role.name,
        level: emp.role.level,
      },
      can,
    }
  })

  return {
    employees,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

// -------------------------------------------------------------------
// 2. Get Employee Detail
// -------------------------------------------------------------------
export async function getEmployee(actor: EmployeeActor, id: string) {
  enforceRateLimit(actor.session.user.id, 'get')

  const employee = await db.employee.findFirst({
    where: {
      id,
      teamId: actor.employee.teamId,
    },
    include: {
      role: true,
    },
  })

  if (!employee) {
    throw new HttpError(404, 'Employee not found')
  }

  const can = computeEmployeePermissions(actor, employee)
  const passwordState = computePasswordState(
    employee.mustChangePassword,
    employee.defaultPasswordExpiresAt
  )

  const actorEmpAccess = actor.access[AppModule.EMPLOYEES] ?? AccessLevel.NONE
  if (actorEmpAccess === AccessLevel.VIEW) {
    return {
      id: employee.id,
      fullName: employee.fullName,
      email: employee.email,
      employeeCode: employee.employeeCode,
      position: employee.position,
      department: employee.department,
      status: employee.status,
      role: {
        key: employee.role.key,
        name: employee.role.name,
      },
      can,
    }
  }

  // Fetch active sessions
  const sessions = await db.session.findMany({
    where: { userId: employee.userId },
    orderBy: { createdAt: 'desc' },
  })

  const formattedSessions = sessions.map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    device: parseDevice(s.userAgent),
    ip: maskIp(s.ipAddress),
  }))

  // Fetch audit history if actor has AUDIT_LOGS >= VIEW
  let auditLogs: Array<Record<string, unknown>> = []
  const auditAccess = actor.access[AppModule.AUDIT_LOGS] ?? AccessLevel.NONE
  if (auditAccess !== AccessLevel.NONE) {
    auditLogs = await db.auditLog.findMany({
      where: {
        OR: [{ targetId: employee.userId }, { entityId: employee.id }],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
  }

  return {
    id: employee.id,
    userId: employee.userId,
    email: employee.email,
    personalEmail: employee.personalEmail,
    fullName: employee.fullName,
    employeeCode: employee.employeeCode,
    position: employee.position,
    department: employee.department,
    phone: employee.phone,
    joiningDate: employee.joiningDate,
    status: employee.status,
    mustChangePassword: employee.mustChangePassword,
    defaultPasswordExpiresAt: employee.defaultPasswordExpiresAt,
    passwordState,
    suspendedAt: employee.suspendedAt,
    suspendedBy: employee.suspendedBy,
    suspendedReason: employee.suspendedReason,
    terminatedAt: employee.terminatedAt,
    createdAt: employee.createdAt,
    role: {
      key: employee.role.key,
      name: employee.role.name,
      level: employee.role.level,
    },
    sessions: formattedSessions,
    auditLogs,
    can,
  }
}

// -------------------------------------------------------------------
// 3. Create Employee
// -------------------------------------------------------------------
export interface CreateEmployeeInput {
  fullName: string
  email: string
  roleKey: string
  position?: string
  department?: string
  phone?: string
  joiningDate?: string | Date
  confirmSecondOwner?: boolean
}

export async function createEmployee(
  actor: EmployeeActor,
  input: CreateEmployeeInput,
  ctx: { ip?: string | null } = {}
) {
  if (!canProvision(actor.role.key)) {
    throw new HttpError(403, 'Only Owner, HR or CTO can create employees')
  }

  if (input.roleKey.toLowerCase().trim() === 'owner') {
    throw new HttpError(403, 'Owner role cannot be provisioned through employee creation')
  }

  const targetRole = await db.role.findUnique({
    where: { key: input.roleKey },
  })

  if (!targetRole) {
    throw new HttpError(400, `Role "${input.roleKey}" not found`)
  }

  assertCanAssignRole(
    { id: actor.session.user.id, role: actor.role },
    targetRole,
    { confirmSecondOwner: input.confirmSecondOwner }
  )

  const normalizedEmail = normalizeEmail(input.email)

  // Check uniqueness across user and employees
  const [existingUser, existingEmp] = await Promise.all([
    db.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    }),
    db.employee.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    }),
  ])

  if (existingEmp) {
    if (existingEmp.status === EmployeeStatus.TERMINATED) {
      throw new HttpError(409, 'An account with this email was previously terminated')
    }
    throw new HttpError(409, 'An employee with this email already exists')
  }

  if (existingUser) {
    throw new HttpError(409, 'A user account with this email already exists')
  }

  enforceRateLimit(actor.session.user.id, 'create')

  const expiresAt = defaultPasswordExpiry()

  const result = await db.$transaction(async (tx) => {
    // Generate Better Auth user id
    const userId = crypto.randomBytes(24).toString('base64url').slice(0, 32)
    const localPart = normalizedEmail.split('@')[0]

    // Ensure unique username
    let usernameCandidate = localPart
    let suffix = 1
    while (await tx.user.findUnique({ where: { username: usernameCandidate } })) {
      usernameCandidate = `${localPart}${suffix}`
      suffix++
    }

    // Generate unique employee code
    let empCode: string
    let attempts = 0
    do {
      empCode = generateEmployeeCode()
      attempts++
      const inUsers = await tx.user.findUnique({ where: { employeeCode: empCode } })
      const inEmps = await tx.employee.findUnique({ where: { employeeCode: empCode } })
      if (!inUsers && !inEmps) break
    } while (attempts < 100)

    const user = await tx.user.create({
      data: {
        id: userId,
        email: normalizedEmail,
        name: input.fullName.trim(),
        emailVerified: true,
        username: usernameCandidate,
        position: input.position?.trim() || null,
        department: input.department?.trim() || null,
        phone: input.phone?.trim() || null,
        joiningDate: input.joiningDate ? new Date(input.joiningDate) : new Date(),
        employeeCode: empCode,
      },
    })

    // Create credential account with default password hash
    const hashedPassword = await hashPassword(DEFAULT_PASSWORD)
    const accountId = crypto.randomBytes(24).toString('base64url').slice(0, 32)

    await tx.account.create({
      data: {
        id: accountId,
        accountId: user.id,
        userId: user.id,
        providerId: 'credential',
        password: hashedPassword,
      },
    })

    const employee = await tx.employee.create({
      data: {
        userId: user.id,
        email: normalizedEmail,
        fullName: input.fullName.trim(),
        employeeCode: empCode,
        position: input.position?.trim() || null,
        department: input.department?.trim() || null,
        phone: input.phone?.trim() || null,
        joiningDate: input.joiningDate ? new Date(input.joiningDate) : new Date(),
        roleId: targetRole.id,
        teamId: actor.employee.teamId,
        status: EmployeeStatus.ACTIVE,
        mustChangePassword: true,
        defaultPasswordExpiresAt: expiresAt,
        createdBy: actor.employee.id,
      },
      include: {
        role: true,
      },
    })

    await syncTeamMemberRole(tx, employee.id)

    await writeAudit(tx, {
      actor: {
        id: actor.session.user.id,
        name: actor.session.user.name,
        email: actor.session.user.email,
        role: actor.role.key,
      },
      target: {
        id: employee.id,
        email: employee.email,
      },
      action: AUDIT_ACTIONS.EMPLOYEE_CREATE,
      after: {
        fullName: employee.fullName,
        email: employee.email,
        role: targetRole.key,
        position: employee.position,
        department: employee.department,
        teamId: employee.teamId,
      },
      ip: ctx.ip,
      teamId: actor.employee.teamId,
    })

    return employee
  })

  return {
    employee: {
      id: result.id,
      userId: result.userId,
      email: result.email,
      fullName: result.fullName,
      employeeCode: result.employeeCode,
      position: result.position,
      department: result.department,
      role: {
        key: result.role.key,
        name: result.role.name,
      },
      status: result.status,
      mustChangePassword: result.mustChangePassword,
    },
    defaultPasswordApplied: true,
    expiresAt,
  }
}

// -------------------------------------------------------------------
// 4. Update Employee
// -------------------------------------------------------------------
export interface UpdateEmployeeInput {
  fullName?: string
  personalEmail?: string | null
  position?: string | null
  department?: string | null
  phone?: string | null
  joiningDate?: string | Date | null
  email?: string
}

export async function updateEmployee(
  actor: EmployeeActor,
  id: string,
  input: UpdateEmployeeInput,
  ctx: { ip?: string | null } = {}
) {
  const target = await db.employee.findFirst({
    where: { id, teamId: actor.employee.teamId },
    include: { role: true },
  })

  if (!target) {
    throw new HttpError(404, 'Employee not found')
  }

  assertCanManage(
    {
      id: actor.session.user.id,
      role: actor.role,
      status: actor.employee.status,
      access: actor.access,
    },
    target,
    'update'
  )

  enforceRateLimit(actor.session.user.id, 'update')

  const beforeSnapshot = {
    fullName: target.fullName,
    email: target.email,
    personalEmail: target.personalEmail,
    position: target.position,
    department: target.department,
    phone: target.phone,
  }

  const updated = await db.$transaction(async (tx) => {
    if (input.email && normalizeEmail(input.email) !== target.email) {
      await updateUserEmail(tx, target.userId, input.email)
    }

    const userUpdate: Prisma.UserUpdateInput = {}
    if (input.fullName !== undefined) userUpdate.name = input.fullName.trim()
    if (input.position !== undefined) userUpdate.position = input.position?.trim() || null
    if (input.department !== undefined) userUpdate.department = input.department?.trim() || null
    if (input.phone !== undefined) userUpdate.phone = input.phone?.trim() || null
    if (input.joiningDate !== undefined) {
      userUpdate.joiningDate = input.joiningDate ? new Date(input.joiningDate) : null
    }

    if (Object.keys(userUpdate).length > 0) {
      await tx.user.update({
        where: { id: target.userId },
        data: userUpdate,
      })
    }

    if (input.personalEmail !== undefined) {
      await tx.employee.update({
        where: { id: target.id },
        data: { personalEmail: input.personalEmail?.trim() || null },
      })
    }

    const syncedEmp = await syncEmployeeFromUser(tx, target.userId)

    await writeAudit(tx, {
      actor: {
        id: actor.session.user.id,
        name: actor.session.user.name,
        email: actor.session.user.email,
        role: actor.role.key,
      },
      target: {
        id: target.id,
        email: target.email,
      },
      action: AUDIT_ACTIONS.EMPLOYEE_UPDATE,
      before: beforeSnapshot,
      after: {
        fullName: syncedEmp?.fullName,
        email: syncedEmp?.email,
        personalEmail: syncedEmp?.personalEmail,
        position: syncedEmp?.position,
        department: syncedEmp?.department,
        phone: syncedEmp?.phone,
      },
      ip: ctx.ip,
      teamId: actor.employee.teamId,
    })

    return syncedEmp
  })

  return updated
}

// -------------------------------------------------------------------
// 5. Change Role
// -------------------------------------------------------------------
export async function changeRole(
  actor: EmployeeActor,
  id: string,
  input: { roleKey: string; confirmSecondOwner?: boolean },
  ctx: { ip?: string | null } = {}
) {
  if (!canProvision(actor.role.key)) {
    throw new HttpError(403, 'Only Owner, HR or CTO can change employee roles')
  }

  const target = await db.employee.findFirst({
    where: { id, teamId: actor.employee.teamId },
    include: { role: true },
  })

  if (!target) {
    throw new HttpError(404, 'Employee not found')
  }

  assertCanManage(
    {
      id: actor.session.user.id,
      role: actor.role,
      status: actor.employee.status,
      access: actor.access,
    },
    target,
    'change_role'
  )

  const newRole = await db.role.findUnique({
    where: { key: input.roleKey },
  })

  if (!newRole) {
    throw new HttpError(400, `Role "${input.roleKey}" not found`)
  }

  assertCanAssignRole(
    { id: actor.session.user.id, role: actor.role },
    newRole,
    { confirmSecondOwner: input.confirmSecondOwner }
  )

  enforceRateLimit(actor.session.user.id, 'change_role')

  const updated = await db.$transaction(async (tx) => {
    // If target was an active owner and is changing to another role, verify single owner guard
    if (target.role.key === 'owner' && newRole.key !== 'owner') {
      await assertNotLastOwner(tx, target)
    }

    const emp = await tx.employee.update({
      where: { id: target.id },
      data: { roleId: newRole.id },
      include: { role: true },
    })

    await syncTeamMemberRole(tx, emp.id)
    await revokeAllSessions(tx, target.userId)

    await writeAudit(tx, {
      actor: {
        id: actor.session.user.id,
        name: actor.session.user.name,
        email: actor.session.user.email,
        role: actor.role.key,
      },
      target: { id: target.id, email: target.email },
      action: AUDIT_ACTIONS.EMPLOYEE_ROLE_CHANGE,
      before: { role: target.role.key },
      after: { role: newRole.key },
      ip: ctx.ip,
      teamId: actor.employee.teamId,
    })

    return emp
  })

  return updated
}

// -------------------------------------------------------------------
// 6. Suspend Employee
// -------------------------------------------------------------------
export async function suspendEmployee(
  actor: EmployeeActor,
  id: string,
  input: { reason: string },
  ctx: { ip?: string | null } = {}
) {
  const target = await db.employee.findFirst({
    where: { id, teamId: actor.employee.teamId },
    include: { role: true },
  })

  if (!target) {
    throw new HttpError(404, 'Employee not found')
  }

  assertCanManage(
    {
      id: actor.session.user.id,
      role: actor.role,
      status: actor.employee.status,
      access: actor.access,
    },
    target,
    'suspend'
  )

  enforceRateLimit(actor.session.user.id, 'suspend')

  const suspended = await db.$transaction(async (tx) => {
    await assertNotLastOwner(tx, target)

    const emp = await tx.employee.update({
      where: { id: target.id },
      data: {
        status: EmployeeStatus.SUSPENDED,
        suspendedAt: new Date(),
        suspendedBy: actor.employee.id,
        suspendedReason: input.reason.trim(),
      },
      include: { role: true },
    })

    await revokeAllSessions(tx, target.userId)

    await writeAudit(tx, {
      actor: {
        id: actor.session.user.id,
        name: actor.session.user.name,
        email: actor.session.user.email,
        role: actor.role.key,
      },
      target: { id: target.id, email: target.email },
      action: AUDIT_ACTIONS.EMPLOYEE_SUSPEND,
      after: { reason: input.reason },
      ip: ctx.ip,
      teamId: actor.employee.teamId,
    })

    return emp
  })

  return suspended
}

// -------------------------------------------------------------------
// 7. Restore Employee
// -------------------------------------------------------------------
export async function restoreEmployee(
  actor: EmployeeActor,
  id: string,
  ctx: { ip?: string | null } = {}
) {
  const target = await db.employee.findFirst({
    where: { id, teamId: actor.employee.teamId },
    include: { role: true },
  })

  if (!target) {
    throw new HttpError(404, 'Employee not found')
  }

  assertCanManage(
    {
      id: actor.session.user.id,
      role: actor.role,
      status: actor.employee.status,
      access: actor.access,
    },
    target,
    'restore'
  )

  if (target.status !== EmployeeStatus.SUSPENDED) {
    throw new HttpError(400, 'Only suspended employees can be restored')
  }

  enforceRateLimit(actor.session.user.id, 'restore')

  const restored = await db.$transaction(async (tx) => {
    const emp = await tx.employee.update({
      where: { id: target.id },
      data: {
        status: EmployeeStatus.ACTIVE,
        suspendedAt: null,
        suspendedBy: null,
        suspendedReason: null,
      },
      include: { role: true },
    })

    await writeAudit(tx, {
      actor: {
        id: actor.session.user.id,
        name: actor.session.user.name,
        email: actor.session.user.email,
        role: actor.role.key,
      },
      target: { id: target.id, email: target.email },
      action: AUDIT_ACTIONS.EMPLOYEE_RESTORE,
      ip: ctx.ip,
      teamId: actor.employee.teamId,
    })

    return emp
  })

  return restored
}

// -------------------------------------------------------------------
// 8. Revoke Sessions
// -------------------------------------------------------------------
export async function revokeEmployeeSessions(
  actor: EmployeeActor,
  id: string,
  input?: { sessionId?: string },
  ctx: { ip?: string | null } = {}
) {
  const target = await db.employee.findFirst({
    where: { id, teamId: actor.employee.teamId },
    include: { role: true },
  })

  if (!target) {
    throw new HttpError(404, 'Employee not found')
  }

  assertCanManage(
    {
      id: actor.session.user.id,
      role: actor.role,
      status: actor.employee.status,
      access: actor.access,
    },
    target,
    'revoke_sessions'
  )

  enforceRateLimit(actor.session.user.id, 'revoke_sessions')

  const count = await db.$transaction(async (tx) => {
    let deletedCount = 0
    if (input?.sessionId) {
      const ok = await revokeSession(tx, target.userId, input.sessionId)
      deletedCount = ok ? 1 : 0
    } else {
      deletedCount = await revokeAllSessions(tx, target.userId)
    }

    await writeAudit(tx, {
      actor: {
        id: actor.session.user.id,
        name: actor.session.user.name,
        email: actor.session.user.email,
        role: actor.role.key,
      },
      target: { id: target.id, email: target.email },
      action: AUDIT_ACTIONS.EMPLOYEE_SESSIONS_REVOKED,
      after: {
        revokedCount: deletedCount,
        sessionId: input?.sessionId || 'all',
      },
      ip: ctx.ip,
      teamId: actor.employee.teamId,
    })

    return deletedCount
  })

  return { success: true, count }
}

// -------------------------------------------------------------------
// 9. Reset Password (with Step-Up Re-Authentication)
// -------------------------------------------------------------------
export async function resetEmployeePassword(
  actor: EmployeeActor,
  id: string,
  input: { actorPassword: string },
  ctx: { ip?: string | null } = {}
) {
  const target = await db.employee.findFirst({
    where: { id, teamId: actor.employee.teamId },
    include: { role: true },
  })

  if (!target) {
    throw new HttpError(404, 'Employee not found')
  }

  assertCanManage(
    {
      id: actor.session.user.id,
      role: actor.role,
      status: actor.employee.status,
      access: actor.access,
    },
    target,
    'reset_password'
  )

  // Step-up re-authentication
  const actorAccount = await db.account.findFirst({
    where: {
      userId: actor.session.user.id,
      providerId: 'credential',
    },
  })

  if (!actorAccount?.password) {
    throw new HttpError(
      403,
      'Step-up re-authentication requires a credential password account'
    )
  }

  // Rate limit failed re-auth attempts: 5 per 15 minutes
  const reauthKey = `reauth:${actor.session.user.id}`
  const reauthCheck = rateLimit(reauthKey, { limit: 5, windowMs: 15 * 60 * 1000 })

  if (!reauthCheck.ok) {
    throw new HttpError(
      429,
      `Too many failed re-authentication attempts. Please wait ${reauthCheck.retryAfter} seconds.`
    )
  }

  const isValidPassword = await verifyPassword({
    hash: actorAccount.password,
    password: input.actorPassword,
  })

  if (!isValidPassword) {
    await writeAudit(db, {
      actor: {
        id: actor.session.user.id,
        name: actor.session.user.name,
        email: actor.session.user.email,
        role: actor.role.key,
      },
      target: { id: target.id, email: target.email },
      action: AUDIT_ACTIONS.EMPLOYEE_PASSWORD_RESET_DENIED,
      ip: ctx.ip,
      teamId: actor.employee.teamId,
    })
    throw new HttpError(401, 'Invalid password')
  }

  enforceRateLimit(actor.session.user.id, 'reset_password')

  const expiresAt = defaultPasswordExpiry()
  const hashedDefaultPassword = await hashPassword(DEFAULT_PASSWORD)

  await db.$transaction(async (tx) => {
    const targetAccount = await tx.account.findFirst({
      where: { userId: target.userId, providerId: 'credential' },
    })

    if (targetAccount) {
      await tx.account.update({
        where: { id: targetAccount.id },
        data: { password: hashedDefaultPassword },
      })
    } else {
      const accountId = crypto.randomBytes(24).toString('base64url').slice(0, 32)
      await tx.account.create({
        data: {
          id: accountId,
          accountId: target.userId,
          userId: target.userId,
          providerId: 'credential',
          password: hashedDefaultPassword,
        },
      })
    }

    await tx.employee.update({
      where: { id: target.id },
      data: {
        mustChangePassword: true,
        defaultPasswordExpiresAt: expiresAt,
      },
    })

    await revokeAllSessions(tx, target.userId)

    await writeAudit(tx, {
      actor: {
        id: actor.session.user.id,
        name: actor.session.user.name,
        email: actor.session.user.email,
        role: actor.role.key,
      },
      target: { id: target.id, email: target.email },
      action: AUDIT_ACTIONS.EMPLOYEE_PASSWORD_RESET,
      ip: ctx.ip,
      teamId: actor.employee.teamId,
    })
  })

  return {
    defaultPasswordApplied: true,
    expiresAt,
  }
}

// -------------------------------------------------------------------
// 10. Delete Employee (Soft / Hard)
// -------------------------------------------------------------------
export async function deleteEmployee(
  actor: EmployeeActor,
  id: string,
  options?: { hard?: boolean; confirmEmail?: string },
  ctx: { ip?: string | null } = {}
) {
  const target = await db.employee.findFirst({
    where: { id, teamId: actor.employee.teamId },
    include: { role: true },
  })

  if (!target) {
    throw new HttpError(404, 'Employee not found')
  }

  if (options?.hard) {
    // Hard delete constraints
    if (process.env.ALLOW_HARD_DELETE !== '1') {
      throw new HttpError(403, 'Hard delete is disabled by system policy')
    }

    if (actor.role.key !== 'owner') {
      throw new HttpError(403, 'Only the owner can hard-delete employees')
    }

    if (target.status !== EmployeeStatus.TERMINATED) {
      throw new HttpError(400, 'Employee must be terminated before hard deletion')
    }

    if (
      !options.confirmEmail ||
      options.confirmEmail.toLowerCase().trim() !== target.email.toLowerCase().trim()
    ) {
      throw new HttpError(
        400,
        'Confirmation email must match target employee email exactly'
      )
    }

    enforceRateLimit(actor.session.user.id, 'hard_delete')

    await db.$transaction(async (tx) => {
      // 1. Audit log before deletion with masked email
      const maskedEmail = target.email.replace(/(?<=^.).+(?=@)/, '***')
      await writeAudit(tx, {
        actor: {
          id: actor.session.user.id,
          name: actor.session.user.name,
          email: actor.session.user.email,
          role: actor.role.key,
        },
        target: { id: target.id, email: maskedEmail },
        action: AUDIT_ACTIONS.EMPLOYEE_HARD_DELETE,
        ip: ctx.ip,
        teamId: actor.employee.teamId,
      })

      const shortId = crypto.randomBytes(4).toString('hex')
      const anonName = 'Deleted user'
      const anonEmail = `deleted-${shortId}@invalid`

      // 2. Anonymize user reference plain-string fields across related models
      await Promise.all([
        tx.teamMember.updateMany({
          where: { userId: target.userId },
          data: { userName: anonName, userEmail: anonEmail },
        }),
        tx.projectMember.updateMany({
          where: { userId: target.userId },
          data: { userName: anonName, userEmail: anonEmail },
        }),
        tx.standupEntry.updateMany({
          where: { userId: target.userId },
          data: { userName: anonName, userEmail: anonEmail },
        }),
        tx.teamChannelMember.updateMany({
          where: { userId: target.userId },
          data: { userName: anonName, userEmail: anonEmail },
        }),
        tx.teamChatReaction.updateMany({
          where: { userId: target.userId },
          data: { userName: anonName },
        }),
        tx.teamAnnouncementAck.updateMany({
          where: { userId: target.userId },
          data: { userName: anonName },
        }),
        tx.auditLog.updateMany({
          where: { userId: target.userId },
          data: { userName: anonName, userEmail: anonEmail },
        }),
        tx.comment.updateMany({
          where: { userId: target.userId },
          data: { userId: `anon-${shortId}` },
        }),
        tx.inboxMessage.deleteMany({
          where: { userId: target.userId },
        }),
        tx.issue.updateMany({
          where: { assigneeId: target.userId },
          data: { assigneeId: null },
        }),
        tx.project.updateMany({
          where: { leadId: target.userId },
          data: { leadId: null, lead: anonName },
        }),
        tx.lead.updateMany({
          where: { ownerId: target.userId },
          data: { ownerId: null },
        }),
      ])

      // 3. Delete user row (cascades sessions, accounts, employee, twofactors)
      await tx.user.delete({
        where: { id: target.userId },
      })
    })

    return { success: true, hard: true }
  }

  // Soft delete (default)
  assertCanManage(
    {
      id: actor.session.user.id,
      role: actor.role,
      status: actor.employee.status,
      access: actor.access,
    },
    target,
    'delete'
  )

  enforceRateLimit(actor.session.user.id, 'delete')

  const terminated = await db.$transaction(async (tx) => {
    await assertNotLastOwner(tx, target)

    const emp = await tx.employee.update({
      where: { id: target.id },
      data: {
        status: EmployeeStatus.TERMINATED,
        terminatedAt: new Date(),
      },
      include: { role: true },
    })

    await tx.teamMember.deleteMany({
      where: { userId: target.userId, teamId: target.teamId },
    })

    await revokeAllSessions(tx, target.userId)

    await writeAudit(tx, {
      actor: {
        id: actor.session.user.id,
        name: actor.session.user.name,
        email: actor.session.user.email,
        role: actor.role.key,
      },
      target: { id: target.id, email: target.email },
      action: AUDIT_ACTIONS.EMPLOYEE_DELETE,
      ip: ctx.ip,
      teamId: actor.employee.teamId,
    })

    return emp
  })

  return { success: true, employee: terminated }
}
