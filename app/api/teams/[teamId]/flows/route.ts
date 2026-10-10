import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { handleRouteError } from "@/lib/authz";
import { db } from "@/lib/db"

const createFlowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  triggerType: z.string().min(1),
  actionType: z.string().min(1),
  triggerConfig: z.any().optional(),
  actionConfig: z.any().optional(),
}).strict()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamAccess(teamId, { module: AppModule.AUTOMATIONS, level: AccessLevel.VIEW })

    const rules = await db.automationRule.findMany({
      where: { teamId },
      include: {
        logs: {
          take: 3,
          orderBy: { executedAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ flows: rules })
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
    const { user, userId, member } = await requireTeamAccess(teamId, { module: AppModule.AUTOMATIONS, level: AccessLevel.WRITE })

    const rawBody = await request.json()
    const { name, description, triggerType, actionType, triggerConfig, actionConfig } =
      createFlowSchema.parse(rawBody)

    const rule = await db.automationRule.create({
      data: {
        teamId,
        name: name.trim(),
        description: description?.trim() || null,
        triggerType,
        actionType,
        triggerConfig: triggerConfig || null,
        actionConfig: actionConfig || null,
        isActive: true,
      },
    })

    await db.auditLog.create({
      data: {
        teamId,
        userId,
        userName: member.userName || user.name || "Admin",
        userEmail: member.userEmail || user.email || "admin@sketchitup.internal",
        action: "CREATE",
        entityType: "AUTOMATION",
        entityId: rule.id,
        entityTitle: rule.name,
        details: { triggerType, actionType },
      },
    })

    return NextResponse.json({ flow: rule }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
