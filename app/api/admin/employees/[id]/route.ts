import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  requireAccess,
  handleRouteError,
  HttpError,
  assertOrigin,
} from '@/lib/authz'
import { AppModule, AccessLevel } from '@/lib/prisma-client'
import {
  getEmployee,
  updateEmployee,
  deleteEmployee,
} from '@/lib/employee-service'
import { getClientIp } from '@/lib/audit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAccess(AppModule.EMPLOYEES, AccessLevel.VIEW)
    const { id } = await params
    if (!id || typeof id !== 'string') throw new HttpError(400, 'Invalid employee id')

    const employee = await getEmployee(actor, id)

    const response = NextResponse.json(employee)
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    return handleRouteError(error)
  }
}

const updateEmployeeSchema = z
  .object({
    fullName: z.string().min(2).max(100).optional(),
    personalEmail: z.string().email().nullable().optional(),
    position: z.string().max(100).nullable().optional(),
    department: z.string().max(100).nullable().optional(),
    phone: z.string().max(50).nullable().optional(),
    joiningDate: z.string().nullable().optional(),
    email: z.string().email().optional(),
  })
  .strict()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertOrigin(request)
    const actor = await requireAccess(AppModule.EMPLOYEES, AccessLevel.WRITE)
    const { id } = await params
    if (!id || typeof id !== 'string') throw new HttpError(400, 'Invalid employee id')

    const rawBody = await request.json()
    const input = updateEmployeeSchema.parse(rawBody)

    const ip = getClientIp(request)
    const updated = await updateEmployee(actor, id, input, { ip })

    const response = NextResponse.json(updated)
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    return handleRouteError(error)
  }
}

const deleteQuerySchema = z
  .object({
    hard: z.enum(['true', '1']).optional(),
    confirmEmail: z.string().optional(),
  })
  .strict()

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertOrigin(request)
    const actor = await requireAccess(AppModule.EMPLOYEES, AccessLevel.MANAGE)
    const { id } = await params
    if (!id || typeof id !== 'string') throw new HttpError(400, 'Invalid employee id')

    const url = new URL(request.url)
    const rawQuery = Object.fromEntries(url.searchParams.entries())
    const query = deleteQuerySchema.parse(rawQuery)

    const ip = getClientIp(request)
    const result = await deleteEmployee(
      actor,
      id,
      {
        hard: query.hard === 'true' || query.hard === '1',
        confirmEmail: query.confirmEmail,
      },
      { ip }
    )

    const response = NextResponse.json(result)
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    return handleRouteError(error)
  }
}
