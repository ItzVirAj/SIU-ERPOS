import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from "next/server"
import { handleRouteError, HttpError } from "@/lib/authz";
import { db } from "@/lib/db"
import { executeCrossModuleFlow } from "@/lib/automations/dispatcher"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; flowId: string }> }
) {
  try {
    const { teamId, flowId } = await params
    const { member } = await requireTeamAccess(teamId, { module: AppModule.AUTOMATIONS, level: AccessLevel.WRITE })

    const rule = await db.automationRule.findFirst({
      where: { id: flowId, teamId },
    })

    if (!rule) {
      throw new HttpError(404, "Flow not found")
    }

    // Execute real cross-module side-effects in Neon PostgreSQL
    const result = await executeCrossModuleFlow({
      teamId,
      triggerType: rule.triggerType as any,
      actorName: member.userName || "Operator",
    })

    return NextResponse.json({
      success: result.success,
      flowId: rule.id,
      flowName: rule.name,
      result,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
