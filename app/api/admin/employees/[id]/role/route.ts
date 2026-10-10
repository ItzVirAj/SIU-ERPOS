import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  requireAccess,
  handleRouteError,
  HttpError,
} from '@/lib/authz'
import { AppModule, AccessLevel } from '@/lib/prisma-client'
import { changeRole } from '@/lib/employee-service'
import { canProvision } from '@/lib/employee-policy'
import { getClientIp } from '@/lib/audit'

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

const roleSchema = z
  .object({
    roleKey: z.string().min(1),
    confirmSecondOwner: z.boolean().optional(),
  })
  .strict()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertOrigin(request)
    const actor = await requireAccess(AppModule.EMPLOYEES, AccessLevel.MANAGE)
    if (!canProvision(actor.role.key)) {
      throw new HttpError(403, 'Forbidden: Only Owner, HR, or CTO can change employee roles')
    }
    const { id } = await params
    if (!id || typeof id !== 'string') throw new HttpError(400, 'Invalid employee id')

    const rawBody = await request.json()
    const input = roleSchema.parse(rawBody)

    const ip = getClientIp(request)
    const updated = await changeRole(actor, id, input, { ip })

    const response = NextResponse.json(updated)
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    return handleRouteError(error)
  }
}
