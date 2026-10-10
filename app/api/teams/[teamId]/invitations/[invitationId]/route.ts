import { NextRequest, NextResponse } from 'next/server'
import { requireTeamAccess } from '@/lib/route-guards'
import { AppModule, AccessLevel } from '@/lib/prisma-client'
import { handleRouteError, HttpError } from '@/lib/authz'
import { db } from '@/lib/db'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; invitationId: string }> }
) {
  try {
    const { teamId, invitationId } = await params
    await requireTeamAccess(teamId, {
      module: AppModule.EMPLOYEES,
      level: AccessLevel.WRITE,
    })

    const invitation = await db.invitation.findFirst({
      where: {
        id: invitationId,
        teamId,
      },
    })

    if (!invitation) {
      throw new HttpError(404, 'Invitation not found')
    }

    await db.invitation.delete({
      where: { id: invitationId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
