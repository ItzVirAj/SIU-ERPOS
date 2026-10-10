import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from 'next/server'
import { handleRouteError } from "@/lib/authz";
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamAccess(teamId, { module: AppModule.WORK, level: AccessLevel.VIEW })

    // Get all issues with their workflow states to determine completion
    const allIssues = await db.issue.findMany({
      where: { teamId },
      include: {
        workflowState: true,
      },
    })

    // Get other data
    const [members, projects, labels, recentIssues] = await Promise.all([
      db.teamMember.count({
        where: { teamId },
      }),
      db.project.count({
        where: {
          teamId,
          status: 'active',
        },
      }),
      db.label.count({
        where: { teamId },
      }),
      db.issue.findMany({
        where: {
          teamId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          createdAt: true,
        },
      }),
    ])

    const issues = allIssues.length
    const completedIssues = allIssues.filter(
      (issue) => issue.workflowState.type === 'completed'
    ).length

    const completionRate =
      issues > 0 ? Math.round((completedIssues / issues) * 100) : 0

    const issuesByPriority = allIssues.reduce((acc, issue) => {
      acc[issue.priority] = (acc[issue.priority] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const statusCounts = allIssues.reduce((acc, issue) => {
      const status = issue.workflowState.name
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      stats: {
        members,
        projects,
        totalIssues: issues,
        completedIssues,
        completionRate,
        labels,
      },
      priorityBreakdown: Object.entries(issuesByPriority).map(
        ([priority, count]) => ({
          priority,
          count: count as number,
        })
      ),
      statusBreakdown: Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
      })),
      recentIssues,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
