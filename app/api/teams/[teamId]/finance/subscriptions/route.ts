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

    let subscriptions = await db.toolSubscription.findMany({
      where: { teamId },
      orderBy: { renewalDate: "asc" },
    })

    // Auto-seed starter agency SaaS subscriptions if empty
    if (subscriptions.length === 0) {
      const now = new Date()
      await db.toolSubscription.createMany({
        data: [
          {
            teamId,
            name: "GitHub Team Plan",
            category: "DEVELOPER_TOOLS",
            cost: 3500,
            currency: "INR",
            billingCycle: "monthly",
            renewalDate: new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000),
            ownerName: "Tech Lead",
            status: "active",
          },
          {
            teamId,
            name: "Neon PostgreSQL Serverless",
            category: "INFRASTRUCTURE",
            cost: 5800,
            currency: "INR",
            billingCycle: "monthly",
            renewalDate: new Date(now.getTime() + 18 * 24 * 60 * 60 * 1000),
            ownerName: "DevOps",
            status: "active",
          },
          {
            teamId,
            name: "Vercel Pro Team",
            category: "INFRASTRUCTURE",
            cost: 1700,
            currency: "INR",
            billingCycle: "monthly",
            renewalDate: new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000),
            ownerName: "Frontend Lead",
            status: "active",
          },
          {
            teamId,
            name: "Google Workspace Enterprise",
            category: "PRODUCTIVITY",
            cost: 6200,
            currency: "INR",
            billingCycle: "monthly",
            renewalDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
            ownerName: "Founder",
            status: "active",
          },
        ],
      })

      subscriptions = await db.toolSubscription.findMany({
        where: { teamId },
        orderBy: { renewalDate: "asc" },
      })
    }

    const now = new Date()
    let totalMonthlyBurn = 0

    const listWithRenewals = subscriptions.map((sub) => {
      const monthlyCost = sub.billingCycle === "monthly" ? sub.cost : Math.round(sub.cost / 12)
      totalMonthlyBurn += monthlyCost

      const diffTime = new Date(sub.renewalDate).getTime() - now.getTime()
      const daysUntilRenewal = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      return {
        ...sub,
        monthlyCost,
        daysUntilRenewal,
        isUrgentRenewal: daysUntilRenewal <= 7,
      }
    })

    return NextResponse.json({
      subscriptions: listWithRenewals,
      summary: {
        totalMonthlyBurn,
        activeSubscriptionsCount: subscriptions.length,
      },
    })
  } catch (error) {
    console.error("Error fetching tool subscriptions:", error)
    return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 })
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
    const {
      name,
      category = "DEVELOPER_TOOLS",
      cost,
      currency = "INR",
      billingCycle = "monthly",
      renewalDate,
      ownerName,
    } = body

    if (!name || !cost || Number(cost) <= 0) {
      return NextResponse.json({ error: "Tool name and valid cost are required" }, { status: 400 })
    }

    const subscription = await db.toolSubscription.create({
      data: {
        teamId,
        name: name.trim(),
        category,
        cost: Number(cost),
        currency,
        billingCycle,
        renewalDate: renewalDate ? new Date(renewalDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ownerName: ownerName?.trim() || membership.userName || "Admin",
        status: "active",
      },
    })

    return NextResponse.json({ subscription })
  } catch (error) {
    console.error("Error creating subscription:", error)
    return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 })
  }
}
