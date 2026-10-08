import { NextRequest, NextResponse } from "next/server";
import { getSessionOrNull, isTeamMember } from "@/lib/auth-server-helpers";
import { db } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; ruleId: string }> }
) {
  try {
    const session = await getSessionOrNull();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId, ruleId } = await params;
    const isMember = await isTeamMember(teamId, session.user.id);
    if (!isMember) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();
    const updateData: any = {};

    if (typeof body.isActive === "boolean") updateData.isActive = body.isActive;
    if (body.name) updateData.name = body.name;
    if (body.description) updateData.description = body.description;

    const rule = await db.automationRule.update({
      where: { id: ruleId },
      data: updateData,
    });

    return NextResponse.json(rule);
  } catch (error) {
    console.error("Error updating automation rule:", error);
    return NextResponse.json(
      { error: "Failed to update automation rule" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; ruleId: string }> }
) {
  try {
    const session = await getSessionOrNull();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId, ruleId } = await params;
    const isMember = await isTeamMember(teamId, session.user.id);
    if (!isMember) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await db.automationRule.delete({
      where: { id: ruleId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting automation rule:", error);
    return NextResponse.json(
      { error: "Failed to delete automation rule" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; ruleId: string }> }
) {
  // Test-fire the automation
  try {
    const session = await getSessionOrNull();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId, ruleId } = await params;
    const isMember = await isTeamMember(teamId, session.user.id);
    if (!isMember) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
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
        details: `Simulated trigger event executed by ${session.user.name || "Admin"}. Action payload dispatched.`,
      },
    });

    return NextResponse.json({ success: true, rule, log });
  } catch (error) {
    console.error("Error testing automation rule:", error);
    return NextResponse.json(
      { error: "Failed to test automation rule" },
      { status: 500 }
    );
  }
}
