import { NextResponse } from 'next/server'
import { requireEmployee, handleRouteError } from '@/lib/authz'

export async function GET() {
  try {
    const { employee, role, access } = await requireEmployee({
      allowPasswordChangePending: true,
    })

    const response = NextResponse.json({
      employee: {
        id: employee.id,
        fullName: employee.fullName,
        email: employee.email,
        status: employee.status,
        mustChangePassword: employee.mustChangePassword,
      },
      role: {
        key: role.key,
        name: role.name,
        level: role.level,
      },
      access,
    })

    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    return handleRouteError(error)
  }
}
