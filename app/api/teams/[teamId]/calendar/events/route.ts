import { NextRequest, NextResponse } from "next/server";
import { getUserId, getUser, verifyTeamMembership } from "@/lib/auth-server-helpers";
import { getEvents, createEvent } from "@/lib/api/calendar";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const userId = await getUserId();
    await verifyTeamMembership(teamId, userId);

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
        id: `issue_${issue.id}`,
        isIssue: true,
        issueId: issue.id,
        title: `${issue.project ? `${issue.project.key}-${issue.number}: ` : ""}${issue.title}`,
        type: "task_deadline",
        startTime: issue.createdAt,
        endTime: issue.createdAt,
        allDay: true,
        status: issue.workflowState.type === "completed" ? "completed" : "scheduled",
        priority: issue.priority,
        project: issue.project,
        workflowState: issue.workflowState,
        assignee: issue.assignee,
        creator: issue.creator,
      }));
    }

    return NextResponse.json({
      events,
      issueEvents,
      total: events.length + issueEvents.length,
    });
  } catch (error: any) {
    console.error("Failed to get calendar events:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get events" },
      { status: error.message === "Unauthorized" ? 401 : 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const userId = await getUserId();
    const user = await getUser();
    await verifyTeamMembership(teamId, userId);

    const body = await request.json();

    if (!body.title || !body.startTime || !body.endTime) {
      return NextResponse.json(
        { error: "Title, start time, and end time are required" },
        { status: 400 }
      );
    }

    // Auto-generate a Google Meet link if toggled or requested
    let meetUrl = body.meetUrl;
    if (body.generateMeet && !meetUrl) {
      const meetCode = `${Math.random().toString(36).substring(2, 5)}-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}`;
      meetUrl = `https://meet.google.com/${meetCode}`;
    }

    const event = await createEvent(
      teamId,
      {
        title: body.title,
        description: body.description,
        type: body.type || "meeting",
        startTime: body.startTime,
        endTime: body.endTime,
        allDay: body.allDay ?? false,
        location: body.location,
        meetUrl,
        projectId: body.projectId || null,
        recurrence: body.recurrence || "none",
        attendees: body.attendees || [],
      },
      userId,
      user.name || undefined
    );

    return NextResponse.json(event, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create calendar event:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create event" },
      { status: error.message === "Unauthorized" ? 401 : 500 }
    );
  }
}
