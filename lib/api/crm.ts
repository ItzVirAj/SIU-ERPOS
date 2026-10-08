import { db } from "@/lib/db";

export const DEFAULT_CRM_STAGES = [
  { name: "New", type: "open", color: "#64748b", position: 0 },
  { name: "Contacted", type: "open", color: "#3b82f6", position: 1 },
  { name: "Qualified", type: "open", color: "#8b5cf6", position: 2 },
  { name: "Discovery Done", type: "open", color: "#06b6d4", position: 3 },
  { name: "Proposal Sent", type: "open", color: "#f59e0b", position: 4 },
  { name: "Negotiation", type: "open", color: "#f97316", position: 5 },
  { name: "Won", type: "won", color: "#10b981", position: 6 },
  { name: "Lost", type: "lost", color: "#ef4444", position: 7 },
  { name: "On Hold", type: "hold", color: "#78716c", position: 8 },
];

/**
 * Get or seed default CRM pipeline and stages for a team (PRD CRM-03)
 */
export async function getOrCreateDefaultPipeline(teamId: string) {
  let pipeline = await db.leadPipeline.findFirst({
    where: { teamId },
    include: {
      stages: {
        orderBy: { position: "asc" },
      },
    },
  });

  if (!pipeline) {
    pipeline = await db.leadPipeline.create({
      data: {
        teamId,
        name: "Standard Sales Pipeline",
        isDefault: true,
        stages: {
          create: DEFAULT_CRM_STAGES,
        },
      },
      include: {
        stages: {
          orderBy: { position: "asc" },
        },
      },
    });
  }

  return pipeline;
}

export interface CreateLeadInput {
  title: string;
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  industryVertical?: string;
  source?: string;
  campaign?: string;
  estimatedValue?: number;
  currency?: string;
  expectedCloseDate?: string | Date;
  requirementSummary?: string;
  temperature?: "cold" | "warm" | "hot";
  ownerId?: string;
  ownerName?: string;
  nextFollowUpDate?: string | Date;
  pipelineId?: string;
  stageId?: string;
}

export interface UpdateLeadInput {
  title?: string;
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  industryVertical?: string;
  source?: string;
  campaign?: string;
  estimatedValue?: number;
  currency?: string;
  expectedCloseDate?: string | Date | null;
  requirementSummary?: string;
  temperature?: "cold" | "warm" | "hot";
  ownerId?: string | null;
  ownerName?: string | null;
  nextFollowUpDate?: string | Date | null;
  stageId?: string;
  isWon?: boolean;
  isLost?: boolean;
  lostReason?: string | null;
  lostNotes?: string | null;
}

/**
 * Fetch leads with filtering (pipeline, stage, temperature, followups)
 */
