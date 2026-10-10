import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createIssue } from "@/lib/api/issues";
import { handleRouteError } from "@/lib/authz";

const createTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  workflowStateId: z.string().min(1),
  priority: z.enum(["none", "low", "medium", "high", "urgent"]).optional(),
  estimate: z.number().nullable().optional(),
  labelIds: z.array(z.string()).optional(),
  assigneeId: z.string().nullable().optional(),
  assignee: z.string().nullable().optional(),
}).strict();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const { user } = await requireTeamAccess(teamId, { module: AppModule.WORK, level: AccessLevel.VIEW });
    const userId = user.id;

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
    const { user } = await requireTeamAccess(teamId, { module: AppModule.WORK, level: AccessLevel.WRITE });
    const userId = user.id;

    const rawBody = await request.json();
    const body = createTaskSchema.parse(rawBody);

    const taskData = {
      title: body.title.trim(),
      description: body.description ?? undefined,
      projectId: body.projectId && body.projectId.trim() !== "" ? body.projectId : undefined,
      workflowStateId: body.workflowStateId,
      assigneeId: body.assigneeId || userId,
      assignee: body.assignee || user.name || user.email || "Me",
      priority: body.priority || "none",
      estimate: body.estimate ?? undefined,
      labelIds: body.labelIds,
    };

    const newIssue = await createIssue(
      teamId,
      taskData,
      userId,
      user.name || user.email || "User"
    );

    return NextResponse.json(newIssue, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
