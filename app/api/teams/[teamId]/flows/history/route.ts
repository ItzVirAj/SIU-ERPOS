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

    const logs = await db.automationLog.findMany({
      where: {
        rule: { teamId },
      },
      include: {
        rule: { select: { id: true, name: true, triggerType: true, actionType: true } },
      },
      orderBy: { executedAt: "desc" },
      take: 50,
    })

    const parsedLogs = logs.map((l) => {
      let parsedDetails: any = null
      try {
        parsedDetails = l.details ? JSON.parse(l.details) : null
      } catch {
        parsedDetails = { raw: l.details }
      }

      return {
        id: l.id,
        ruleId: l.ruleId,
        ruleName: l.rule?.name || "Automation Rule",
        triggerType: l.rule?.triggerType || "custom",
        actionType: l.rule?.actionType || "custom",
        status: l.status,
        executedAt: l.executedAt,
        details: parsedDetails,
      }
    })

    return NextResponse.json({ history: parsedLogs })
  } catch (error) {
    console.error("Error fetching flow history:", error)
    return NextResponse.json({ error: "Failed to fetch flow history" }, { status: 500 })
  }
}
