import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getIssueById, updateIssue, deleteIssue } from '@/lib/api/issues'
import { db } from '@/lib/db'
import { requireTeamMember, handleRouteError, HttpError } from '@/lib/authz'

const updateIssueSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  workflowStateId: z.string().optional(),
  priority: z.string().optional(),
  estimate: z.number().nullable().optional(),
  labelIds: z.array(z.string()).optional(),
  completedAt: z.union([z.string(), z.date()]).nullable().optional(),
  assigneeId: z.string().nullable().optional(),
}).strict()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; issueId: string }> }
) {
  try {
    const { teamId, issueId } = await params
    await requireTeamMember(teamId)

    const issue = await getIssueById(teamId, issueId)
    if (!issue) {
      throw new HttpError(404, 'Issue not found')
    }

    return NextResponse.json(issue)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; issueId: string }> }
) {
  try {
    const { teamId, issueId } = await params
    const { user, userId } = await requireTeamMember(teamId, 'developer')

    // Verify issue belongs to this team
    const existing = await getIssueById(teamId, issueId)
    if (!existing) {
      throw new HttpError(404, 'Issue not found')
    }

    const rawBody = await request.json()
    const body = updateIssueSchema.parse(rawBody)

    // Look up assignee name from TeamMember if assigneeId is being updated
    let assigneeName: string | null = null
    if (body.assigneeId && body.assigneeId !== 'unassigned') {
      const teamMember = await db.teamMember.findFirst({
        where: {
          teamId,
          userId: body.assigneeId,
        },
      })

      if (teamMember) {
        assigneeName = teamMember.userName
      } else if (body.assigneeId === userId) {
        assigneeName = user.name || user.email || 'Unknown'
      }
    }

    const updateData: any = {}
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.projectId !== undefined) updateData.projectId = body.projectId
    if (body.workflowStateId !== undefined) updateData.workflowStateId = body.workflowStateId
    if (body.priority !== undefined) updateData.priority = body.priority
    if (body.estimate !== undefined) updateData.estimate = body.estimate
    if (body.labelIds !== undefined) updateData.labelIds = body.labelIds
    if (body.completedAt !== undefined) {
      updateData.completedAt = body.completedAt ? new Date(body.completedAt) : null
    }

    if (body.assigneeId !== undefined) {
      updateData.assigneeId = body.assigneeId === 'unassigned' ? null : body.assigneeId
      updateData.assignee = body.assigneeId === 'unassigned' ? null : assigneeName
    }

    const issue = await updateIssue(teamId, issueId, updateData)
    return NextResponse.json(issue)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; issueId: string }> }
) {
  try {
    const { teamId, issueId } = await params
    await requireTeamMember(teamId, 'developer')

    const existing = await getIssueById(teamId, issueId)
    if (!existing) {
      throw new HttpError(404, 'Issue not found')
    }

    await deleteIssue(teamId, issueId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
