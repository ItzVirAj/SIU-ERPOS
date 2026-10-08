import { NextRequest, NextResponse } from "next/server"
import { requireTeamAdmin, handleRouteError, HttpError } from "@/lib/authz"
import { db } from "@/lib/db"
import { executeCrossModuleFlow } from "@/lib/automations/dispatcher"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; flowId: string }> }
) {
  try {
    const { teamId, flowId } = await params
    const { member } = await requireTeamAdmin(teamId)

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
