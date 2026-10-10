import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { handleRouteError } from "@/lib/authz";
import { db } from "@/lib/db"

const createSubscriptionSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().default("DEVELOPER_TOOLS"),
  cost: z.number().positive(),
  currency: z.string().default("INR"),
  billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
  renewalDate: z.union([z.string(), z.date()]).optional(),
  ownerName: z.string().nullable().optional(),
}).strict()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamAccess(teamId, { module: AppModule.FINANCE, level: AccessLevel.VIEW })

    const subscriptions = await db.toolSubscription.findMany({
      where: { teamId },
      orderBy: { renewalDate: "asc" },
    })

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
    return handleRouteError(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const { member } = await requireTeamAccess(teamId, { module: AppModule.FINANCE, level: AccessLevel.WRITE })

    const rawBody = await request.json()
    const {
      name,
      category,
      cost,
      currency,
      billingCycle,
      renewalDate,
      ownerName,
    } = createSubscriptionSchema.parse(rawBody)

    const subscription = await db.toolSubscription.create({
      data: {
        teamId,
        name: name.trim(),
        category,
        cost,
        currency,
        billingCycle,
        renewalDate: renewalDate ? new Date(renewalDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ownerName: ownerName?.trim() || member.userName || "Admin",
        status: "active",
      },
    })

    return NextResponse.json({ subscription }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
