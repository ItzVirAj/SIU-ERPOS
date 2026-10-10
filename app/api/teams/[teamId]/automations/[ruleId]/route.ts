import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError, HttpError } from "@/lib/authz";
import { db } from "@/lib/db";

const patchRuleSchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
}).strict()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; ruleId: string }> }
) {
  try {
    const { teamId, ruleId } = await params;
    await requireTeamAccess(teamId, { module: AppModule.AUTOMATIONS, level: AccessLevel.WRITE });

    const existing = await db.automationRule.findFirst({
      where: { id: ruleId, teamId },
    });

    if (!existing) {
      throw new HttpError(404, "Automation rule not found");
    }

    const rawBody = await request.json();
    const body = patchRuleSchema.parse(rawBody);

    const rule = await db.automationRule.update({
      where: { id: ruleId },
      data: {
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.name && { name: body.name.trim() }),
        ...(body.description !== undefined && {
          description: body.description?.trim() || null,
        }),
      },
    });

    return NextResponse.json(rule);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; ruleId: string }> }
) {
  try {
    const { teamId, ruleId } = await params;
    await requireTeamAccess(teamId, { module: AppModule.AUTOMATIONS, level: AccessLevel.MANAGE });

    const existing = await db.automationRule.findFirst({
      where: { id: ruleId, teamId },
    });

    if (!existing) {
      throw new HttpError(404, "Automation rule not found");
    }

    await db.automationRule.delete({
      where: { id: ruleId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; ruleId: string }> }
) {
  try {
    const { teamId, ruleId } = await params;
    const { user } = await requireTeamAccess(teamId, { module: AppModule.AUTOMATIONS, level: AccessLevel.WRITE });

    const existing = await db.automationRule.findFirst({
      where: { id: ruleId, teamId },
    });

    if (!existing) {
      throw new HttpError(404, "Automation rule not found");
    }

    const rule = await db.automationRule.update({
      where: { id: ruleId },
      data: {
        executionCount: { increment: 1 },
        lastTriggeredAt: new Date(),
      },
    });

    const log = await db.automationLog.create({
      data: {
        ruleId,
        status: "success",
        details: `Simulated trigger event executed by ${user.name || "Admin"}. Action payload dispatched.`,
      },
    });

    return NextResponse.json({ success: true, rule, log });
  } catch (error) {
    return handleRouteError(error);
  }
}
