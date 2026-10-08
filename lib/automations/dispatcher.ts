import { db } from "@/lib/db"

export interface AutomationEventPayload {
  teamId: string
  triggerType: "lead_won" | "meeting_completed" | "task_overdue" | "lead_triage" | "custom"
  entityId?: string
  actorName?: string
  data?: any
}

export interface FlowExecutionResult {
  success: boolean
  triggerType: string
  executedActions: string[]
  createdEntities: Record<string, any>
  durationMs: number
  error?: string
}

function generateProjectKey(title: string): string {
  const words = title.replace(/[^a-zA-Z0-9\s]/g, "").trim().split(/\s+/)
  if (words.length >= 3) {
    return (words[0][0] + words[1][0] + words[2][0]).toUpperCase()
  } else if (words[0]?.length >= 3) {
    return words[0].slice(0, 3).toUpperCase()
  }
  return `PRJ${Math.floor(100 + Math.random() * 900)}`
}

export async function executeCrossModuleFlow(payload: AutomationEventPayload): Promise<FlowExecutionResult> {
  const startTime = performance.now()
  const { teamId, triggerType, entityId, actorName = "Flow Engine", data = {} } = payload
  const executedActions: string[] = []
  const createdEntities: Record<string, any> = {}

  try {
    // -------------------------------------------------------------
    // FLOW 1: LEAD-TO-CASH ENGINE
    // -------------------------------------------------------------
    if (triggerType === "lead_won") {
      let lead = data.lead
      if (!lead && entityId) {
        lead = await db.lead.findUnique({ where: { id: entityId } })
      }
      if (!lead) {
        // Fallback: take most recent won lead or create sample context
        lead = await db.lead.findFirst({ where: { teamId }, orderBy: { createdAt: "desc" } })
      }

      const clientName = lead?.companyName || lead?.contactName || lead?.title || "New Enterprise Client"
      const clientEmail = lead?.email || "contact@client.internal"
      const clientPhone = lead?.phone || null

      // 1. Create or Find Client
      let client = await db.client.findFirst({
        where: { teamId, name: clientName },
      })
      if (!client) {
        client = await db.client.create({
          data: {
            teamId,
            name: clientName,
            company: lead?.companyName || clientName,
            email: clientEmail,
            phone: clientPhone,
            status: "active",
            notes: `Auto-converted from Won Lead "${lead?.title || clientName}" by Flow Engine`,
          },
        })
        executedActions.push(`Created Client Account: ${client.name} (${client.id})`)
      } else {
        executedActions.push(`Linked Existing Client: ${client.name}`)
      }
      createdEntities.client = { id: client.id, name: client.name }

      // 2. Provision New Project
      const rawKey = generateProjectKey(lead?.title || clientName)
      // Ensure unique project key
      let keyCandidate = rawKey
      let suffix = 1
      while (await db.project.findFirst({ where: { teamId, key: keyCandidate } })) {
        keyCandidate = `${rawKey.slice(0, 2)}${suffix}`
        suffix++
      }

      const project = await db.project.create({
        data: {
          teamId,
          name: lead?.title || `${client.name} Delivery Sprint`,
          description: `Auto-provisioned client deliverable project for ${client.name}`,
          key: keyCandidate,
          color: "#3b82f6",
          status: "active",
          clientId: client.id,
        },
      })
      executedActions.push(`Provisioned Project: ${project.name} [${project.key}]`)
      createdEntities.project = { id: project.id, name: project.name, key: project.key }

      // 3. Auto-provision Team Channel
      const channelSlug = `proj-${project.key.toLowerCase()}`
      let channel = await db.teamChannel.findFirst({
        where: { teamId, name: channelSlug },
      })
      if (!channel) {
        channel = await db.teamChannel.create({
          data: {
            teamId,
            name: channelSlug,
            description: `Collaborative channel for project ${project.name}`,
            isPrivate: false,
            createdBy: "flow_engine",
          },
        })
        executedActions.push(`Opened Dedicated Channel: #${channelSlug}`)
      }
      createdEntities.channel = { id: channel.id, name: channel.name }

      // 4. Seed Sprint Kickoff Task
      const defaultState = await db.workflowState.findFirst({
        where: { teamId },
        orderBy: { position: "asc" },
      })

      if (defaultState) {
        const issueCount = await db.issue.count({ where: { teamId } })
        const kickoffTask = await db.issue.create({
          data: {
            teamId,
            title: `Kickoff & Client Onboarding: ${client.name}`,
            description: `Auto-generated kickoff task for new deal delivery. Verify credentials, project scope, and initial timeline.`,
            number: issueCount + 1,
            priority: "high",
            estimate: 3,
            projectId: project.id,
            workflowStateId: defaultState.id,
            creator: actorName,
            creatorId: "system_flow",
          },
        })
        executedActions.push(`Created Kickoff Task #${kickoffTask.number}: "${kickoffTask.title}"`)
        createdEntities.task = { id: kickoffTask.id, number: kickoffTask.number, title: kickoffTask.title }
      }

      // 5. Update lead conversion link if lead exists
      if (lead?.id) {
        await db.lead.update({
          where: { id: lead.id },
          data: {
            convertedClientId: client.id,
            convertedProjectId: project.id,
            isWon: true,
          },
        })
      }

      // 6. Broadcast Announcement
      await db.teamAnnouncement.create({
        data: {
          teamId,
          title: `Deal Won & Project Provisioned! 🎉`,
          content: `Lead "${lead?.title || clientName}" was marked as Won. Auto-provisioned Project [${project.key}] and channel #${channelSlug}. Kickoff task assigned!`,
          authorName: "Flow Engine",
          authorId: "flow_engine",
        },
      })
      executedActions.push("Broadcasted Team Workspace Announcement")
    }

    // -------------------------------------------------------------
    // FLOW 2: MEETING-TO-ACTION PIPELINE
    // -------------------------------------------------------------
    else if (triggerType === "meeting_completed") {
      const meetingTitle = data.meetingTitle || data.title || "Client Strategy Sync"
      const actionItems = data.actionItems || [
        "Finalize sprint scope and deliverable architecture",
        "Deliver UI mockups to client for sign-off",
      ]

      const firstProject = await db.project.findFirst({
        where: { teamId, status: "active" },
        orderBy: { createdAt: "desc" },
      })
      const defaultState = await db.workflowState.findFirst({
        where: { teamId },
        orderBy: { position: "asc" },
      })

      let count = await db.issue.count({ where: { teamId } })
      const createdTasks = []

      for (const item of actionItems) {
        count++
        const task = await db.issue.create({
          data: {
            teamId,
            title: item,
            description: `Action item converted automatically from meeting "${meetingTitle}".`,
            number: count,
            priority: "medium",
            estimate: 2,
            projectId: firstProject?.id || null,
            workflowStateId: defaultState?.id || "default",
            creator: actorName,
            creatorId: "meeting_bot",
          },
        })
        createdTasks.push(task)
        executedActions.push(`Created Action Task #${task.number}: "${item}"`)
      }
      createdEntities.tasks = createdTasks.map((t) => ({ id: t.id, number: t.number, title: t.title }))
    }

    // -------------------------------------------------------------
    // FLOW 3: TASK OVERDUE WATCHDOG & ESCALATION
    // -------------------------------------------------------------
    else if (triggerType === "task_overdue") {
      // Find tasks with priority medium or low, escalate to high / urgent
      const candidates = await db.issue.findMany({
        where: {
          teamId,
          completedAt: null,
          priority: { in: ["low", "medium", "none"] },
        },
        take: 3,
      })

      for (const task of candidates) {
        const newPriority = task.priority === "none" || task.priority === "low" ? "medium" : "high"
        await db.issue.update({
          where: { id: task.id },
          data: { priority: newPriority },
        })
        executedActions.push(`Escalated Task #${task.number} priority: ${task.priority} ➔ ${newPriority}`)
      }
      createdEntities.escalatedCount = candidates.length
    }

    // -------------------------------------------------------------
    // FLOW 4: LEAD TRIAGE & ROUND-ROBIN ASSIGNMENT
    // -------------------------------------------------------------
    else if (triggerType === "lead_triage") {
      const unassignedLeads = await db.lead.findMany({
        where: { teamId, ownerId: null },
        take: 5,
      })
      const members = await db.teamMember.findMany({
        where: { teamId },
      })

      if (members.length > 0) {
        for (let i = 0; i < unassignedLeads.length; i++) {
          const lead = unassignedLeads[i]
          const assignedMember = members[i % members.length]
          await db.lead.update({
            where: { id: lead.id },
            data: {
              ownerId: assignedMember.userId,
              ownerName: assignedMember.userName || assignedMember.userEmail,
              temperature: "warm",
            },
          })
          executedActions.push(`Assigned Lead "${lead.title}" to ${assignedMember.userName}`)
        }
      }
      createdEntities.triagedCount = unassignedLeads.length
    }

    const durationMs = Math.round(performance.now() - startTime)

    // Write to AutomationLog and update rule execution count if a matching rule exists
    const matchingRule = await db.automationRule.findFirst({
      where: { teamId, triggerType },
    })

    if (matchingRule) {
      await db.automationRule.update({
        where: { id: matchingRule.id },
        data: {
          executionCount: { increment: 1 },
          lastTriggeredAt: new Date(),
        },
      })
      await db.automationLog.create({
        data: {
          ruleId: matchingRule.id,
          status: "success",
          details: JSON.stringify({
            executedActions,
            createdEntities,
            durationMs,
          }),
        },
      })
    }

    // Record in immutable AuditLog
    await db.auditLog.create({
      data: {
        teamId,
        userId: "flow_engine",
        userName: actorName,
        userEmail: "flow-engine@sketchitup.internal",
        action: "EXECUTE_FLOW",
        entityType: "AUTOMATION",
        entityId: matchingRule?.id || triggerType,
        entityTitle: `Flow: ${triggerType}`,
        details: {
          triggerType,
          executedActions,
          createdEntities,
          durationMs,
        },
      },
    })

    return {
      success: true,
      triggerType,
      executedActions,
      createdEntities,
      durationMs,
    }
  } catch (error: any) {
    const durationMs = Math.round(performance.now() - startTime)
    console.error("Error executing cross-module flow:", error)

    return {
      success: false,
      triggerType,
      executedActions,
      createdEntities,
      durationMs,
      error: error?.message || "Flow execution failed",
    }
  }
}
