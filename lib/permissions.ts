import { db } from './db'
import {
  AppModule,
  AccessLevel,
  LegacyTeamRole,
  MODULES,
  ROLES_BY_KEY,
} from './role-definitions'

export const LEVEL_RANK: Record<AccessLevel, number> = {
  [AccessLevel.NONE]: 0,
  [AccessLevel.VIEW]: 1,
  [AccessLevel.WRITE]: 2,
  [AccessLevel.MANAGE]: 3,
}

/**
 * Checks whether the given module access satisfies the required access level.
 */
export function hasAccess(
  access: Record<AppModule, AccessLevel> | undefined | null,
  module: AppModule,
  required: AccessLevel
): boolean {
  if (!access) return false
  const currentLevel = access[module] ?? AccessLevel.NONE
  return (LEVEL_RANK[currentLevel] ?? 0) >= (LEVEL_RANK[required] ?? 0)
}

/**
 * Hierarchy rule: actorLevel must be strictly higher than targetLevel.
 */
export function canManageLevel(actorLevel: number, targetLevel: number): boolean {
  return actorLevel > targetLevel
}

/**
 * Maps a role key or role entity to its legacy team role ('admin' | 'developer' | 'viewer').
 */
export function toLegacyTeamRole(
  roleInput: string | { legacyTeamRole: string }
): LegacyTeamRole {
  if (typeof roleInput === 'object' && roleInput !== null && 'legacyTeamRole' in roleInput) {
    return roleInput.legacyTeamRole as LegacyTeamRole
  }
  const roleDef = ROLES_BY_KEY[roleInput]
  return roleDef?.legacyTeamRole ?? 'viewer'
}

interface RoleCacheEntry {
  access: Record<AppModule, AccessLevel>
  expiresAt: number
}

const roleCache = new Map<string, RoleCacheEntry>()

/**
 * Explicitly clears the role access cache for a given key or all keys.
 */
export function clearRoleCache(roleKey?: string): void {
  if (roleKey) {
    roleCache.delete(roleKey)
  } else {
    roleCache.clear()
  }
}

/**
 * Loads the role access map for a roleKey from the database with 60-second in-memory caching.
 */
export async function loadRoleAccess(
  roleKey: string
): Promise<Record<AppModule, AccessLevel>> {
  const cached = roleCache.get(roleKey)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.access
  }

  const role = await db.role.findUnique({
    where: { key: roleKey },
    include: { access: true },
  })

  const accessMap = {} as Record<AppModule, AccessLevel>
  for (const mod of MODULES) {
    accessMap[mod] = AccessLevel.NONE
  }

  if (role) {
    for (const item of role.access) {
      accessMap[item.module as AppModule] = item.level as AccessLevel
    }
  } else if (ROLES_BY_KEY[roleKey]) {
    // Fallback to definition if not in database yet
    Object.assign(accessMap, ROLES_BY_KEY[roleKey].access)
  }

  roleCache.set(roleKey, {
    access: accessMap,
    expiresAt: Date.now() + 60_000,
  })

  return accessMap
}
