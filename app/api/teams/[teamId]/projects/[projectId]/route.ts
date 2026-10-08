import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getProjectById, updateProject, deleteProject } from '@/lib/api/projects'
import { UpdateProjectData } from '@/lib/types'
import { db } from '@/lib/db'
import { requireTeamMember, requireTeamAdmin, handleRouteError, HttpError } from '@/lib/authz'

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).nullable().optional(),
  key: z.string().min(2).max(10).optional(),
  color: z.string().optional(),
  icon: z.string().nullable().optional(),
  leadId: z.string().nullable().optional(),
  status: z.enum(['active', 'completed', 'canceled']).optional(),
}).strict()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; projectId: string }> }
) {
  try {
    const { teamId, projectId } = await params
    await requireTeamMember(teamId)

    const project = await getProjectById(teamId, projectId)

    if (!project) {
      throw new HttpError(404, 'Project not found')
    }

    return NextResponse.json(project)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; projectId: string }> }
) {
  try {
    const { teamId, projectId } = await params
    await requireTeamMember(teamId, 'developer')

    // Verify project belongs to teamId
    const existing = await getProjectById(teamId, projectId)
    if (!existing) {
      throw new HttpError(404, 'Project not found')
    }

    const rawBody = await request.json()
    const validatedBody = updateProjectSchema.parse(rawBody)

    // Look up lead name from TeamMember if leadId is being updated
    let leadName: string | undefined = undefined
    if (validatedBody.leadId) {
      const teamMember = await db.teamMember.findFirst({
        where: {
          teamId,
          userId: validatedBody.leadId,
        },
      })

      if (teamMember) {
        leadName = teamMember.userName
      }
    }

    const updateData: UpdateProjectData = {
      name: validatedBody.name,
      description: validatedBody.description ?? undefined,
      key: validatedBody.key,
      color: validatedBody.color,
      icon: validatedBody.icon ?? undefined,
      leadId: validatedBody.leadId ?? undefined,
      lead: validatedBody.leadId ? leadName : undefined,
      status: validatedBody.status,
    }

    const project = await updateProject(teamId, projectId, updateData)
    return NextResponse.json(project)
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
    await requireTeamAdmin(teamId)

    const existing = await getProjectById(teamId, projectId)
    if (!existing) {
      throw new HttpError(404, 'Project not found')
    }

    await deleteProject(teamId, projectId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
