import { NextRequest, NextResponse } from "next/server"
import { requireTeamAccess } from "@/lib/route-guards"
import { handleRouteError } from "@/lib/authz"
import { AppModule, AccessLevel } from "@/lib/prisma-client"
import { db } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamAccess(teamId, {
      module: AppModule.WORK,
      level: AccessLevel.VIEW,
    })

    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get("startDate")
    const endDateParam = searchParams.get("endDate")

    const now = new Date()
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    const startDate = startDateParam ? new Date(startDateParam) : defaultStart
    const endDate = endDateParam ? new Date(endDateParam) : defaultEnd

    const [entries, issuesWithEstimates, allocations] = await Promise.all([
      db.timeEntry.findMany({
        where: {
          teamId,
          date: { gte: startDate, lte: endDate },
        },
        include: {
          project: { select: { id: true, name: true, key: true, color: true } },
          user: { select: { id: true, name: true, email: true } },
          issue: { select: { id: true, title: true, number: true, estimate: true } },
        },
      }),
      db.issue.findMany({
        where: {
          teamId,
          estimate: { not: null, gt: 0 },
        },
        include: {
          project: { select: { id: true, name: true, key: true } },
          timeEntries: { select: { hours: true } },
        },
        take: 30,
        orderBy: { updatedAt: "desc" },
      }),
      db.resourceAllocation.findMany({
        where: { teamId, isContractor: true },
        include: {
          user: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
        },
      }),
    ])

    let totalHours = 0
    let billableHours = 0
    let nonBillableHours = 0

    const categoryMap: Record<string, number> = {}
    const projectHoursMap: Record<string, { name: string; key: string; color: string; hours: number; billableHours: number }> = {}
    const memberHoursMap: Record<string, { name: string; hours: number; billableHours: number }> = {}

    entries.forEach((e) => {
      totalHours += e.hours
      if (e.isBillable) {
        billableHours += e.hours
      } else {
        nonBillableHours += e.hours
      }

      categoryMap[e.category] = (categoryMap[e.category] || 0) + e.hours

      if (e.project) {
        if (!projectHoursMap[e.project.id]) {
          projectHoursMap[e.project.id] = {
            name: e.project.name,
            key: e.project.key,
            color: e.project.color,
            hours: 0,
            billableHours: 0,
          }
        }
        projectHoursMap[e.project.id].hours += e.hours
        if (e.isBillable) projectHoursMap[e.project.id].billableHours += e.hours
      }

      if (e.user) {
        if (!memberHoursMap[e.user.id]) {
          memberHoursMap[e.user.id] = {
            name: e.user.name,
            hours: 0,
            billableHours: 0,
          }
        }
        memberHoursMap[e.user.id].hours += e.hours
        if (e.isBillable) memberHoursMap[e.user.id].billableHours += e.hours
      }
    })

    const utilizationRate = totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0

    // Estimate accuracy computation (TIME-06)
    const estimateAccuracyList = issuesWithEstimates.map((issue) => {
      const estimatedHours = issue.estimate || 0
      const actualHours = issue.timeEntries.reduce((sum, te) => sum + te.hours, 0)
      const varianceHours = actualHours - estimatedHours
      const accuracyPercent =
        estimatedHours > 0 && actualHours > 0
          ? Math.round((1 - Math.min(Math.abs(varianceHours) / estimatedHours, 1)) * 100)
          : null

      return {
        issueId: issue.id,
        issueNumber: issue.number,
        title: issue.title,
        projectName: issue.project?.name || "General",
        estimatedHours,
        actualHours: Number(actualHours.toFixed(1)),
        varianceHours: Number(varianceHours.toFixed(1)),
        accuracyPercent,
      }
    })

    // Contractor summary (TIME-07)
    let contractorTotalCost = 0
    const contractorSummary = allocations.map((alloc) => {
      const cost = (alloc.contractorRate || 0) * alloc.allocatedHours
      contractorTotalCost += cost
      return {
        userName: alloc.user?.name || "Contractor",
        projectName: alloc.project?.name || "General",
        allocatedHours: alloc.allocatedHours,
        contractorRate: alloc.contractorRate || 0,
        totalCost: cost,
      }
    })

    return NextResponse.json({
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      summary: {
        totalHours: Number(totalHours.toFixed(1)),
        billableHours: Number(billableHours.toFixed(1)),
        nonBillableHours: Number(nonBillableHours.toFixed(1)),
        utilizationRate,
        entriesCount: entries.length,
        contractorTotalCost,
      },
      categoryBreakdown: Object.entries(categoryMap).map(([category, hours]) => ({
        category,
        hours: Number(hours.toFixed(1)),
        percentage: totalHours > 0 ? Math.round((hours / totalHours) * 100) : 0,
      })),
      projectBreakdown: Object.values(projectHoursMap),
      memberLeaderboard: Object.values(memberHoursMap).sort((a, b) => b.hours - a.hours),
      estimateAccuracyList,
      contractorSummary,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
