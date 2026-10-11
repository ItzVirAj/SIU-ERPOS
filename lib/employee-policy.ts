/**
 * Employee Provisioning & Password Policy Definitions
 * Authoritative business rules for employee lifecycle and authentication.
 */

import { HttpError } from './authz'
import { validatePasswordStrength } from './production-config'

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

/**
 * Returns the active default password.
 * In development / test, falls back to "Pass@123".
 * In production, requires a valid, compliant DEFAULT_PASSWORD or throws HttpError(500).
 */
export function getDefaultPassword(): string {
  if (process.env.NODE_ENV === 'production') {
    const pw = process.env.DEFAULT_PASSWORD
    if (!pw || validatePasswordStrength(pw).length > 0) {
      throw new HttpError(500, 'Default password is not configured')
    }
    return pw
  }
  return process.env.DEFAULT_PASSWORD || 'Pass@123'
}

export const DEFAULT_PASSWORD =
  process.env.NODE_ENV === 'production'
    ? process.env.DEFAULT_PASSWORD || ''
    : process.env.DEFAULT_PASSWORD || 'Pass@123'

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

// Startup warning guard for non-production environments using fallback
if (
  process.env.NODE_ENV !== 'production' &&
  (!process.env.DEFAULT_PASSWORD || process.env.DEFAULT_PASSWORD === 'Pass@123')
) {
  // Silent or info in dev
}
