import { NextRequest, NextResponse } from 'next/server'
import { requireTeamAdmin, handleRouteError, HttpError } from '@/lib/authz'
import { db } from '@/lib/db'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; invitationId: string }> }
) {
  try {
    const { teamId, invitationId } = await params
    await requireTeamAdmin(teamId)

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
