import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/auth-server-helpers"
import { db } from "@/lib/db"
import { executeCrossModuleFlow } from "@/lib/automations/dispatcher"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; flowId: string }> }
) {
  try {
    const { teamId, flowId } = await params
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

    const rule = await db.automationRule.findFirst({
      where: { id: flowId, teamId },
    })

    if (!rule) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 })
    }

    // Execute real cross-module side-effects in Neon PostgreSQL
    const result = await executeCrossModuleFlow({
      teamId,
      triggerType: rule.triggerType as any,
      actorName: membership.userName || "Operator",
    })

    return NextResponse.json({
      success: result.success,
      flowId: rule.id,
      flowName: rule.name,
      result,
    })
  } catch (error: any) {
    console.error("Error executing flow:", error)
    return NextResponse.json({ error: error?.message || "Flow execution failed" }, { status: 500 })
  }
}
