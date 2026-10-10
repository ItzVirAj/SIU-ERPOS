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
