import { NextRequest, NextResponse } from 'next/server'
import {
  requireAccess,
  handleRouteError,
  HttpError,
  assertOrigin,
} from '@/lib/authz'
import { AppModule, AccessLevel } from '@/lib/prisma-client'
import { restoreEmployee } from '@/lib/employee-service'
import { getClientIp } from '@/lib/audit'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertOrigin(request)
    const actor = await requireAccess(AppModule.EMPLOYEES, AccessLevel.WRITE)
    const { id } = await params
    if (!id || typeof id !== 'string') throw new HttpError(400, 'Invalid employee id')

    const ip = getClientIp(request)
    const restored = await restoreEmployee(actor, id, { ip })

    const response = NextResponse.json(restored)
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    return handleRouteError(error)
  }
}