export async function getLeads(
  teamId: string,
  options?: {
    pipelineId?: string;
    stageId?: string;
    temperature?: string;
    source?: string;
    overdueFollowUpsOnly?: boolean;
    search?: string;
  }
) {
  const pipeline = await getOrCreateDefaultPipeline(teamId);
  const where: any = {
    teamId,
    pipelineId: options?.pipelineId || pipeline.id,
  };

  if (options?.stageId && options.stageId !== "all") {
    where.stageId = options.stageId;
  }

  if (options?.temperature && options.temperature !== "all") {
    where.temperature = options.temperature;
  }

  if (options?.source && options.source !== "all") {
    where.source = options.source;
  }

  if (options?.overdueFollowUpsOnly) {
    where.nextFollowUpDate = {
      lt: new Date(),
    };
    where.isWon = false;
    where.isLost = false;
  }

  if (options?.search) {
    const q = options.search.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { companyName: { contains: q, mode: "insensitive" } },
      { contactName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  return await db.lead.findMany({
    where,
    include: {
      stage: true,
      client: true,
      activities: {
        orderBy: { performedAt: "desc" },
        take: 3,
      },
    },
    orderBy: [
      { nextFollowUpDate: "asc" },
      { createdAt: "desc" },
    ],
  });
}

/**
 * Get lead detail with all activities
 */
export async function getLeadById(teamId: string, leadId: string) {
  return await db.lead.findFirst({
    where: { id: leadId, teamId },
    include: {
      stage: true,
      client: {
        include: { contacts: true },
      },
      pipeline: {
        include: { stages: { orderBy: { position: "asc" } } },
      },
      activities: {
        orderBy: { performedAt: "desc" },
      },
    },
  });
}

/**
 * Create a new lead (PRD CRM-01 / CRM-02)
 */
export async function createLead(
  teamId: string,
  input: CreateLeadInput,
  creatorId: string,
  creatorName?: string
) {
  const pipeline = await getOrCreateDefaultPipeline(teamId);

  // If stageId not provided, default to first stage ("New")
  let targetStageId = input.stageId;
  if (!targetStageId) {
    const firstStage = pipeline.stages[0];
    targetStageId = firstStage?.id;
  }

  const ownerName = input.ownerName || creatorName || "Unassigned";
  const ownerId = input.ownerId || creatorId;

  // Next follow-up date: if not provided, default to 2 days from now (PRD CRM-07)
  const defaultFollowUp = new Date();
  defaultFollowUp.setDate(defaultFollowUp.getDate() + 2);

  const lead = await db.lead.create({
    data: {
      teamId,
      pipelineId: input.pipelineId || pipeline.id,
      stageId: targetStageId!,
      title: input.title,
      companyName: input.companyName || null,
      contactName: input.contactName || null,
      email: input.email || null,
      phone: input.phone || null,
      industryVertical: input.industryVertical || null,
      source: input.source || "website",
      campaign: input.campaign || null,
      estimatedValue: input.estimatedValue ? Number(input.estimatedValue) : null,
      currency: input.currency || "INR",
      expectedCloseDate: input.expectedCloseDate ? new Date(input.expectedCloseDate) : null,
      requirementSummary: input.requirementSummary || null,
      temperature: input.temperature || "warm",
      ownerId,
      ownerName,
      nextFollowUpDate: input.nextFollowUpDate ? new Date(input.nextFollowUpDate) : defaultFollowUp,
      activities: {
        create: {
          type: "note",
          content: `Lead created by ${creatorName || "Team Member"} via ${input.source || "website"}.`,
          performedBy: creatorName || "System",
        },
      },
    },
    include: {
      stage: true,
      activities: true,
    },
  });

  return lead;
}

/**
 * Update lead and log stage changes
 */
export async function updateLead(
  teamId: string,
  leadId: string,
  input: UpdateLeadInput,
  actorName: string = "User"
) {
  const existing = await db.lead.findFirst({
    where: { id: leadId, teamId },
    include: { stage: true },
  });

  if (!existing) {
    throw new Error("Lead not found");
  }

  const data: any = { ...input };

  if (input.expectedCloseDate !== undefined) {
    data.expectedCloseDate = input.expectedCloseDate ? new Date(input.expectedCloseDate) : null;
  }
  if (input.nextFollowUpDate !== undefined) {
    data.nextFollowUpDate = input.nextFollowUpDate ? new Date(input.nextFollowUpDate) : null;
  }

  // Handle stage change activity log
  let stageChangeNote: string | null = null;
  if (input.stageId && input.stageId !== existing.stageId) {
    const newStage = await db.leadStage.findUnique({
      where: { id: input.stageId },
    });
    if (newStage) {
      stageChangeNote = `Moved stage from "${existing.stage?.name}" to "${newStage.name}" by ${actorName}.`;
      if (newStage.type === "won") {
        data.isWon = true;
        data.isLost = false;
      } else if (newStage.type === "lost") {
        data.isLost = true;
        data.isWon = false;
      }
    }
  }

  const updated = await db.lead.update({
    where: { id: leadId, teamId },
    data,
    include: {
      stage: true,
      activities: { orderBy: { performedAt: "desc" }, take: 5 },
    },
  });

  if (stageChangeNote) {
    await db.leadActivity.create({
      data: {
        leadId,
        type: "note",
        content: stageChangeNote,
        performedBy: actorName,
      },
    });
  }

  // Cross-Module FLOW Automation: Trigger Lead-to-Cash if lead is marked Won
  if (updated.isWon && !existing.isWon) {
    try {
      const { executeCrossModuleFlow } = await import("@/lib/automations/dispatcher");
      await executeCrossModuleFlow({
        teamId,
        triggerType: "lead_won",
        entityId: leadId,
        actorName,
        data: { lead: updated },
      });
    } catch (flowErr) {
      console.error("Lead-to-Cash automation dispatch error:", flowErr);
    }
  }

  return updated;
}

/**
 * Delete a lead
 */
export async function deleteLead(teamId: string, leadId: string) {
  return await db.lead.delete({
    where: { id: leadId, teamId },
  });
}

/**
 * Add an activity to a lead (Call, Email, WhatsApp, Meeting, Note) - PRD CRM-06
 */
export async function addLeadActivity(
  leadId: string,
  activity: {
    type: "call" | "email" | "whatsapp" | "meeting" | "note";
    content: string;
    performedBy: string;
    newNextFollowUpDate?: string | Date;
  }
) {
  const newActivity = await db.leadActivity.create({
    data: {
      leadId,
      type: activity.type,
      content: activity.content,
      performedBy: activity.performedBy,
    },
  });

  // If next follow-up date updated as part of activity log
  if (activity.newNextFollowUpDate) {
    await db.lead.update({
      where: { id: leadId },
      data: {
        nextFollowUpDate: new Date(activity.newNextFollowUpDate),
      },
    });
  }

  return newActivity;
}

/**
 * 1-Click Convert Won Lead into Client + Contact + draft Project (PRD CRM-09 / CRM-W1)
 */
export async function convertLeadToClientAndProject(
  teamId: string,
  leadId: string,
  options?: {
    clientName?: string;
    projectKey?: string;
    projectName?: string;
  }
) {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
  });

  if (!lead) {
    throw new Error("Lead not found");
  }

  const clientName = options?.clientName || lead.companyName || lead.contactName || lead.title;

  // 1. Create Client record
  const client = await db.client.create({
    data: {
      teamId,
      name: clientName,
      company: lead.companyName || null,
      email: lead.email || null,
      phone: lead.phone || null,
      industry: lead.industryVertical || null,
      status: "active",
      notes: `Converted from Lead: ${lead.title}.\nRequirement Summary: ${lead.requirementSummary || "N/A"}`,
      contacts: lead.contactName
        ? {
            create: {
              name: lead.contactName,
              email: lead.email || "no-email@client.local",
              phone: lead.phone || null,
              isPrimary: true,
              role: "decision_maker",
            },
          }
        : undefined,
    },
    include: {
      contacts: true,
    },
  });

  // 2. Create Project draft linked to this client
  const projectKey =
    options?.projectKey ||
    clientName.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "PRJ");
  const projectName = options?.projectName || `${clientName} Engagement`;

  // Ensure unique project key in team
  const existingProject = await db.project.findFirst({
    where: { teamId, key: projectKey },
  });
  const safeProjectKey = existingProject ? `${projectKey}${Math.floor(Math.random() * 9)}` : projectKey;

  const project = await db.project.create({
    data: {
      teamId,
      clientId: client.id,
      name: projectName,
      key: safeProjectKey,
      description: lead.requirementSummary || `Client engagement for ${clientName}`,
      color: "#10b981", // green for converted client projects
      status: "active",
      lead: lead.ownerName || null,
    },
  });

  // 3. Mark Lead as Won and link converted Client and Project
  const updatedLead = await db.lead.update({
    where: { id: leadId },
    data: {
      isWon: true,
      isLost: false,
      clientId: client.id,
      convertedClientId: client.id,
      convertedProjectId: project.id,
    },
  });

  // 4. Log conversion activity
  await db.leadActivity.create({
    data: {
      leadId,
      type: "note",
      content: `🎉 Converted to Client "${client.name}" and Project "${project.name}" (${project.key})!`,
      performedBy: lead.ownerName || "System",
    },
  });

  return {
    lead: updatedLead,
    client,
    project,
  };
}

/**
 * Fetch clients list for team
 */
export async function getClients(teamId: string) {
  return await db.client.findMany({
    where: { teamId },
    include: {
      contacts: true,
      projects: {
        select: { id: true, name: true, key: true, status: true, color: true },
      },
      leads: {
        select: { id: true, title: true, isWon: true, estimatedValue: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
