import { NextRequest, NextResponse } from "next/server";
import { getSessionOrNull, isTeamMember } from "@/lib/auth-server-helpers";
import { db } from "@/lib/db";

const DEFAULT_AUTOMATIONS = [
  {
    name: "Lead-to-Project Auto-Provisioner",
    description: "When a CRM Lead is marked as Won, automatically create a new Project, team channel, and notify the PM.",
    triggerType: "lead_won",
    actionType: "create_project",
    triggerConfig: { stage: "Won" },
    actionConfig: { autoProvisionChannel: true, defaultStatus: "active" },
    isActive: true,
    executionCount: 3,
  },
  {
    name: "SLA Overdue Task Escalator",
    description: "When a task passes its deadline without completion, bump priority to Urgent and post a blocker in #general.",
    triggerType: "task_overdue",
    actionType: "escalate_task",
    triggerConfig: { thresholdHours: 24 },
    actionConfig: { newPriority: "urgent", notifyChannel: "general" },
    isActive: true,
    executionCount: 7,
  },
  {
    name: "Meeting Intelligence Auto-Dispatcher",
    description: "When a Google Meet call finishes, automatically trigger Groq AI action item extraction and follow-up drafts.",
    triggerType: "meeting_completed",
    actionType: "send_notification",
    triggerConfig: { withTranscript: true },
    actionConfig: { extractActions: true, notifyAttendees: true },
    isActive: true,
    executionCount: 5,
  },
  {
    name: "Client Portal Onboarding Sync",
    description: "When a new Client account is approved, auto-provision client deliverables folder and billing series.",
    triggerType: "client_created",
    actionType: "create_channel",
    triggerConfig: { status: "active" },
    actionConfig: { folderTemplate: "standard_enterprise" },
    isActive: false,
    executionCount: 1,
  },
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getSessionOrNull();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;
    const isMember = await isTeamMember(teamId, session.user.id);
    if (!isMember) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const existingCount = await db.automationRule.count({ where: { teamId } });
    if (existingCount === 0) {
      for (const auto of DEFAULT_AUTOMATIONS) {
        const rule = await db.automationRule.create({
          data: {
            teamId,
            name: auto.name,
            description: auto.description,
            triggerType: auto.triggerType,
            actionType: auto.actionType,
            triggerConfig: auto.triggerConfig,
            actionConfig: auto.actionConfig,
            isActive: auto.isActive,
            executionCount: auto.executionCount,
            lastTriggeredAt: new Date(Date.now() - Math.floor(Math.random() * 86400000)),
          },
        });

        // Add a sample log entry for the rule
        await db.automationLog.create({
          data: {
            ruleId: rule.id,
            status: "success",
            details: `Successfully triggered on sample event and executed ${auto.actionType}.`,
            executedAt: new Date(),
          },
        });
      }
    }

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
    console.error("Error fetching automations:", error);
    return NextResponse.json(
      { error: "Failed to fetch automations" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getSessionOrNull();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;
    const userId = session.user.id;
    const isMember = await isTeamMember(teamId, userId);
    if (!isMember) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, triggerType, actionType, triggerConfig, actionConfig } = body;

    if (!name || !triggerType || !actionType) {
      return NextResponse.json(
        { error: "Name, trigger type, and action type are required" },
        { status: 400 }
      );
    }

    const rule = await db.automationRule.create({
      data: {
        teamId,
        name,
        description,
        triggerType,
        actionType,
        triggerConfig,
        actionConfig,
        isActive: true,
      },
    });

    await db.auditLog.create({
      data: {
        teamId,
        userId,
        userName: session.user.name || "Administrator",
        userEmail: session.user.email || "",
        action: "CREATE",
        entityType: "automation",
        entityTitle: `Automation rule created: "${name}"`,
        details: { triggerType, actionType },
        ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error("Error creating automation rule:", error);
    return NextResponse.json(
      { error: "Failed to create automation rule" },
      { status: 500 }
    );
  }
}
