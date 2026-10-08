import { NextRequest, NextResponse } from 'next/server'
import { requireTeamAdmin, handleRouteError, HttpError } from "@/lib/authz"
import { db } from '@/lib/db'
import { sendInvitationEmail } from '@/lib/email'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; invitationId: string }> }
) {
  try {
    const { teamId, invitationId } = await params
    const { user } = await requireTeamAdmin(teamId)

    const invitation = await db.invitation.findFirst({
      where: {
        id: invitationId,
        teamId,
      },
    })

    if (!invitation) {
      throw new HttpError(404, 'Invitation not found')
    }

    const newExpiresAt = new Date()
    newExpiresAt.setDate(newExpiresAt.getDate() + 7)

    const updatedInvitation = await db.invitation.update({
      where: { id: invitationId },
      data: {
        expiresAt: newExpiresAt,
        status: 'pending',
      },
    })

    const team = await db.team.findUnique({
      where: { id: teamId },
    })

    const inviterName = user.name || user.email || 'Someone'
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || 'http://localhost:3000'
    const inviteUrl = `${baseUrl}/invite/${invitation.id}`

    if (process.env.RESEND_API_KEY) {
      try {
        await sendInvitationEmail({
          email: invitation.email,
          teamName: team?.name || 'the team',
          inviterName,
          role: invitation.role,
          inviteUrl,
        })
      } catch (emailError) {
        console.error('Error resending invitation email:', emailError)
      }
    }

    return NextResponse.json(updatedInvitation)
  } catch (error) {
    return handleRouteError(error)
  }
}
