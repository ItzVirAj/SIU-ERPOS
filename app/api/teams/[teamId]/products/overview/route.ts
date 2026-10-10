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
    await requireTeamAccess(teamId, { module: AppModule.PRODUCTS, level: AccessLevel.VIEW })

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

    const totalHoursSaved = components.reduce(
      (sum, c) => sum + (c.hoursSavedEstimate || 0) * (c.timesReused || 1),
      0
    )

    const activePilots = pilotCustomers.filter(
      (pc) => pc.stage === "PILOT_ACTIVE" || pc.stage === "ONBOARDING"
    ).length

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
    return handleRouteError(error)
  }
}
