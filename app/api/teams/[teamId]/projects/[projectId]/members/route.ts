import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getProjectById } from '@/lib/api/projects'
import { requireTeamMember, handleRouteError, HttpError } from '@/lib/authz'

const addMemberSchema = z.object({
  userId: z.string().min(1),
}).strict()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; projectId: string }> }
) {
  try {
    const { teamId, projectId } = await params
    await requireTeamMember(teamId)

    // Verify project exists and belongs to team
    const project = await getProjectById(teamId, projectId)
    if (!project) {
      throw new HttpError(404, 'Project not found')
    }

    // Fetch project members from database
    const projectMembers = await db.projectMember.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    })

    const formattedMembers = projectMembers.map((member) => ({
      id: member.id,
      userId: member.userId,
      userName: member.userName,
      userEmail: member.userEmail,
      displayName: member.userName,
      email: member.userEmail,
      profileImageUrl: undefined,
    }))

    return NextResponse.json(formattedMembers)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; projectId: string }> }
) {
  try {
    const { teamId, projectId } = await params
    await requireTeamMember(teamId, 'developer')

    // Verify project exists and belongs to team
    const project = await getProjectById(teamId, projectId)
    if (!project) {
      throw new HttpError(404, 'Project not found')
    }

    const rawBody = await request.json()
    const { userId: memberUserId } = addMemberSchema.parse(rawBody)

    // Verify the user being added is a member of this team
    const teamMember = await db.teamMember.findFirst({
      where: {
        teamId,
        userId: memberUserId,
      },
    })

    if (!teamMember) {
      throw new HttpError(400, 'User must be a team member first')
    }

    // Check if member already exists in project
    const existingMember = await db.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: memberUserId,
        },
      },
    })

    if (existingMember) {
      throw new HttpError(400, 'Member already added to project')
    }

    // Add member to project
    const projectMember = await db.projectMember.create({
      data: {
        projectId,
        userId: teamMember.userId,
        userEmail: teamMember.userEmail,
        userName: teamMember.userName,
      },
    })

    const formattedMember = {
      id: projectMember.id,
      userId: projectMember.userId,
      userName: projectMember.userName,
      userEmail: projectMember.userEmail,
      displayName: projectMember.userName,
      email: projectMember.userEmail,
      profileImageUrl: undefined,
    }

    return NextResponse.json(formattedMember, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; projectId: string }> }
) {
  try {
    const { teamId, projectId } = await params
    await requireTeamMember(teamId, 'developer')

    // Verify project exists and belongs to team
    const project = await getProjectById(teamId, projectId)
    if (!project) {
      throw new HttpError(404, 'Project not found')
    }

    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      throw new HttpError(400, 'Member ID is required')
    }

    const memberToRemove = await db.projectMember.findFirst({
      where: {
        id: memberId,
        projectId,
      },
    })

    if (!memberToRemove) {
      throw new HttpError(404, 'Project member not found')
    }

    await db.projectMember.delete({
      where: { id: memberId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
