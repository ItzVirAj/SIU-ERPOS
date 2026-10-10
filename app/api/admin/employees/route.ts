import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  requireAccess,
  handleRouteError,
  HttpError,
} from '@/lib/authz'
import { AppModule, AccessLevel, EmployeeStatus } from '@/lib/prisma-client'
import {
  listEmployees,
  createEmployee,
} from '@/lib/employee-service'
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

const listQuerySchema = z
  .object({
    search: z.string().optional(),
    roleKey: z.string().optional(),
    status: z.nativeEnum(EmployeeStatus).optional(),
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().max(50).optional(),
  })
  .strict()

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAccess(AppModule.EMPLOYEES, AccessLevel.VIEW)

    const url = new URL(request.url)
    const rawParams = Object.fromEntries(url.searchParams.entries())
    const params = listQuerySchema.parse(rawParams)

    const result = await listEmployees(actor, params)

    const response = NextResponse.json(result)
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    return handleRouteError(error)
  }
}

const createEmployeeSchema = z
  .object({
    fullName: z.string().min(2).max(100),
    email: z.string().email(),
    roleKey: z.string().min(1),
    position: z.string().max(100).optional(),
    department: z.string().max(100).optional(),
    phone: z.string().max(50).optional(),
    joiningDate: z.string().optional(),
    confirmSecondOwner: z.boolean().optional(),
  })
  .strict()

export async function POST(request: NextRequest) {
  try {
    assertOrigin(request)
    const actor = await requireAccess(AppModule.EMPLOYEES, AccessLevel.WRITE)

    const rawBody = await request.json()
    const input = createEmployeeSchema.parse(rawBody)

    const ip = getClientIp(request)
    const result = await createEmployee(actor, input, { ip })

    const response = NextResponse.json(result, { status: 201 })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    return handleRouteError(error)
  }
}
