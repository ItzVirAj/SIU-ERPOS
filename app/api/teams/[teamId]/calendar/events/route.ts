import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError } from "@/lib/authz";
import { getEvents, createEvent } from "@/lib/api/calendar";
import { db } from "@/lib/db";

const createEventSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  type: z.enum(["meeting", "standup", "milestone", "task_deadline", "followup", "leave"]).default("meeting"),
  startTime: z.union([z.string(), z.date()]),
  endTime: z.union([z.string(), z.date()]),
  allDay: z.boolean().optional(),
  location: z.string().nullable().optional(),
  meetUrl: z.string().nullable().optional(),
  generateMeet: z.boolean().optional(),
  projectId: z.string().nullable().optional(),
  recurrence: z.string().optional(),
  attendees: z.array(z.union([
    z.string().transform((s) => ({ name: s, email: s })),
    z.object({ name: z.string(), email: z.string(), userId: z.string().optional() }),
  ])).optional(),
}).strict();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    await requireTeamAccess(teamId, { module: AppModule.COLLAB, level: AccessLevel.VIEW });

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const type = searchParams.get("type") || undefined;
    const projectId = searchParams.get("projectId") || undefined;
    const includeIssues = searchParams.get("includeIssues") !== "false";

    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    // 1. Fetch custom calendar events
    const events = await getEvents(teamId, {
      startDate,
      endDate,
      type,
      projectId,
    });

    // 2. Fetch issues to display on calendar if requested (PRD CAL-01 Unified view)
    let issueEvents: any[] = [];
    if (includeIssues && (!type || type === "all" || type === "task_deadline")) {
      const issueWhere: any = { teamId };
      if (projectId && projectId !== "all") {
        issueWhere.projectId = projectId;
      }
      if (startDate || endDate) {
        issueWhere.createdAt = {};
        if (startDate) issueWhere.createdAt.gte = startDate;
        if (endDate) issueWhere.createdAt.lte = endDate;
      }

      const issues = await db.issue.findMany({
        where: issueWhere,
        include: {
          project: {
            select: { id: true, name: true, key: true, color: true },
          },
          workflowState: {
            select: { id: true, name: true, type: true, color: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      issueEvents = issues.map((issue) => ({
        id: `task_${issue.id}`,
        title: `[${issue.project?.key || "TASK"}-${issue.number}] ${issue.title}`,
        startTime: issue.createdAt,
        endTime: issue.createdAt,
        allDay: true,
        type: "task_deadline",
        isIssue: true,
        priority: issue.priority,
        status: issue.workflowState?.name,
        color: issue.workflowState?.color || "#6366f1",
        projectId: issue.projectId,
        issueId: issue.id,
      }));
    }

    return NextResponse.json({
      events,
      issueEvents,
      total: events.length + issueEvents.length,
    });
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
    const { user } = await requireTeamAccess(teamId, { module: AppModule.COLLAB, level: AccessLevel.WRITE });
    const userId = user.id;

    const rawBody = await request.json();
    const body = createEventSchema.parse(rawBody);

    // Auto-generate a Google Meet link if toggled or requested
    let meetUrl = body.meetUrl;
    if (body.generateMeet && !meetUrl) {
      const meetCode = `${Math.random().toString(36).substring(2, 5)}-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}`;
      meetUrl = `https://meet.google.com/${meetCode}`;
    }

    const event = await createEvent(
      teamId,
      {
        title: body.title.trim(),
        description: body.description ?? undefined,
        type: body.type || "meeting",
        startTime: new Date(body.startTime),
        endTime: new Date(body.endTime),
        allDay: body.allDay ?? false,
        location: body.location ?? undefined,
        meetUrl: meetUrl ?? undefined,
        projectId: body.projectId || undefined,
        recurrence: body.recurrence || "none",
        attendees: body.attendees || [],
      },
      userId,
      user.name || undefined
    );

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
