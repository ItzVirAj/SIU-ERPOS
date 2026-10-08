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

    const [leads, projects, clients, companySetting] = await Promise.all([
      db.lead.findMany({
        where: { teamId },
        include: {
          stage: { select: { name: true, position: true } },
        },
      }),
      db.project.findMany({
        where: { teamId },
        include: {
          _count: { select: { issues: true } },
        },
      }),
      db.client.findMany({
        where: { teamId },
        include: {
          leads: { select: { estimatedValue: true, isWon: true } },
          projects: { select: { id: true, name: true } },
        },
      }),
      db.companySetting.findUnique({
        where: { teamId },
        select: { currency: true },
      }),
    ])

    const currency = companySetting?.currency || "INR"

    let realizedRevenue = 0
    let pipelineGross = 0
    let weightedPipeline = 0

    leads.forEach((l) => {
      const val = l.estimatedValue || 0
      if (l.isWon) {
        realizedRevenue += val
      } else if (!l.isLost) {
        pipelineGross += val
        // Weight based on position if available or default 40%
        const stageOrder = l.stage?.position ?? 1
        const weight = Math.min(0.9, Math.max(0.2, stageOrder * 0.2))
        weightedPipeline += Math.round(val * weight)
      }
    })

    // Top client accounts
    const clientEconomics = clients.map((c) => {
      const wonValue = c.leads
        .filter((l) => l.isWon)
        .reduce((sum, l) => sum + (l.estimatedValue || 0), 0)
      const pipelineValue = c.leads
        .filter((l) => !l.isWon)
        .reduce((sum, l) => sum + (l.estimatedValue || 0), 0)

      return {
        id: c.id,
        name: c.name,
        company: c.company || c.name,
        wonValue,
        pipelineValue,
        activeProjects: c.projects.length,
      }
    })

    clientEconomics.sort((a, b) => b.wonValue - a.wonValue)

    // Forecast months
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    const currentMonthIndex = new Date().getMonth()
    const monthlyForecast = []

    for (let i = 0; i < 6; i++) {
      const mIdx = (currentMonthIndex + i) % 12
      const mName = months[mIdx]
      // Project revenue simulation based on active pipeline distribution
      const projected = Math.round(realizedRevenue / 6 + (weightedPipeline / 6) * (1 + i * 0.15))
      monthlyForecast.push({
        month: mName,
        realized: i === 0 ? Math.round(realizedRevenue / 3) : 0,
        projected,
      })
    }

    return NextResponse.json({
      summary: {
        currency,
        realizedRevenue,
        pipelineGross,
        weightedPipeline,
        totalProjectedRunway: realizedRevenue + weightedPipeline,
        totalClients: clients.length,
        avgDealSize: leads.filter((l) => l.isWon).length > 0
          ? Math.round(realizedRevenue / leads.filter((l) => l.isWon).length)
          : 0,
      },
      clientEconomics: clientEconomics.slice(0, 6),
      monthlyForecast,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
