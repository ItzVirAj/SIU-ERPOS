import { HttpError } from './authz'

/**
 * ARCHITECTURAL NOTE & LIMITATION:
 * This rate limiter uses an in-memory sliding window map per Node.js process instance.
 * - State resets whenever the server process restarts.
 * - Rate counters are NOT shared across distributed or serverless instances.
 * In a multi-replica or edge deployment, replace or augment this layer with a distributed
 * store like Redis (e.g., Upstash Redis) or PostgreSQL-backed rate limiting (as used in auth.ts).
 */

interface RateLimitRecord {
  timestamps: number[]
}

const rateLimitStore = new Map<string, RateLimitRecord>()

// Periodically clean up stale entries (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(() => {
    const now = Date.now()
    for (const [key, record] of rateLimitStore.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < 300_000)
      if (record.timestamps.length === 0) {
        rateLimitStore.delete(key)
      }
    }
  }, 300_000)
  if (timer.unref) {
    timer.unref()
  }
}

export interface RateLimitOptions {
  limit: number
  windowMs: number
}

export interface RateLimitResult {
  ok: boolean
  retryAfter?: number
}

/**
 * Evaluates a sliding window rate limit for a specific key.
 */
export function rateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now()
  const { limit, windowMs } = options

  let record = rateLimitStore.get(key)
  if (!record) {
    record = { timestamps: [] }
    rateLimitStore.set(key, record)
  }

  // Filter timestamps within the current window
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs)

  if (record.timestamps.length >= limit) {
    const oldest = record.timestamps[0]
    const resetTime = oldest + windowMs
    const retryAfter = Math.max(1, Math.ceil((resetTime - now) / 1000))
    return { ok: false, retryAfter }
  }

  record.timestamps.push(now)
  return { ok: true }
}

/**
 * Enforces rate limits for employee/admin actions.
 * Throws HttpError(429) if the limit is exceeded.
 */
export function enforceRateLimit(
  actorId: string,
  action: string,
  customOptions?: { limit?: number; windowMs?: number }
): void {
  const isHighImpact = [
    'reset_password',
    'create',
    'delete',
    'hard_delete',
  ].includes(action)

  // Default: High impact: 10 requests / min; Others: 60 requests / min
  const limit = customOptions?.limit ?? (isHighImpact ? 10 : 60)
  const windowMs = customOptions?.windowMs ?? 60_000

  const key = `authz:${actorId}:${action}`
  const result = rateLimit(key, { limit, windowMs })

  if (!result.ok) {
    const err = new HttpError(
      429,
      `Too many requests. Please wait ${result.retryAfter} seconds before retrying.`
    )
    err.code = 'RATE_LIMITED'
    throw err
  }
}

/**
 * Resets the in-memory rate limit store (useful for tests).
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear()
}
