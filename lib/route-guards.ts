import { requireEmployee, HttpError, AuthzOptions } from './authz'
import { AppModule, AccessLevel, Employee, User, Role } from './prisma-client'
import { hasAccess, toLegacyTeamRole } from './permissions'

export interface RouteGuardRequirement {
  module: AppModule
  level: AccessLevel
}

export interface TeamActorContext {
  session: any
  employee: Employee & { role: Role }
  role: Role
  access: Record<AppModule, AccessLevel>
  user: any
  userId: string
  member: {
    id: string
    userId: string
    teamId: string
    role: string
    roleKey: string
    userName: string
    userEmail: string
  }
}

/**
 * Unified authorization helper for team-scoped API routes.
 *
 * Rules:
 * 1. Executes requireEmployee() -> rejects unauthenticated (401), suspended (403),
 *    terminated (403), and password-change-pending (403) actors.
 * 2. Enforces team boundary: actor.employee.teamId === teamId.
 *    Throws HttpError(404, 'Team not found') on mismatch to avoid leaking team existence.
 * 3. Enforces RBAC permissions: checks hasAccess(actor.access, module, level) for each guard.
 *    Throws HttpError(403, 'Forbidden', 'FORBIDDEN') on insufficient privileges.
 * 4. Returns the full actor context including user, userId, employee, and legacy member alias.
 */
export async function requireTeamAccess(
  teamId: string,
  guard: RouteGuardRequirement | RouteGuardRequirement[],
  options?: AuthzOptions
): Promise<TeamActorContext> {
  if (!teamId || typeof teamId !== 'string') {
    throw new HttpError(400, 'Team ID is required', 'BAD_REQUEST')
  }

  // 1. Authenticate and enforce employee usability
  const actor = await requireEmployee(options)

  // 2. Tenancy boundary: strictly verify caller belongs to this team.
  // Returns 404 to prevent enumerating whether teamId exists.
  if (actor.employee.teamId !== teamId) {
    throw new HttpError(404, 'Team not found', 'TEAM_NOT_FOUND')
  }

  // 3. Module and AccessLevel check against authoritative role matrix
  const requirements = Array.isArray(guard) ? guard : [guard]
  for (const req of requirements) {
    if (!hasAccess(actor.access, req.module, req.level)) {
      throw new HttpError(
        403,
        `Forbidden: Insufficient privileges for module ${req.module}`,
        'FORBIDDEN'
      )
    }
  }

  return {
    ...actor,
    user: actor.session.user,
    userId: actor.session.user.id,
    member: {
      id: actor.employee.id,
      userId: actor.session.user.id,
      teamId: actor.employee.teamId,
      role: toLegacyTeamRole(actor.employee.role.key),
      roleKey: actor.employee.role.key,
      userName: actor.employee.fullName,
      userEmail: actor.employee.email,
    },
  }
}
