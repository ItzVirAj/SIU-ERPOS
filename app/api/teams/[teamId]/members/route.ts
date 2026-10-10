import { NextRequest, NextResponse } from 'next/server'
import { requireTeamAccess } from '@/lib/route-guards'
import { AppModule, AccessLevel } from '@/lib/prisma-client'
import { handleRouteError, HttpError } from '@/lib/authz'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamAccess(teamId, { module: AppModule.WORK, level: AccessLevel.VIEW })

    // Fetch active/suspended employees for the team directory (basic fields only)
    const employees = await db.employee.findMany({
      where: {
        teamId,
        status: { not: 'TERMINATED' },
      },
      select: {
        id: true,
        userId: true,
        fullName: true,
        email: true,
        department: true,
        position: true,
        status: true,
        role: {
          select: {
            key: true,
            name: true,
            legacyTeamRole: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Return only basic directory fields: fullName, email, role key and name, department, position, status
    // (no phone, personal email, employee code, session or suspension metadata)
    const formattedMembers = employees.map((emp) => ({
      id: emp.id,
      userId: emp.userId,
      fullName: emp.fullName,
      userName: emp.fullName,
      displayName: emp.fullName,
      email: emp.email,
      userEmail: emp.email,
      department: emp.department,
      position: emp.position,
      status: emp.status,
      role: emp.role.legacyTeamRole,
      roleKey: emp.role.key,
      roleName: emp.role.name,
    }))

    return NextResponse.json(formattedMembers)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PATCH() {
  return handleRouteError(
    new HttpError(
      410,
      'Direct member role modification is disabled. Employee roles must be updated in Access Management.'
    )
  )
}

export async function DELETE() {
  return handleRouteError(
    new HttpError(
      410,
      'Direct member removal is disabled. Employee offboarding must be executed in Access Management.'
    )
  )
}
