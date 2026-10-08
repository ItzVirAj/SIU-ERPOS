import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { z } from 'zod'
import { requireTeamAdmin, handleRouteError } from '@/lib/authz'
import { db } from '@/lib/db'
import { sendInvitationEmail } from '@/lib/email'

const createInvitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'developer', 'viewer']).default('developer'),
}).strict()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamAdmin(teamId)

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const { user, userId } = await requireTeamAdmin(teamId)

    const rawBody = await request.json()
    const { email: rawEmail, role } = createInvitationSchema.parse(rawBody)
    const email = rawEmail.toLowerCase().trim()

    // Check if user is already a member (case-insensitive)
    const existingMember = await db.teamMember.findFirst({
      where: {
        teamId,
        userEmail: {
          equals: email,
          mode: 'insensitive',
        },
      },
    })

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a team member' },
        { status: 400 }
      )
    }

    // Check if pending invitation exists
    const existingInvitation = await db.invitation.findUnique({
      where: {
        teamId_email: {
          teamId,
          email,
        },
      },
    })

    if (existingInvitation && existingInvitation.status === 'pending' && existingInvitation.expiresAt > new Date()) {
      return NextResponse.json(
        { error: 'An active invitation is already pending for this email' },
        { status: 400 }
      )
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const secureId = crypto.randomUUID()

    const invitation = await db.invitation.upsert({
      where: {
        teamId_email: {
          teamId,
          email,
        },
      },
      update: {
        role,
        invitedBy: userId,
        status: 'pending',
        expiresAt,
      },
      create: {
        id: secureId,
        teamId,
        email,
        role,
        invitedBy: userId,
        status: 'pending',
        expiresAt,
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
          email,
          teamName: team?.name || 'the team',
          inviterName,
          role,
          inviteUrl,
        })
      } catch (emailError) {
        console.error('Error sending invitation email:', emailError)
      }
    }

    return NextResponse.json(invitation, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
