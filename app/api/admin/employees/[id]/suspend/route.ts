import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  requireAccess,
  handleRouteError,
  HttpError,
  assertOrigin,
} from '@/lib/authz'
import { AppModule, AccessLevel } from '@/lib/prisma-client'
import { suspendEmployee } from '@/lib/employee-service'
import { getClientIp } from '@/lib/audit'

const suspendSchema = z
  .object({
    reason: z.string().min(5).max(300),
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

    const rawBody = await request.json()
    const input = suspendSchema.parse(rawBody)

    const ip = getClientIp(request)
    const suspended = await suspendEmployee(actor, id, input, { ip })

    const response = NextResponse.json(suspended)
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    return handleRouteError(error)
  }
}
