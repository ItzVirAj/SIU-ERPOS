/**
 * Validates whether a candidate default password meets security requirements:
 * - Not equal to "Pass@123" (case-insensitive)
 * - At least 12 characters
 * - Contains at least one uppercase letter
 * - Contains at least one lowercase letter
 * - Contains at least one digit
 * - Contains at least one symbol
 */
export function validatePasswordStrength(password: string): string[] {
  const issues: string[] = []
  if (!password || password.trim() === '') {
    issues.push('Password cannot be empty')
    return issues
  }
  if (password.toLowerCase() === 'pass@123') {
    issues.push('Password must not be "Pass@123"')
  }
  if (password.length < 12) {
    issues.push('Password must be at least 12 characters')
  }
  if (!/[A-Z]/.test(password)) {
    issues.push('Password must contain at least one uppercase letter')
  }
  if (!/[a-z]/.test(password)) {
    issues.push('Password must contain at least one lowercase letter')
  }
  if (!/[0-9]/.test(password)) {
    issues.push('Password must contain at least one digit')
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    issues.push('Password must contain at least one symbol')
  }
  return issues
}

/**
 * Asserts production environment configuration.
 * When NODE_ENV === 'production', throws a clear error listing every violation.
 */
export function assertProductionConfig(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') {
    return
  }

  const errors: string[] = []

  // 1. BETTER_AUTH_SECRET
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) {
    errors.push('BETTER_AUTH_SECRET is missing or under 32 characters')
  }

  // 2. BETTER_AUTH_URL
  if (!env.BETTER_AUTH_URL || env.BETTER_AUTH_URL.trim() === '') {
    errors.push('BETTER_AUTH_URL is missing')
  }

  // 3. NEXT_PUBLIC_APP_URL
  if (!env.NEXT_PUBLIC_APP_URL || env.NEXT_PUBLIC_APP_URL.trim() === '') {
    errors.push('NEXT_PUBLIC_APP_URL is missing')
  }

  // 4. APP_ENCRYPTION_KEY
  if (!env.APP_ENCRYPTION_KEY || env.APP_ENCRYPTION_KEY.trim() === '') {
    errors.push('APP_ENCRYPTION_KEY is missing')
  } else {
    try {
      const buf = Buffer.from(env.APP_ENCRYPTION_KEY.trim(), 'base64')
      if (buf.length !== 32) {
        errors.push(`APP_ENCRYPTION_KEY must be 32 bytes of base64 (got ${buf.length} bytes)`)
      }
    } catch {
      errors.push('APP_ENCRYPTION_KEY is not valid base64')
    }
  }

  // 5. DEFAULT_PASSWORD
  const dp = env.DEFAULT_PASSWORD
  if (!dp || dp.trim() === '') {
    errors.push('DEFAULT_PASSWORD is missing')
  } else {
    const pwIssues = validatePasswordStrength(dp)
    for (const issue of pwIssues) {
      errors.push(`DEFAULT_PASSWORD: ${issue}`)
    }
  }

  // 6. ALLOW_HARD_DELETE
  const ahd = env.ALLOW_HARD_DELETE
  if (ahd !== undefined && ahd !== '' && ahd !== '0' && ahd !== '1') {
    errors.push(`ALLOW_HARD_DELETE must be unset, "0" or "1" (got "${ahd}")`)
  }

  if (errors.length > 0) {
    throw new Error(
      `[PRODUCTION CONFIGURATION ERROR] The server cannot start due to invalid production settings:\n` +
        errors.map((e) => `  - ${e}`).join('\n')
    )
  }
}
