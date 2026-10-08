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

    let rules = await db.automationRule.findMany({
      where: { teamId },
      include: {
        logs: {
          take: 3,
          orderBy: { executedAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    // Auto-seed Phase 1 Flagship Workflows if empty
    if (rules.length === 0) {
      await db.automationRule.createMany({
        data: [
          {
            teamId,
            name: "Lead-to-Cash Pipeline",
            description: "When a CRM Lead is won, automatically create client account, provision project, open #proj- channel, and seed kickoff task.",
            triggerType: "lead_won",
            actionType: "convert_lead_to_cash",
            isActive: true,
            executionCount: 0,
          },
          {
            teamId,
            name: "Meeting-to-Action Dispatcher",
            description: "When meeting concludes, automatically parse action items into sprint tasks on the project board with assignees.",
            triggerType: "meeting_completed",
            actionType: "create_tasks_from_action_items",
            isActive: true,
            executionCount: 0,
          },
          {
            teamId,
            name: "Task Overdue Watchdog & Escalator",
            description: "When sprint deadlines pass without completion, automatically escalate priority (medium ➔ urgent) and alert project lead.",
            triggerType: "task_overdue",
            actionType: "escalate_task_priority",
            isActive: true,
            executionCount: 0,
          },
          {
            teamId,
            name: "Lead Triage & Round-Robin Owner",
            description: "When a new lead arrives without an owner, automatically assign round-robin to active sales reps and set lead temperature.",
            triggerType: "lead_triage",
            actionType: "round_robin_assignment",
            isActive: true,
            executionCount: 0,
          },
        ],
      })

      rules = await db.automationRule.findMany({
        where: { teamId },
        include: {
          logs: {
            take: 3,
            orderBy: { executedAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    }

    return NextResponse.json({ flows: rules })
  } catch (error) {
    console.error("Error fetching flows:", error)
    return NextResponse.json({ error: "Failed to fetch flows" }, { status: 500 })
  }
}

export async function POST(
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
      where: {
        teamId,
        userId,
        role: { in: ["admin", "developer"] },
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, triggerType, actionType, triggerConfig, actionConfig } = body

    if (!name || !triggerType || !actionType) {
      return NextResponse.json({ error: "Name, triggerType, and actionType are required" }, { status: 400 })
    }

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
        userName: membership.userName || "Admin",
        userEmail: membership.userEmail || "admin@sketchitup.internal",
        action: "CREATE",
        entityType: "AUTOMATION",
        entityId: rule.id,
        entityTitle: rule.name,
        details: { triggerType, actionType },
      },
    })

    return NextResponse.json({ flow: rule })
  } catch (error) {
    console.error("Error creating flow:", error)
    return NextResponse.json({ error: "Failed to create flow" }, { status: 500 })
  }
}
