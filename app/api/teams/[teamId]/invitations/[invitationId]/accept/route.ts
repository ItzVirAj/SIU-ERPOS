import { NextRequest, NextResponse } from 'next/server'
import { requireSession, handleRouteError, HttpError } from "@/lib/authz"
import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; invitationId: string }> }
) {
  try {
    const { teamId, invitationId } = await params
    const session = await requireSession()
    const user = session.user
    const userId = user.id

    const invitation = await db.invitation.findFirst({
      where: {
        id: invitationId,
        teamId,
      },
    })

    if (!invitation) {
      throw new HttpError(404, 'Invitation not found')
    }

    if (invitation.status !== 'pending') {
      throw new HttpError(400, `Invitation is no longer valid (status: ${invitation.status})`)
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      throw new HttpError(400, 'Invitation has expired')
    }

    // Compare emails case-insensitively
    const userEmail = (user.email || '').toLowerCase().trim()
    const inviteEmail = invitation.email.toLowerCase().trim()

    if (inviteEmail !== userEmail) {
      throw new HttpError(
        400,
        'Invitation email does not match the authenticated account'
      )
    }

    // Atomic transaction for acceptance and member creation
    await db.$transaction(async (tx) => {
      const existingMember = await tx.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId,
            userId,
          },
        },
      })

      if (!existingMember) {
        await tx.teamMember.create({
          data: {
            teamId,
            userId,
            userName: user.name || user.email || 'Team Member',
            userEmail: invitation.email,
            role: invitation.role,
          },
        })
      }

      await tx.invitation.update({
        where: { id: invitationId },
        data: { status: 'accepted' },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
