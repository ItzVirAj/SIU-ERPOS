import { db } from "@/lib/db";

export interface CreateEventInput {
  title: string;
  description?: string;
  type?: "meeting" | "standup" | "milestone" | "task_deadline" | "followup" | "leave";
  startTime: string | Date;
  endTime: string | Date;
  allDay?: boolean;
  location?: string;
  meetUrl?: string;
  projectId?: string;
  recurrence?: string;
  attendees?: Array<{
    name: string;
    email: string;
    userId?: string;
  }>;
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  type?: string;
  startTime?: string | Date;
  endTime?: string | Date;
  allDay?: boolean;
  location?: string;
  meetUrl?: string;
  status?: string;
  projectId?: string | null;
  recurrence?: string;
}

export interface UpsertMeetingNoteInput {
  content?: string;
  summary?: string;
  decisions?: string;
  rawTranscript?: string;
  followUpEmailDraft?: string;
  actionItems?: Array<{
    id?: string;
    title: string;
    assigneeName?: string;
    dueDate?: string | Date;
  }>;
}

export interface CreateStandupInput {
  yesterday: string;
  today: string;
  blockers?: string;
  autoCreateBlockerIssue?: boolean;
  projectId?: string;
}

/**
 * Fetch events for a team, optionally filtered by date range and type
 */
export async function getEvents(
  teamId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    type?: string;
    projectId?: string;
  }
) {
  const where: any = { teamId };

  if (options?.type && options.type !== "all") {
    where.type = options.type;
  }

  if (options?.projectId && options.projectId !== "all") {
    where.projectId = options.projectId;
  }

  if (options?.startDate || options?.endDate) {
    where.startTime = {};
    if (options.startDate) {
      where.startTime.gte = options.startDate;
    }
    if (options.endDate) {
      where.startTime.lte = options.endDate;
    }
  }

  return await db.event.findMany({
    where,
    include: {
      attendees: true,
      project: {
        select: {
          id: true,
          name: true,
          key: true,
          color: true,
        },
      },
      meetingNote: {
        include: {
          actionItems: true,
        },
      },
    },
    orderBy: {
      startTime: "asc",
    },
  });
}

/**
 * Get a single event by ID with its attendees and meeting notes
 */
export async function getEventById(teamId: string, eventId: string) {
  return await db.event.findFirst({
    where: {
      id: eventId,
      teamId,
    },
    include: {
      attendees: true,
      project: true,
      meetingNote: {
        include: {
          actionItems: true,
        },
      },
    },
  });
}

/**
 * Create a new event and optionally attach attendees
 */
export async function createEvent(
  teamId: string,
  input: CreateEventInput,
  creatorId: string,
  creatorName?: string
) {
  const { attendees, ...eventData } = input;

  return await db.event.create({
    data: {
      ...eventData,
      teamId,
      creatorId,
      creatorName: creatorName || null,
      startTime: new Date(input.startTime),
      endTime: new Date(input.endTime),
      attendees: attendees && attendees.length > 0
        ? {
            create: attendees.map((a) => ({
              name: a.name,
              email: a.email,
              userId: a.userId || null,
              status: "pending",
            })),
          }
        : undefined,
    },
    include: {
      attendees: true,
      project: true,
      meetingNote: {
        include: {
          actionItems: true,
        },
      },
    },
  });
}

/**
 * Update event fields
 */
export async function updateEvent(
  teamId: string,
  eventId: string,
  input: UpdateEventInput
) {
  const data: any = { ...input };
  if (input.startTime) data.startTime = new Date(input.startTime);
  if (input.endTime) data.endTime = new Date(input.endTime);

  return await db.event.update({
    where: {
      id: eventId,
      teamId,
    },
    data,
    include: {
      attendees: true,
      project: true,
      meetingNote: {
        include: {
          actionItems: true,
        },
      },
    },
  });
}

/**
 * Delete an event
 */
export async function deleteEvent(teamId: string, eventId: string) {
  return await db.event.delete({
    where: {
      id: eventId,
      teamId,
    },
  });
}

/**
 * Save or update meeting notes and synchronize action items
 */
export async function upsertMeetingNote(
  eventId: string,
  input: UpsertMeetingNoteInput
) {
  const { actionItems, ...noteFields } = input;

  // Find or create meeting note
  const existing = await db.meetingNote.findUnique({
    where: { eventId },
  });

  let noteId = existing?.id;

  if (existing) {
    await db.meetingNote.update({
      where: { eventId },
      data: {
        ...noteFields,
        updatedAt: new Date(),
      },
    });
  } else {
    const created = await db.meetingNote.create({
      data: {
        ...noteFields,
        eventId,
      },
    });
    noteId = created.id;
  }

  // Handle action items if provided
  if (actionItems && noteId) {
    for (const item of actionItems) {
      if (item.id) {
        await db.meetingActionItem.update({
          where: { id: item.id },
          data: {
            title: item.title,
            assigneeName: item.assigneeName || null,
            dueDate: item.dueDate ? new Date(item.dueDate) : null,
          },
        });
      } else {
        await db.meetingActionItem.create({
          data: {
            meetingNoteId: noteId,
            title: item.title,
            assigneeName: item.assigneeName || null,
            dueDate: item.dueDate ? new Date(item.dueDate) : null,
            status: "open",
          },
        });
      }
    }
  }

  return await db.meetingNote.findUnique({
    where: { eventId },
    include: {
      actionItems: true,
    },
  });
}

