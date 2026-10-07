import { NextRequest, NextResponse } from 'next/server'
import { getProjectById, updateProject, deleteProject } from '@/lib/api/projects'
import { UpdateProjectData } from '@/lib/types'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; projectId: string }> }
) {
  try {
    const { teamId, projectId } = await params
    const project = await getProjectById(teamId, projectId)

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(project)
  } catch (error) {
    console.error('Error fetching project:', error)
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; projectId: string }> }
) {
  try {
    const { teamId, projectId } = await params
    const body = await request.json()

    // Look up lead name from TeamMember if leadId is being updated
    let leadName: string | undefined = undefined
    if (body.leadId) {
      const teamMember = await db.teamMember.findFirst({
        where: {
          teamId,
          userId: body.leadId
        }
      })
      
      if (teamMember) {
        leadName = teamMember.userName
      }
    }

    const updateData: UpdateProjectData = {
      name: body.name,
      description: body.description,
      key: body.key,
      color: body.color,
      icon: body.icon,
      leadId: body.leadId,
      lead: body.leadId ? leadName : undefined,
      status: body.status,
    }

    const project = await updateProject(teamId, projectId, updateData)
    return NextResponse.json(project)
  } catch (error) {
    console.error('Error updating project:', error)
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; projectId: string }> }
) {
  try {
    const { teamId, projectId } = await params
    await deleteProject(teamId, projectId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting project:', error)
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    )
  }
}
