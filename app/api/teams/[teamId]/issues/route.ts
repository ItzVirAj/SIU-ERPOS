import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getIssues, createIssue, getIssueStats } from '@/lib/api/issues'
import { CreateIssueData } from '@/lib/types'
import { db } from '@/lib/db'
import { handleRouteError } from "@/lib/authz";

const createIssueSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  workflowStateId: z.string().min(1),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).optional(),
  estimate: z.number().nullable().optional(),
  labelIds: z.array(z.string()).optional(),
  assigneeId: z.string().nullable().optional(),
}).strict()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamAccess(teamId, { module: AppModule.WORK, level: AccessLevel.VIEW })
    const { searchParams } = new URL(request.url)

    if (searchParams.get('stats') === 'true') {
      const stats = await getIssueStats(teamId)
      return NextResponse.json(stats)
    }

    const filters = {
      status: searchParams.getAll('status'),
      assignee: searchParams.getAll('assignee'),
      project: searchParams.getAll('project'),
      label: searchParams.getAll('label'),
      priority: searchParams.getAll('priority'),
      search: searchParams.get('search') || undefined,
    }

    const sortField = searchParams.get('sortField') || 'createdAt'
    const sortDirection = (searchParams.get('sortDirection') || 'desc') as 'asc' | 'desc'
    const sort = { field: sortField as any, direction: sortDirection }

    const issues = await getIssues(teamId, filters, sort)
    return NextResponse.json(issues)
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
    const { user, userId } = await requireTeamAccess(teamId, { module: AppModule.WORK, level: AccessLevel.WRITE })

    const rawBody = await request.json()
    const body = createIssueSchema.parse(rawBody)

    const creatorName = user.name || user.email || 'Unknown'

    let assigneeName: string | undefined = undefined
    if (body.assigneeId && body.assigneeId !== 'unassigned') {
      if (body.assigneeId === userId) {
        assigneeName = creatorName
      } else {
        const teamMember = await db.teamMember.findFirst({
          where: {
            teamId,
            userId: body.assigneeId,
          },
          select: { userName: true },
        })
        assigneeName = teamMember?.userName
      }
    }

    const issueData: CreateIssueData = {
      title: body.title,
      description: body.description ?? undefined,
      projectId: body.projectId && body.projectId.trim() !== '' ? body.projectId : undefined,
      workflowStateId: body.workflowStateId,
      assigneeId: body.assigneeId === 'unassigned' ? undefined : (body.assigneeId ?? undefined),
      assignee: assigneeName,
      priority: body.priority || 'none',
      estimate: body.estimate ?? undefined,
      labelIds: body.labelIds,
    }

    const issue = await createIssue(
      teamId,
      issueData,
      userId,
      creatorName
    )
    return NextResponse.json(issue, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
