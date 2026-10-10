import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { hashPassword, verifyPassword } from 'better-auth/crypto'
import {
  requireEmployee,
  handleRouteError,
  HttpError,
} from '@/lib/authz'
import { db } from '@/lib/db'
import { validateNewPassword } from '@/lib/passwords'
import { rateLimit } from '@/lib/rate-limit'
import { writeAudit, getClientIp, AUDIT_ACTIONS } from '@/lib/audit'

function assertOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return
  const allowedOrigins = [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]
    .filter(Boolean)
    .map((u) => {
      try {
        return new URL(u!).origin
      } catch {
        return null
      }
    })
    .filter(Boolean)

  if (!allowedOrigins.includes(origin)) {
    throw new HttpError(403, 'Forbidden: Origin mismatch')
  }
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(12, 'New password must be at least 12 characters'),
  })
  .strict()

export async function POST(request: NextRequest) {
  try {
    assertOrigin(request)
    // Allowed while mustChangePassword is true!
    const context = await requireEmployee({ allowPasswordChangePending: true })
    const { session, employee } = context
    const userId = session.user.id

    const rawBody = await request.json()
    const { currentPassword, newPassword } = changePasswordSchema.parse(rawBody)

    // Rate-limit failed attempts: 5 per 15 minutes per user
    const rateLimitKey = `authz:change_pass:${userId}`
    const limitCheck = rateLimit(rateLimitKey, { limit: 5, windowMs: 15 * 60 * 1000 })
    if (!limitCheck.ok) {
      throw new HttpError(
        429,
        `Too many password change attempts. Please wait ${limitCheck.retryAfter} seconds.`
      )
    }

    // Verify current credential account password
    const account = await db.account.findFirst({
      where: { userId, providerId: 'credential' },
    })

    if (!account?.password) {
      throw new HttpError(400, 'No credential password account found to update')
    }

    const currentMatches = await verifyPassword({
      hash: account.password,
      password: currentPassword,
    })

    if (!currentMatches) {
      throw new HttpError(400, 'Incorrect current password')
    }

    // Validate new password rules
    const newMatchesCurrent = await verifyPassword({
      hash: account.password,
      password: newPassword,
    })

    const validationErrors = validateNewPassword(newPassword, {
      email: employee.email,
      currentPasswordMatches: newMatchesCurrent,
    })

    if (validationErrors.length > 0) {
      throw new HttpError(400, validationErrors.join('. '))
    }

    const newHashedPassword = await hashPassword(newPassword)
    const ip = getClientIp(request)

    await db.$transaction(async (tx) => {
      // 1. Update account password
      await tx.account.update({
        where: { id: account.id },
        data: { password: newHashedPassword },
      })

      // 2. Clear mustChangePassword and defaultPasswordExpiresAt on employee
      await tx.employee.update({
        where: { id: employee.id },
        data: {
          mustChangePassword: false,
          defaultPasswordExpiresAt: null,
        },
      })

      // 3. Revoke all OTHER sessions of this user (keep current session)
      const currentSessionId = session.session?.id
      if (currentSessionId) {
        await tx.session.deleteMany({
          where: {
            userId,
            id: { not: currentSessionId },
          },
        })
      }

      // 4. Write audit log
      await writeAudit(tx, {
        actor: {
          id: userId,
          name: session.user.name,
          email: session.user.email,
          role: employee.role.key,
        },
        target: { id: employee.id, email: employee.email },
        action: AUDIT_ACTIONS.EMPLOYEE_PASSWORD_CHANGED,
        ip,
        teamId: employee.teamId,
      })
    })

    const response = NextResponse.json({
      success: true,
      message: 'Password changed successfully',
    })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    return handleRouteError(error)
  }
}