/**
 * Convert a meeting action item into a tracked project Issue (PRD CAL-08 / PRJ-03)
 */
export async function convertActionItemToIssue(
  teamId: string,
  actionItemId: string,
  userId: string,
  userName: string,
  targetProjectId?: string
) {
  const actionItem = await db.meetingActionItem.findUnique({
    where: { id: actionItemId },
    include: {
      meetingNote: {
        include: {
          event: true,
        },
      },
    },
  });

  if (!actionItem) {
    throw new Error("Action item not found");
  }

  if (actionItem.status === "converted" && actionItem.convertedIssueId) {
    return { issueId: actionItem.convertedIssueId, alreadyConverted: true };
  }

  // Determine project
  const projectId =
    targetProjectId ||
    actionItem.meetingNote.event.projectId ||
    (await db.project.findFirst({ where: { teamId } }))?.id;

  // Determine initial workflow state (todo / unstarted or backlog)
  const workflowState =
    (await db.workflowState.findFirst({
      where: {
        teamId,
        type: { in: ["unstarted", "started", "backlog"] },
      },
      orderBy: { position: "asc" },
    })) ||
    (await db.workflowState.findFirst({ where: { teamId } }));

  if (!workflowState) {
    throw new Error("No valid workflow state found for team");
  }

  // Determine next issue number for team
  const lastIssue = await db.issue.findFirst({
    where: { teamId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const issueNumber = (lastIssue?.number || 0) + 1;

  // Create issue
  const newIssue = await db.issue.create({
    data: {
      teamId,
      projectId: projectId || null,
      workflowStateId: workflowState.id,
      number: issueNumber,
      title: actionItem.title,
      description: `Generated from meeting "${actionItem.meetingNote.event.title}".\n\nAssigned: ${actionItem.assigneeName || "Unassigned"}`,
      priority: "medium",
      creatorId: userId,
      creator: userName,
      assignee: actionItem.assigneeName || null,
    },
  });

  // Mark action item as converted
  await db.meetingActionItem.update({
    where: { id: actionItemId },
    data: {
      status: "converted",
      convertedIssueId: newIssue.id,
    },
  });

  return { issue: newIssue, actionItem };
}

/**
 * Record a developer daily stand-up entry (PRD CAL-06)
 */
export async function createStandupEntry(
  teamId: string,
  input: CreateStandupInput,
  userId: string,
  userName: string,
  userEmail: string
) {
  const entry = await db.standupEntry.create({
    data: {
      teamId,
      userId,
      userName,
      userEmail,
      yesterday: input.yesterday,
      today: input.today,
      blockers: input.blockers || null,
    },
  });

  // If user recorded blockers and requested auto-task creation
  let createdBlockerIssue = null;
  if (input.blockers && input.blockers.trim().length > 0 && input.autoCreateBlockerIssue) {
    const defaultProject = input.projectId
      ? await db.project.findUnique({ where: { id: input.projectId } })
      : await db.project.findFirst({ where: { teamId } });

    const workflowState = await db.workflowState.findFirst({
      where: {
        teamId,
        type: { in: ["started", "unstarted"] },
      },
    });

    if (workflowState) {
      const lastIssue = await db.issue.findFirst({
        where: { teamId },
        orderBy: { number: "desc" },
        select: { number: true },
      });
      const issueNumber = (lastIssue?.number || 0) + 1;

      createdBlockerIssue = await db.issue.create({
        data: {
          teamId,
          projectId: defaultProject?.id || null,
          workflowStateId: workflowState.id,
          number: issueNumber,
          title: `[BLOCKER] ${input.blockers.slice(0, 80).replace(/\n/g, " ")}`,
          description: `Reported by ${userName} in stand-up:\n\n${input.blockers}`,
          priority: "urgent",
          creatorId: userId,
          creator: userName,
          assigneeId: userId,
          assignee: userName,
        },
      });
    }
  }

  return { entry, createdBlockerIssue };
}

/**
 * Get daily stand-up entries for a specific day
 */
export async function getStandupEntries(teamId: string, date?: Date) {
  const targetDate = date ? new Date(date) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  return await db.standupEntry.findMany({
    where: {
      teamId,
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}
