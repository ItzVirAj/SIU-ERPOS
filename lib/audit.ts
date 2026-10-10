import { Prisma, PrismaClient } from './prisma-client'
import { db } from './db'

export const AUDIT_ACTIONS = {
  EMPLOYEE_CREATE: 'employee.create',
  EMPLOYEE_UPDATE: 'employee.update',
  EMPLOYEE_ROLE_CHANGE: 'employee.role_change',
  EMPLOYEE_SUSPEND: 'employee.suspend',
  EMPLOYEE_RESTORE: 'employee.restore',
  EMPLOYEE_SESSIONS_REVOKED: 'employee.sessions_revoked',
  EMPLOYEE_PASSWORD_RESET: 'employee.password_reset',
  EMPLOYEE_PASSWORD_RESET_DENIED: 'employee.password_reset_denied',
  EMPLOYEE_DELETE: 'employee.delete',
  EMPLOYEE_HARD_DELETE: 'employee.hard_delete',
  EMPLOYEE_PASSWORD_CHANGED: 'employee.password_changed',
  AUTH_LOGIN_BLOCKED: 'auth.login_blocked',
  TEAM_EXPORT: 'team.export',
  TEAM_DELETE: 'team.delete',
} as const

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]

const SENSITIVE_KEY_REGEX = /pass(word)?|token|secret|hash|authorization|cookie/i
const MAX_STRING_LENGTH = 500

/**
 * Recursively sanitizes data:
 * - Drops any keys matching sensitive regex (passwords, tokens, secrets, hashes, cookies, etc.)
 * - Truncates long strings to MAX_STRING_LENGTH characters
 */
export function sanitizeAuditData<T>(data: T): T {
  if (data === null || data === undefined) {
    return data
  }

  if (typeof data === 'string') {
    if (data.length > MAX_STRING_LENGTH) {
      return `${data.slice(0, MAX_STRING_LENGTH)}...[TRUNCATED]` as unknown as T
    }
    return data
  }

  if (typeof data !== 'object') {
    return data
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeAuditData(item)) as unknown as T
  }

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      continue
    }
    sanitized[key] = sanitizeAuditData(value)
  }

  return sanitized as T
}

/**
 * Truncate/mask IP addresses for privacy/security:
 * IPv4 -> first 3 octets (192.168.1.xxx)
 * IPv6 -> /48 prefix (2001:db8:85a3::xxxx)
 */
