import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTeamMember, requireTeamAdmin, handleRouteError } from "@/lib/authz";
import { db } from "@/lib/db";

const createAutomationSchema = z.object({
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
    const { teamId } = await params;
    await requireTeamMember(teamId);

    const rules = await db.automationRule.findMany({
      where: { teamId },
      include: {
        logs: {
          orderBy: { executedAt: "desc" },
          take: 3,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(rules);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const { user, userId } = await requireTeamAdmin(teamId);

    const rawBody = await request.json();
    const { name, description, triggerType, actionType, triggerConfig, actionConfig } =
      createAutomationSchema.parse(rawBody);

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
    });

    await db.auditLog.create({
      data: {
        teamId,
        userId,
        userName: user.name || "Administrator",
        userEmail: user.email || "",
        action: "CREATE",
        entityType: "AUTOMATION",
        entityTitle: `Automation rule created: "${name}"`,
        details: { triggerType, actionType },
        ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
