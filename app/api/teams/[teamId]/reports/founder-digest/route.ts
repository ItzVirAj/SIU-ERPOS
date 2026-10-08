import { NextRequest, NextResponse } from "next/server"
import { requireTeamMember, handleRouteError } from "@/lib/authz"
import { db } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamMember(teamId)

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    const [
      leadsThisWeek,
      leadsPriorWeek,
      issuesCompletedThisWeek,
      issuesCompletedPriorWeek,
      allActiveLeads,
      allActiveIssues,
      projects,
      companySetting,
    ] = await Promise.all([
      db.lead.findMany({
        where: { teamId, isWon: true, updatedAt: { gte: sevenDaysAgo } },
      }),
      db.lead.findMany({
        where: {
          teamId,
          isWon: true,
          updatedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
        },
      }),
      db.issue.findMany({
        where: {
          teamId,
          completedAt: { gte: sevenDaysAgo },
        },
      }),
      db.issue.findMany({
        where: {
          teamId,
          completedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
        },
      }),
      db.lead.findMany({
        where: { teamId, isWon: false, isLost: false },
        orderBy: { estimatedValue: "desc" },
        take: 5,
      }),
      db.issue.findMany({
        where: { teamId, completedAt: null },
        include: { project: { select: { name: true } } },
      }),
      db.project.findMany({
        where: { teamId },
        include: { _count: { select: { issues: true } } },
      }),
      db.companySetting.findUnique({
        where: { teamId },
        select: { currency: true, companyName: true },
      }),
    ])

    const currency = companySetting?.currency || "INR"

    // Revenue calculations
    const revenueThisWeek = leadsThisWeek.reduce((sum, l) => sum + (l.estimatedValue || 0), 0)
    const revenuePriorWeek = leadsPriorWeek.reduce((sum, l) => sum + (l.estimatedValue || 0), 0)
    const revenueDelta =
      revenuePriorWeek > 0
        ? Math.round(((revenueThisWeek - revenuePriorWeek) / revenuePriorWeek) * 100)
        : revenueThisWeek > 0
        ? 100
        : 0

    // Velocity calculations
    const velocityThisWeek = issuesCompletedThisWeek.length
    const velocityPriorWeek = issuesCompletedPriorWeek.length
    const velocityDelta =
      velocityPriorWeek > 0
        ? Math.round(((velocityThisWeek - velocityPriorWeek) / velocityPriorWeek) * 100)
        : velocityThisWeek > 0
        ? 100
        : 0

    // Risks / Alerts
    const alerts: Array<{ type: "warning" | "danger" | "info"; title: string; detail: string }> = []

    const unassignedTasks = allActiveIssues.filter((i) => !i.assigneeId)
    if (unassignedTasks.length > 0) {
      alerts.push({
        type: "warning",
        title: `${unassignedTasks.length} Unassigned Sprint Items`,
        detail: "Active tasks in backlog with no owner allocated.",
      })
    }

    const urgentTasks = allActiveIssues.filter((i) => i.priority === "urgent")
    if (urgentTasks.length > 0) {
      alerts.push({
        type: "danger",
        title: `${urgentTasks.length} Urgent Priority Blockers`,
        detail: "Critical items requiring immediate engineering focus.",
      })
    }

    if (allActiveLeads.length === 0) {
      alerts.push({
        type: "info",
        title: "Sales Pipeline Needs Inflow",
        detail: "No active pipeline deals found. Consider initiating outreach campaigns.",
      })
    }

    return NextResponse.json({
      founderDigest: {
        companyName: companySetting?.companyName || "Workspace",
        generatedAt: now.toISOString(),
        currency,
        scorecard: {
          revenueThisWeek,
          revenueDelta,
          dealsWonThisWeek: leadsThisWeek.length,
          velocityThisWeek,
          velocityDelta,
          activeProjectsCount: projects.length,
          totalBacklogCount: allActiveIssues.length,
        },
        highValueOpportunities: allActiveLeads.map((l) => ({
          id: l.id,
          title: l.title,
          company: l.companyName,
          value: l.estimatedValue || 0,
          temperature: l.temperature,
        })),
        alerts,
      },
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