export function maskIp(ip?: string | null): string | null {
  if (!ip) return null
  const cleanIp = ip.trim()
  if (cleanIp === '::1' || cleanIp === '127.0.0.1' || cleanIp === 'localhost') {
    return cleanIp
  }

  if (cleanIp.includes('.')) {
    const parts = cleanIp.split('.')
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`
    }
  }

  if (cleanIp.includes(':')) {
    const parts = cleanIp.split(':')
    return `${parts.slice(0, 3).join(':')}::xxxx`
  }

  return 'masked'
}

/**
 * Extracts client IP from request headers or request object, masked to first 3 octets or /48.
 */
export function getClientIp(req: Request | { headers: Headers | Record<string, string | string[] | undefined> } | null): string | null {
  if (!req) return null

  let forwarded: string | null = null
  if ('headers' in req) {
    if (typeof (req.headers as Headers).get === 'function') {
      forwarded = (req.headers as Headers).get('x-forwarded-for')
    } else {
      const h = req.headers as Record<string, string | string[] | undefined>
      const val = h['x-forwarded-for']
      forwarded = Array.isArray(val) ? val[0] : val || null
    }
  }

  if (forwarded) {
    const firstIp = forwarded.split(',')[0].trim()
    return maskIp(firstIp)
  }

  if ('ip' in req && typeof (req as { ip?: string }).ip === 'string') {
    return maskIp((req as { ip?: string }).ip)
  }

  return null
}

export interface WriteAuditParams {
  actor: {
    id: string
    name?: string | null
    email?: string | null
    role?: string | { key: string } | null
  }
  target?: {
    id?: string | null
    email?: string | null
  } | null
  action: string
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  ip?: string | null
  teamId?: string | null
}

type PrismaOrTx = PrismaClient | Prisma.TransactionClient

/**
 * Writes an immutable audit log row using the shared schema.
 */
export async function writeAudit(
  client: PrismaOrTx,
  params: WriteAuditParams
): Promise<void> {
  const { actor, target, action, before, after, ip, teamId } = params

  let resolvedTeamId = teamId

  if (!resolvedTeamId && actor.id) {
    const member = await client.teamMember.findFirst({
      where: { userId: actor.id },
      select: { teamId: true },
    })
    if (member) {
      resolvedTeamId = member.teamId
    } else {
      const emp = await client.employee.findUnique({
        where: { userId: actor.id },
        select: { teamId: true },
      })
      if (emp) {
        resolvedTeamId = emp.teamId
      }
    }
  }

  if (!resolvedTeamId) {
    const fallbackTeam = await client.team.findFirst({ select: { id: true } })
    resolvedTeamId = fallbackTeam?.id
  }

  if (!resolvedTeamId) {
    console.warn(`[writeAudit] Skipped writing audit log for "${action}": no team found`)
    return
  }

  const actorRoleStr =
    typeof actor.role === 'object' && actor.role !== null
      ? actor.role.key
      : typeof actor.role === 'string'
      ? actor.role
      : null

  const sanitizedBefore = before ? (sanitizeAuditData(before) as Prisma.InputJsonValue) : null
  const sanitizedAfter = after ? (sanitizeAuditData(after) as Prisma.InputJsonValue) : null

  const maskedIpAddress = maskIp(ip)

  await client.auditLog.create({
    data: {
      teamId: resolvedTeamId,
      userId: actor.id,
      userName: actor.name || 'System / User',
      userEmail: actor.email || 'system@internal',
      action,
      entityType: 'employee',
      entityId: target?.id || null,
      entityTitle: target?.email || action,
      details: {
        ...(sanitizedBefore ? { before: sanitizedBefore } : {}),
        ...(sanitizedAfter ? { after: sanitizedAfter } : {}),
      } as Prisma.InputJsonValue,
      ipAddress: maskedIpAddress,
      actorRole: actorRoleStr,
      targetId: target?.id || null,
      targetEmail: target?.email || null,
      before: sanitizedBefore ?? Prisma.JsonNull,
      after: sanitizedAfter ?? Prisma.JsonNull,
    },
  })
}

// -------------------------------------------------------------------
// Backwards compatibility with legacy createAuditLog calls
// -------------------------------------------------------------------
export interface LogAuditParams {
  userId?: string
  userName?: string
  userEmail?: string
  teamId?: string
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'SECURITY' | 'EXPORT' | 'LOGIN' | string
  entityType: string
  entityId?: string
  entityTitle?: string
  details?: Record<string, unknown>
  ipAddress?: string | null
}

export async function createAuditLog(params: LogAuditParams): Promise<void> {
  try {
    let resolvedTeamId = params.teamId

    if (!resolvedTeamId && params.userId) {
      const membership = await db.teamMember.findFirst({
        where: { userId: params.userId },
        select: { teamId: true, userName: true, userEmail: true },
      })
      if (membership) {
        resolvedTeamId = membership.teamId
        params.userName = params.userName || membership.userName
        params.userEmail = params.userEmail || membership.userEmail
      }
    }

    if (!resolvedTeamId) {
      const fallbackTeam = await db.team.findFirst({ select: { id: true } })
      resolvedTeamId = fallbackTeam?.id
    }

    if (!resolvedTeamId) {
      return
    }

    await db.auditLog.create({
      data: {
        teamId: resolvedTeamId,
        userId: params.userId || 'system',
        userName: params.userName || 'System / Unauthenticated',
        userEmail: params.userEmail || 'system@internal',
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        entityTitle: params.entityTitle || params.action,
        details: params.details ? (sanitizeAuditData(params.details) as Prisma.InputJsonValue) : {},
        ipAddress: maskIp(params.ipAddress),
      },
    })
  } catch (error) {
    console.error('Failed to write audit log:', error)
  }
}
