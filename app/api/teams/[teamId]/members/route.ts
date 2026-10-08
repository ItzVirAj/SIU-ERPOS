import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireTeamMember, requireTeamAdmin, handleRouteError, HttpError } from '@/lib/authz'
import { db } from '@/lib/db'

const updateMemberSchema = z.object({
  memberId: z.string().min(1),
  role: z.enum(['admin', 'developer', 'viewer']),
}).strict()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamMember(teamId)

    // Fetch team members from database (no auto-creation of admin!)
    const teamMembers = await db.teamMember.findMany({
      where: { teamId },
      orderBy: { createdAt: 'asc' },
    })

    // Format members for the frontend
    const formattedMembers = teamMembers.map((member) => ({
      id: member.id,
      userId: member.userId,
      userName: member.userName,
      userEmail: member.userEmail,
      displayName: member.userName,
      email: member.userEmail,
      role: member.role,
      profileImageUrl: undefined,
    }))

    return NextResponse.json(formattedMembers)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamAdmin(teamId)

    const rawBody = await request.json()
    const { memberId, role } = updateMemberSchema.parse(rawBody)

    const existingMember = await db.teamMember.findFirst({
      where: {
        id: memberId,
        teamId,
      },
    })

    if (!existingMember) {
      throw new HttpError(404, 'Team member not found')
    }

    const updated = await db.teamMember.update({
      where: { id: memberId },
      data: { role },
    })

    return NextResponse.json(updated)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const { userId } = await requireTeamAdmin(teamId)

    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      throw new HttpError(400, 'Member ID is required')
    }

    const memberToRemove = await db.teamMember.findFirst({
      where: {
        id: memberId,
        teamId,
      },
    })

    if (!memberToRemove) {
      throw new HttpError(404, 'Team member not found')
    }

    // Don't allow removing yourself
    if (memberToRemove.userId === userId) {
      throw new HttpError(400, 'Cannot remove yourself from the team')
    }

    await db.teamMember.delete({
      where: { id: memberId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
