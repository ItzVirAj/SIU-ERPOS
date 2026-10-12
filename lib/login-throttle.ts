import crypto from 'node:crypto'
import { db } from './db'
import { writeAudit, AUDIT_ACTIONS, maskEmail } from './audit'

export function getLoginThrottleConfig() {
  const maxFailures = parseInt(process.env.LOGIN_MAX_FAILURES || '5', 10)
  const windowMinutes = parseInt(process.env.LOGIN_WINDOW_MINUTES || '15', 10)
  const lockMinutes = parseInt(process.env.LOGIN_LOCK_MINUTES || '15', 10)
  const lockMaxMinutes = parseInt(process.env.LOGIN_LOCK_MAX_MINUTES || '60', 10)

  return {
    maxFailures: Number.isInteger(maxFailures) && maxFailures > 0 ? maxFailures : 5,
    windowMinutes: Number.isInteger(windowMinutes) && windowMinutes > 0 ? windowMinutes : 15,
    lockMinutes: Number.isInteger(lockMinutes) && lockMinutes > 0 ? lockMinutes : 15,
    lockMaxMinutes: Number.isInteger(lockMaxMinutes) && lockMaxMinutes > 0 ? lockMaxMinutes : 60,
  }
}

/**
 * Generates a SHA-256 hash of the trimmed, lowercased email.
 * Raw emails are NEVER stored in the throttle ledger.
 */
export function hashEmailKey(email: string): string {
  const normalized = email.trim().toLowerCase()
  return crypto.createHash('sha256').update(normalized).digest('hex')
}

export interface LockStatus {
  locked: boolean
  lockedUntil?: Date | null
  retryAfterSeconds?: number
}

/**
 * Checks whether the account associated with the given email is currently locked.
 */
export async function checkLock(email: string): Promise<LockStatus> {
  if (!email || typeof email !== 'string') {
    return { locked: false }
  }

  const key = hashEmailKey(email)
  const record = await db.loginThrottle.findUnique({
    where: { key },
  })

  if (!record || !record.lockedUntil) {
    return { locked: false }
  }

  const now = new Date()
  if (record.lockedUntil > now) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((record.lockedUntil.getTime() - now.getTime()) / 1000)
    )
    return {
      locked: true,
      lockedUntil: record.lockedUntil,
      retryAfterSeconds,
    }
  }

  return { locked: false }
}

/**
 * Atomically records a login failure for the given email.
 * Implements exponential lockouts under consecutive failures.
 * Uses PostgreSQL row-level locks (FOR UPDATE) to guarantee concurrency safety.
 */
export async function recordFailure(email: string): Promise<LockStatus & { failedCount?: number }> {
  if (!email || typeof email !== 'string') {
    return { locked: false }
  }

  const key = hashEmailKey(email)
  const config = getLoginThrottleConfig()
  const windowMs = config.windowMinutes * 60 * 1000
  const resetAfterMs = 24 * 60 * 60 * 1000 // Reset lock count after 24h of inactivity

  return await db.$transaction(async (tx) => {
    // 1. Ensure row exists atomically
    await tx.$executeRaw`
      INSERT INTO "login_throttle" ("id", "key", "failedCount", "windowStart", "lockCount", "updatedAt")
      VALUES (gen_random_uuid(), ${key}, 0, NOW(), 0, NOW())
      ON CONFLICT ("key") DO NOTHING
    `

    // 2. Lock row for atomic increment
    const rows = await tx.$queryRaw<Array<{
      id: string
      key: string
      failedCount: number
      windowStart: Date
      lockedUntil: Date | null
      lockCount: number
      updatedAt: Date
    }>>`
      SELECT "id", "key", "failedCount", "windowStart", "lockedUntil", "lockCount", "updatedAt"
      FROM "login_throttle"
      WHERE "key" = ${key}
      FOR UPDATE
    `

    const existing = rows[0]
    const now = new Date()

    // 3. Reset lock count if inactive for > 24 hours
    let lockCount = existing.lockCount
    if (existing.updatedAt && now.getTime() - new Date(existing.updatedAt).getTime() > resetAfterMs) {
      lockCount = 0
    }

    // 4. If already locked, maintain lock status
    if (existing.lockedUntil && new Date(existing.lockedUntil) > now) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((new Date(existing.lockedUntil).getTime() - now.getTime()) / 1000)
      )
      return {
        locked: true,
        lockedUntil: new Date(existing.lockedUntil),
        retryAfterSeconds,
      }
    }

    // 5. Evaluate window and increment failure count
    let windowStart = existing.windowStart ? new Date(existing.windowStart) : now
    let failedCount = existing.failedCount

    if (now.getTime() - windowStart.getTime() > windowMs) {
      windowStart = now
      failedCount = 1
    } else {
      failedCount += 1
    }

    // 6. Check if lockout threshold reached
    if (failedCount >= config.maxFailures) {
      const lockMinutes = Math.min(
        config.lockMinutes * Math.pow(2, lockCount),
        config.lockMaxMinutes
      )
      const lockedUntil = new Date(now.getTime() + lockMinutes * 60 * 1000)
      const nextLockCount = lockCount + 1

      await tx.loginThrottle.update({
        where: { key },
        data: {
          failedCount: 0,
          windowStart: now,
          lockedUntil,
          lockCount: nextLockCount,
        },
      })

      // Audit log the lock event (never log email in clear)
      const user = await tx.user.findFirst({
        where: { email: { equals: email.trim().toLowerCase(), mode: 'insensitive' } },
        select: { id: true },
      })

      await writeAudit(tx, {
        actor: user ? { id: user.id } : { id: 'unauthenticated' },
        action: AUDIT_ACTIONS.AUTH_ACCOUNT_LOCKED,
        before: {
          account: maskEmail(email),
          lockDurationMinutes: lockMinutes,
          lockedUntil: lockedUntil.toISOString(),
          lockCount: nextLockCount,
        },
      })

      return {
        locked: true,
        lockedUntil,
        retryAfterSeconds: Math.ceil(lockMinutes * 60),
      }
    }

    // 7. Increment failure under threshold
    await tx.loginThrottle.update({
      where: { key },
      data: {
        failedCount,
        windowStart,
        lockedUntil: null,
        lockCount,
      },
    })

    return {
      locked: false,
      failedCount,
    }
  })
}

/**
 * Resets the throttle entry completely on successful sign-in.
 */
export async function recordSuccess(email: string): Promise<void> {
  if (!email || typeof email !== 'string') return
  const key = hashEmailKey(email)
  await db.loginThrottle.deleteMany({
    where: { key },
  })
}

/**
 * Unlocks the account and resets failed count while preserving history.
 */
export async function unlock(email: string): Promise<void> {
  if (!email || typeof email !== 'string') return
  const key = hashEmailKey(email)
  await db.loginThrottle.updateMany({
    where: { key },
    data: {
      lockedUntil: null,
      failedCount: 0,
    },
  })
}

/**
 * Returns current lock status and expiration for an email.
 */
export async function getLockStatus(email: string): Promise<{ locked: boolean; lockedUntil: Date | null }> {
  if (!email || typeof email !== 'string') {
    return { locked: false, lockedUntil: null }
  }

  const key = hashEmailKey(email)
  const record = await db.loginThrottle.findUnique({
    where: { key },
  })

  if (!record || !record.lockedUntil || record.lockedUntil <= new Date()) {
    return { locked: false, lockedUntil: null }
  }

  return {
    locked: true,
    lockedUntil: record.lockedUntil,
  }
}
