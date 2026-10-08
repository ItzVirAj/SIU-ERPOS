import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTeamAdmin, handleRouteError } from "@/lib/authz";
import { db } from "@/lib/db";

const createAuditLogSchema = z.object({
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().nullable().optional(),
  entityTitle: z.string().nullable().optional(),
  details: z.any().optional(),
}).strict()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const { user, userId, member } = await requireTeamAdmin(teamId);

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const entityType = searchParams.get("entityType");
    const search = searchParams.get("search") || "";

    const where: any = { teamId };

    if (action && action !== "ALL") {
      where.action = action;
    }

    if (entityType && entityType !== "ALL") {
      where.entityType = entityType;
    }

    if (search.trim()) {
      where.OR = [
        { userName: { contains: search, mode: "insensitive" } },
        { userEmail: { contains: search, mode: "insensitive" } },
        { entityTitle: { contains: search, mode: "insensitive" } },
        { action: { contains: search, mode: "insensitive" } },
      ];
    }

    // Auto-seed starter audit logs if table is empty for this team
    const count = await db.auditLog.count({ where: { teamId } });
    if (count === 0) {
      await db.auditLog.createMany({
        data: [
          {
            teamId,
            userId,
            userName: member.userName || user.name || "Administrator",
            userEmail: member.userEmail || user.email || "admin@sketchitup.internal",
            action: "SECURITY",
            entityType: "system",
            entityTitle: "Owner OS Enterprise Security Initialized",
            details: { event: "Initial setup", security_mode: "RBAC_ACTIVE" },
            ipAddress: "127.0.0.1",
          },
        ],
      });
    }

    const logs = await db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(logs);
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
    const { user, userId, member } = await requireTeamAdmin(teamId);

    const rawBody = await request.json();
    const body = createAuditLogSchema.parse(rawBody);

    const log = await db.auditLog.create({
      data: {
        teamId,
        userId,
        userName: member.userName || user.name || "Administrator",
        userEmail: member.userEmail || user.email || "admin@sketchitup.internal",
        action: body.action || "UPDATE",
        entityType: body.entityType || "general",
        entityId: body.entityId,
        entityTitle: body.entityTitle,
        details: body.details,
        ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
      },
    });

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
