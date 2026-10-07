import { NextRequest, NextResponse } from "next/server";
import { getUserId, getUser, verifyTeamMembership } from "@/lib/auth-server-helpers";
import { db } from "@/lib/db";
import { createIssue } from "@/lib/api/issues";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const userId = await getUserId();
    const user = await getUser();

    await verifyTeamMembership(teamId, userId);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const type = searchParams.get("type"); // "active" | "completed" | "all"
    const priority = searchParams.getAll("priority");
    const status = searchParams.getAll("status");
    const project = searchParams.getAll("project");
    const getStats = searchParams.get("stats") === "true";

    // Strictly tasks assigned or given to current user
    const userMatchConditions: any[] = [
      { assigneeId: userId },
    ];
    if (user.name) {
      userMatchConditions.push({ assignee: { equals: user.name, mode: "insensitive" } });
    }
    if (user.email) {
      userMatchConditions.push({ assignee: { equals: user.email, mode: "insensitive" } });
    }
    // Also include tasks created by user with no assignee
    userMatchConditions.push({
      AND: [
        { creatorId: userId },
        { assigneeId: null },
        { assignee: null },
      ],
    });

    const where: any = {
      teamId,
      OR: userMatchConditions,
    };

    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        },
      ];
    }

    if (priority.length > 0) {
      where.priority = { in: priority };
    }

    if (project.length > 0) {
      where.projectId = { in: project };
    }

    if (status.length > 0) {
      where.workflowStateId = { in: status };
    }

    if (type === "active") {
      where.workflowState = {
        type: { notIn: ["completed", "canceled"] },
      };
    } else if (type === "completed") {
      where.workflowState = {
        type: "completed",
      };
    }

    // Return stats if requested
    if (getStats) {
      const allUserTasks = await db.issue.findMany({
        where: {
          teamId,
          OR: userMatchConditions,
        },
        include: {
          workflowState: true,
        },
      });

      const total = allUserTasks.length;
      const completed = allUserTasks.filter((t) => t.workflowState?.type === "completed").length;
      const active = allUserTasks.filter(
        (t) => t.workflowState?.type !== "completed" && t.workflowState?.type !== "canceled"
      ).length;
      const urgent = allUserTasks.filter(
        (t) => t.priority === "urgent" && t.workflowState?.type !== "completed"
      ).length;

      return NextResponse.json({
        total,
        active,
        completed,
        urgent,
      });
    }

    const issues = await db.issue.findMany({
      where,
      orderBy: [
        { priority: "asc" },
        { createdAt: "desc" },
      ],
      include: {
        workflowState: true,
        project: {
          select: {
            id: true,
            name: true,
            key: true,
            color: true,
            icon: true,
          },
        },
        team: {
          select: {
            id: true,
            key: true,
            name: true,
          },
        },
        labels: {
          include: {
            label: true,
          },
        },
        comments: {
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
    });

    return NextResponse.json(issues);
  } catch (error: any) {
    console.error("Error in GET /api/teams/[teamId]/my-tasks:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch user tasks" },
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

    // Default assignee to current user
    const taskData = {
      ...body,
      assigneeId: body.assigneeId || userId,
      assignee: body.assignee || user.name || user.email || "Me",
    };

    const newIssue = await createIssue(
      teamId,
      taskData,
      userId,
      user.name || user.email || "User"
    );

    return NextResponse.json(newIssue, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/teams/[teamId]/my-tasks:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create task" },
      { status: error.message === "Unauthorized" ? 401 : 500 }
    );
  }
}
