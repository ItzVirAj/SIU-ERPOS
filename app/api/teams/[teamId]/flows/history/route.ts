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
    await requireTeamAccess(teamId, { module: AppModule.AUTOMATIONS, level: AccessLevel.VIEW })

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
    return handleRouteError(error)
  }
}
