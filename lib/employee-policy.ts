/**
 * Employee Provisioning & Password Policy Definitions
 * Authoritative business rules for employee lifecycle and authentication.
 */

export const PROVISIONER_ROLES = ['owner', 'hr', 'cto'] as const

export type ProvisionerRole = (typeof PROVISIONER_ROLES)[number]

/**
 * Checks whether the given role is allowed to provision employees or assign/change roles.
 */
export function canProvision(actorRoleKey?: string | null): boolean {
  if (!actorRoleKey) return false
  const normalized = actorRoleKey.toLowerCase().trim()
  return (PROVISIONER_ROLES as readonly string[]).includes(normalized)
}

export const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD || 'Pass@123'
export const DEFAULT_PASSWORD_TTL_DAYS = parseInt(
  process.env.DEFAULT_PASSWORD_TTL_DAYS || '7',
  10
)

/**
 * Calculates the expiration timestamp for the default/temporary password.
 */
export function defaultPasswordExpiry(): Date {
  return new Date(Date.now() + DEFAULT_PASSWORD_TTL_DAYS * 24 * 60 * 60 * 1000)
}

// Startup warning guard:
if (
  process.env.NODE_ENV === 'production' &&
  (DEFAULT_PASSWORD === 'Pass@123' || !process.env.DEFAULT_PASSWORD)
) {
  console.warn(
    '[SECURITY WARNING] DEFAULT_PASSWORD is set to the default development value in production! ' +
      'Set DEFAULT_PASSWORD to a strong random value immediately.'
  )
}
