import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  requireAccess,
  handleRouteError,
  HttpError,
  assertOrigin,
} from '@/lib/authz'
import { AppModule, AccessLevel } from '@/lib/prisma-client'
import { resetEmployeePassword } from '@/lib/employee-service'
import { getClientIp } from '@/lib/audit'

const resetPasswordSchema = z
  .object({
    actorPassword: z.string().min(1, 'Current re-auth password is required'),
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
    const input = resetPasswordSchema.parse(rawBody)

    const ip = getClientIp(request)
    const result = await resetEmployeePassword(actor, id, input, { ip })

    const response = NextResponse.json(result)
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    return handleRouteError(error)
  }
}
