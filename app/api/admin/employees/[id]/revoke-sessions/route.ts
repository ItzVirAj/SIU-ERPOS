import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  requireAccess,
  handleRouteError,
  HttpError,
  assertOrigin,
} from '@/lib/authz'
import { AppModule, AccessLevel } from '@/lib/prisma-client'
import { revokeEmployeeSessions } from '@/lib/employee-service'
import { getClientIp } from '@/lib/audit'

const revokeSchema = z
  .object({
    sessionId: z.string().optional(),
  })
  .strict()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertOrigin(request)
    const actor = await requireAccess(AppModule.EMPLOYEES, AccessLevel.WRITE)
    const { id } = await params
    if (!id || typeof id !== 'string') throw new HttpError(400, 'Invalid employee id')

    let input: { sessionId?: string } = {}
    try {
      const rawBody = await request.json()
      if (rawBody && typeof rawBody === 'object') {
        input = revokeSchema.parse(rawBody)
      }
    } catch {
      // Empty body is valid: revokes all sessions
    }

    const ip = getClientIp(request)
    const result = await revokeEmployeeSessions(actor, id, input, { ip })

    const response = NextResponse.json(result)
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    return handleRouteError(error)
  }
}
