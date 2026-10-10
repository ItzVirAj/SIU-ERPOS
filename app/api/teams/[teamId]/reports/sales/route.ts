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
    await requireTeamAccess(teamId, [{ module: AppModule.CRM, level: AccessLevel.VIEW }, { module: AppModule.REPORTS, level: AccessLevel.VIEW }])

    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get("timeframe") || "all" // "7d", "30d", "90d", "all"

    let dateFilter: Date | undefined
    const now = new Date()
    if (timeframe === "7d") {
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    } else if (timeframe === "30d") {
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    } else if (timeframe === "90d") {
      dateFilter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    }

    const leadsWhere: any = { teamId }
    if (dateFilter) {
      leadsWhere.createdAt = { gte: dateFilter }
    }

    // Query leads with pipeline and stage
    const [leads, pipelines, companySetting] = await Promise.all([
      db.lead.findMany({
        where: leadsWhere,
        include: {
          stage: { select: { id: true, name: true, position: true } },
          pipeline: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.leadPipeline.findMany({
        where: { teamId },
        include: {
          stages: { orderBy: { position: "asc" } },
        },
      }),
      db.companySetting.findUnique({
        where: { teamId },
        select: { currency: true },
      }),
    ])

    const currency = companySetting?.currency || "INR"

    // 1. Pipeline Gross & Weighted Values
    let totalPipelineValue = 0
    let totalWonValue = 0
    let totalLostValue = 0
    let activeDealsCount = 0
    let wonDealsCount = 0
    let lostDealsCount = 0
    let totalCycleDays = 0
    let closedCount = 0

    const sourceBreakdown: Record<string, { count: number; value: number }> = {}
    const lostReasons: Record<string, number> = {}
    const stageCounts: Record<string, { name: string; count: number; value: number }> = {}

    leads.forEach((l) => {
      const val = l.estimatedValue || 0
      const src = l.source || "other"

      // Source tally
      if (!sourceBreakdown[src]) {
        sourceBreakdown[src] = { count: 0, value: 0 }
      }
      sourceBreakdown[src].count += 1
      sourceBreakdown[src].value += val

      // Stage tally
      const stageName = l.stage?.name || "Discovery"
      if (!stageCounts[stageName]) {
        stageCounts[stageName] = { name: stageName, count: 0, value: 0 }
      }
      stageCounts[stageName].count += 1
      stageCounts[stageName].value += val

      if (l.isWon) {
        wonDealsCount += 1
        totalWonValue += val
        const cycle = (new Date(l.updatedAt).getTime() - new Date(l.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        totalCycleDays += Math.max(1, Math.round(cycle))
        closedCount += 1
      } else if (l.isLost) {
        lostDealsCount += 1
        totalLostValue += val
        const reason = l.lostReason || "Other / Unspecified"
        lostReasons[reason] = (lostReasons[reason] || 0) + 1
        closedCount += 1
      } else {
        activeDealsCount += 1
        totalPipelineValue += val
      }
    })

    const winRate = closedCount > 0 ? Math.round((wonDealsCount / closedCount) * 100) : 0
    const avgCycleDays = wonDealsCount > 0 ? Math.round(totalCycleDays / wonDealsCount) : 0
    const avgDealSize = wonDealsCount > 0 ? Math.round(totalWonValue / wonDealsCount) : 0

    // Format Sources for Recharts
    const sourceData = Object.entries(sourceBreakdown).map(([name, data]) => ({
      source: name.charAt(0).toUpperCase() + name.slice(1).replace("_", " "),
      leads: data.count,
      revenue: data.value,
    }))

    // Format Funnel for Recharts
    const funnelData = Object.values(stageCounts)

    // Format Lost Reasons for Recharts
    const lostReasonsData = Object.entries(lostReasons).map(([name, count]) => ({
      reason: name.charAt(0).toUpperCase() + name.slice(1).replace("_", " "),
      count,
    }))

    return NextResponse.json({
      summary: {
        totalLeads: leads.length,
        activeDealsCount,
        wonDealsCount,
        lostDealsCount,
        totalPipelineValue,
        totalWonValue,
        totalLostValue,
        winRate,
        avgCycleDays,
        avgDealSize,
        currency,
      },
      funnel: funnelData,
      sources: sourceData,
      lostReasons: lostReasonsData,
      recentLeads: leads.slice(0, 8).map((l) => ({
        id: l.id,
        title: l.title,
        company: l.companyName,
        value: l.estimatedValue || 0,
        stage: l.stage?.name || "Discovery",
        temperature: l.temperature,
        isWon: l.isWon,
        isLost: l.isLost,
        createdAt: l.createdAt,
      })),
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
