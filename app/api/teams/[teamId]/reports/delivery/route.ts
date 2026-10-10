import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from "next/server"
import { handleRouteError } from "@/lib/authz";
import { db } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamAccess(teamId, [{ module: AppModule.WORK, level: AccessLevel.VIEW }, { module: AppModule.REPORTS, level: AccessLevel.VIEW }])

    const [issues, projects, workflowStates] = await Promise.all([
      db.issue.findMany({
        where: { teamId },
        include: {
          workflowState: { select: { id: true, name: true, type: true } },
          project: { select: { id: true, name: true, key: true, color: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.project.findMany({
        where: { teamId },
        include: {
          _count: { select: { issues: true } },
        },
      }),
      db.workflowState.findMany({
        where: { teamId },
        orderBy: { position: "asc" },
      }),
    ])

    const now = new Date()
    let completedCount = 0
    let totalEstimateCompleted = 0
    let totalCycleHours = 0
    let closedCountForCycle = 0
    let bugCount = 0
    let featureCount = 0

    // Velocity breakdown over last 8 weeks
    const weeklyVelocity: Record<string, { week: string; count: number; points: number }> = {}
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000)
      const label = `W-${d.getDate()} ${d.toLocaleString("default", { month: "short" })}`
      weeklyVelocity[label] = { week: label, count: 0, points: 0 }
    }
    const weekKeys = Object.keys(weeklyVelocity)

    // Project Health Map
    const projectHealthMap: Record<
      string,
      {
        id: string
        name: string
        key: string
        color: string
        totalIssues: number
        completedIssues: number
        inProgressIssues: number
        completionRate: number
        status: "ON_TRACK" | "AT_RISK" | "DELAYED"
      }
    > = {}

    projects.forEach((p) => {
      projectHealthMap[p.id] = {
        id: p.id,
        name: p.name,
        key: p.key,
        color: p.color || "#6366f1",
        totalIssues: 0,
        completedIssues: 0,
        inProgressIssues: 0,
        completionRate: 0,
        status: "ON_TRACK",
      }
    })

    issues.forEach((issue) => {
      const isCompleted =
        issue.workflowState?.type === "completed" ||
        issue.workflowState?.name?.toLowerCase().includes("done") ||
        issue.workflowState?.name?.toLowerCase().includes("complete") ||
        !!issue.completedAt

      const isBug =
        issue.title.toLowerCase().includes("bug") ||
        issue.title.toLowerCase().includes("fix") ||
        issue.title.toLowerCase().includes("issue") ||
        issue.title.toLowerCase().includes("defect")

      if (isBug) {
        bugCount += 1
      } else {
        featureCount += 1
      }

      // Project allocation
      if (issue.projectId && projectHealthMap[issue.projectId]) {
        projectHealthMap[issue.projectId].totalIssues += 1
        if (isCompleted) {
          projectHealthMap[issue.projectId].completedIssues += 1
        } else if (
          issue.workflowState?.type === "started" ||
          issue.workflowState?.name?.toLowerCase().includes("progress")
        ) {
          projectHealthMap[issue.projectId].inProgressIssues += 1
        }
      }

      if (isCompleted) {
        completedCount += 1
        const est = issue.estimate || 1
        totalEstimateCompleted += est

        // Cycle time
        const completedDate = issue.completedAt || issue.updatedAt
        const cycleHours = (new Date(completedDate).getTime() - new Date(issue.createdAt).getTime()) / (1000 * 60 * 60)
        totalCycleHours += Math.max(1, cycleHours)
        closedCountForCycle += 1

        // Assign to weekly velocity bucket
        const diffDays = Math.floor((now.getTime() - new Date(completedDate).getTime()) / (1000 * 60 * 60 * 24))
        const weekIndex = 7 - Math.floor(diffDays / 7)
        if (weekIndex >= 0 && weekIndex < weekKeys.length) {
          const key = weekKeys[weekIndex]
          weeklyVelocity[key].count += 1
          weeklyVelocity[key].points += est
        }
      }
    })

    // Compute Project completion rates & statuses
    const projectHealth = Object.values(projectHealthMap).map((p) => {
      const rate = p.totalIssues > 0 ? Math.round((p.completedIssues / p.totalIssues) * 100) : 0
      let status: "ON_TRACK" | "AT_RISK" | "DELAYED" = "ON_TRACK"
      if (rate < 30 && p.totalIssues > 5) status = "AT_RISK"
      if (rate < 15 && p.totalIssues > 8) status = "DELAYED"

      return {
        ...p,
        completionRate: rate,
        status,
      }
    })

    const avgCycleDays = closedCountForCycle > 0 ? (totalCycleHours / closedCountForCycle / 24).toFixed(1) : "0"
    const totalIssues = issues.length
    const overallCompletionRate = totalIssues > 0 ? Math.round((completedCount / totalIssues) * 100) : 0

    return NextResponse.json({
      summary: {
        totalIssues,
        completedCount,
        inProgressCount: totalIssues - completedCount,
        overallCompletionRate,
        totalEstimateCompleted,
        avgCycleDays: Number(avgCycleDays),
        bugCount,
        featureCount,
        bugRate: totalIssues > 0 ? Math.round((bugCount / totalIssues) * 100) : 0,
      },
      velocity: Object.values(weeklyVelocity),
      projectHealth,
      typeDistribution: [
        { name: "Features & Tasks", count: featureCount, color: "#3b82f6" },
        { name: "Bugs & Defects", count: bugCount, color: "#ef4444" },
      ],
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
