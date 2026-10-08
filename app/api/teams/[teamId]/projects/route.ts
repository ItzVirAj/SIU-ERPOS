import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getProjects, createProject, getProjectStats } from '@/lib/api/projects'
import { CreateProjectData } from '@/lib/types'
import { requireTeamMember, handleRouteError } from '@/lib/authz'
import { db } from '@/lib/db'

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).nullable().optional(),
  key: z.string().min(2).max(10),
  color: z.string().optional(),
  icon: z.string().nullable().optional(),
  leadId: z.string().nullable().optional(),
  status: z.enum(['active', 'completed', 'canceled']).optional(),
}).strict()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamMember(teamId)
    const { searchParams } = new URL(request.url)

    if (searchParams.get('stats') === 'true') {
      const stats = await getProjectStats(teamId)
      return NextResponse.json(stats)
    }

    const projects = await getProjects(teamId)
    return NextResponse.json(projects)
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
    const { user, userId } = await requireTeamMember(teamId, 'developer')

    const rawBody = await request.json()
    const validatedBody = createProjectSchema.parse(rawBody)

    const userName = user.name || user.email || 'Unknown'
    const actualLeadId = validatedBody.leadId || userId
    let leadName: string | undefined = userName

    if (actualLeadId) {
      const teamMember = await db.teamMember.findFirst({
        where: {
          teamId,
          userId: actualLeadId,
        },
      })

      if (teamMember) {
        leadName = teamMember.userName
      } else if (actualLeadId === userId) {
        leadName = userName
      }
    }

    const projectData: CreateProjectData = {
      name: validatedBody.name,
      description: validatedBody.description ?? undefined,
      key: validatedBody.key,
      color: validatedBody.color || '#6366f1',
      icon: validatedBody.icon ?? undefined,
      leadId: actualLeadId,
      lead: leadName,
      status: validatedBody.status || 'active',
    }

    const project = await createProject(teamId, projectData)
    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
