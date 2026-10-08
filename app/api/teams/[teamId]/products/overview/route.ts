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

    const [products, roadmapItems, featureRequests, pilotCustomers, components] = await Promise.all([
      db.domainProduct.findMany({ where: { teamId } }),
      db.productRoadmapItem.findMany({ where: { teamId } }),
      db.productFeatureRequest.findMany({ where: { teamId } }),
      db.productPilotCustomer.findMany({ where: { teamId } }),
      db.reusableComponent.findMany({ where: { teamId } }),
    ])

    let totalMrr = 0
    let totalActiveUsers = 0
    let activeProductsCount = 0

    products.forEach((p) => {
      totalMrr += p.mrr
      totalActiveUsers += p.activeUsers
      if (p.status !== "SUNSET") {
        activeProductsCount++
      }
    })

    const totalHoursSaved = components.reduce((sum, c) => sum + (c.hoursSavedEstimate || 0) * (c.timesReused || 1), 0)

    const activePilots = pilotCustomers.filter((pc) => pc.stage === "PILOT_ACTIVE" || pc.stage === "ONBOARDING").length

    return NextResponse.json({
      summary: {
        totalProducts: products.length,
        activeProductsCount,
        totalMrr,
        totalActiveUsers,
        roadmapItemsCount: roadmapItems.length,
        inDevelopmentCount: roadmapItems.filter((r) => r.stage === "IN_DEV").length,
        featureRequestsCount: featureRequests.length,
        activePilotsCount: activePilots,
        reusableComponentsCount: components.length,
        totalHoursSaved,
      },
    })
  } catch (error) {
    console.error("Error fetching products overview:", error)
    return NextResponse.json({ error: "Failed to fetch products overview" }, { status: 500 })
  }
}
