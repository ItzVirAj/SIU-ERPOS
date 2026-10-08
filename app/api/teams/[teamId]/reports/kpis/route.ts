import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/auth-server-helpers"
import { db } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const userId = await getUserId()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const membership = await db.teamMember.findFirst({
      where: { teamId, userId },
    })

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let kpis = await db.companyKpi.findMany({
      where: { teamId },
      orderBy: { createdAt: "asc" },
    })

    // Auto-seed starter KPIs if none exist
    if (kpis.length === 0) {
      await db.companyKpi.createMany({
        data: [
          {
            teamId,
            category: "financial",
            name: "Monthly Revenue Run Rate",
            metricKey: "revenue",
            targetValue: 1000000,
            currentValue: 650000,
            unit: "INR",
            period: "monthly",
          },
          {
            teamId,
            category: "sales",
            name: "Deal Win Rate",
            metricKey: "win_rate",
            targetValue: 45,
            currentValue: 38,
            unit: "%",
            period: "monthly",
          },
          {
            teamId,
            category: "delivery",
            name: "Sprint Delivery Velocity",
            metricKey: "sprint_velocity",
            targetValue: 40,
            currentValue: 32,
            unit: "pts",
            period: "weekly",
          },
          {
            teamId,
            category: "sales",
            name: "Active Retained Clients",
            metricKey: "active_clients",
            targetValue: 10,
            currentValue: 6,
            unit: "count",
            period: "quarterly",
          },
        ],
      })

      kpis = await db.companyKpi.findMany({
        where: { teamId },
        orderBy: { createdAt: "asc" },
      })
    }

    return NextResponse.json({ kpis })
  } catch (error) {
    console.error("Error fetching company KPIs:", error)
    return NextResponse.json({ error: "Failed to fetch KPIs" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const userId = await getUserId()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const membership = await db.teamMember.findFirst({
      where: {
        teamId,
        userId,
        role: { in: ["admin", "developer"] },
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const body = await request.json()
    const { name, category = "sales", metricKey, targetValue, currentValue = 0, unit = "count", period = "monthly" } = body

    if (!name || targetValue === undefined) {
      return NextResponse.json({ error: "Name and target value are required" }, { status: 400 })
    }

    const created = await db.companyKpi.create({
      data: {
        teamId,
        name: name.trim(),
        category,
        metricKey: metricKey || "custom_metric",
        targetValue: Number(targetValue),
        currentValue: Number(currentValue),
        unit,
        period,
      },
    })

    return NextResponse.json({ kpi: created })
  } catch (error) {
    console.error("Error creating company KPI:", error)
    return NextResponse.json({ error: "Failed to create KPI" }, { status: 500 })
  }
}
