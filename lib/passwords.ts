import crypto from 'crypto'
import { DEFAULT_PASSWORD } from './employee-policy'

const COMMON_PASSWORDS = new Set([
  'password123!',
  'welcome@123',
  'welcome@123!',
  'welcome@123456',
  'qwerty123456',
  'qwerty123456!',
  'admin123456!',
  'letmein1234!',
  'password@123',
  'company@1234',
  'sketchitup123!',
  'pass@123456!',
  'changeme123!',
  'iloveyou123!',
  'secret12345!',
  'pass@word123!',
  'monkey12345!',
  'dragon12345!',
  'master12345!',
  'trustno1123!',
  'football123!',
  'baseball123!',
  'superman123!',
  'batman12345!',
  'shadow12345!',
  'sunshine123!',
  'princess123!',
  'solo1234567!',
  'qwertyuiop1!',
  '123456789012!',
  'abc123456789!',
])

export interface PasswordValidationOptions {
  email?: string | null
  currentPasswordMatches?: boolean
}

/**
 * Validates a new password against security invariants:
 * - Length between 12 and 128 characters
 * - Requires uppercase, lowercase, digit, and symbol
 * - Cannot equal DEFAULT_PASSWORD (case-insensitively)
 * - Cannot equal the current password
 * - Cannot contain the email local-part
 * - Cannot match common dictionary passwords
 */
export function validateNewPassword(
  password: string,
  options?: PasswordValidationOptions
): string[] {
  const problems: string[] = []

  if (!password || password.length < 12) {
    problems.push('Password must be at least 12 characters long')
  }

  if (password && password.length > 128) {
    problems.push('Password cannot exceed 128 characters')
  }

  if (!/[A-Z]/.test(password)) {
    problems.push('Password must contain at least one uppercase letter')
  }

  if (!/[a-z]/.test(password)) {
    problems.push('Password must contain at least one lowercase letter')
  }

  if (!/[0-9]/.test(password)) {
    problems.push('Password must contain at least one number')
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    problems.push('Password must contain at least one special character or symbol')
  }

  // Must not equal company default password
  if (password.toLowerCase() === DEFAULT_PASSWORD.toLowerCase()) {
    problems.push('Password cannot be the default temporary password')
  }

  // Must not equal current password
  if (options?.currentPasswordMatches) {
    problems.push('New password cannot be the same as your current password')
  }

  // Must not contain email local part
  if (options?.email) {
    const localPart = options.email.split('@')[0]?.toLowerCase().trim()
    if (localPart && localPart.length >= 3 && password.toLowerCase().includes(localPart)) {
      problems.push('Password cannot contain your email username')
    }
  }

  // Must not be in common passwords list
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    problems.push('Password is too common and easily guessed. Please choose a more complex password')
  }

  return problems
}

/**
 * Generates a cryptographically strong random password for optional invite links.
 */
export function generateRandomPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const digits = '23456789'
  const symbols = '!@#$%^&*()-_=+[]{}'
  const all = upper + lower + digits + symbols

  // Guarantee at least one of each required category
  let pwd = [
    upper[crypto.randomInt(0, upper.length)],
    lower[crypto.randomInt(0, lower.length)],
    digits[crypto.randomInt(0, digits.length)],
    symbols[crypto.randomInt(0, symbols.length)],
  ]

  for (let i = 0; i < 12; i++) {
    pwd.push(all[crypto.randomInt(0, all.length)])
  }

  // Shuffle array using Fisher-Yates
  for (let i = pwd.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1)
    const temp = pwd[i]
    pwd[i] = pwd[j]
    pwd[j] = temp
  }

  return pwd.join('')
}
