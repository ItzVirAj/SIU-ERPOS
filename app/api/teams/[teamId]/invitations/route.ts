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
    await requireTeamAccess(teamId, {
      module: AppModule.EMPLOYEES,
      level: AccessLevel.VIEW,
    })

    const invitations = await db.invitation.findMany({
      where: {
        teamId,
        status: 'pending',
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(invitations)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST() {
  return handleRouteError(
    new HttpError(
      410,
      'Email invitations are disabled. New employees must be provisioned directly via Access Management.'
    )
  )
}
