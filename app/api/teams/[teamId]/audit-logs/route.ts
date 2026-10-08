import { NextRequest, NextResponse } from "next/server";
import { getSessionOrNull, isTeamMember } from "@/lib/auth-server-helpers";
import { db } from "@/lib/db";

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
    const userId = session.user.id;

    const isMember = await isTeamMember(teamId, userId);
    if (!isMember) {
      return NextResponse.json(
        { error: "Access denied. Only team members can view audit logs." },
        { status: 403 }
      );
    }

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
            userName: session.user.name || "Administrator",
            userEmail: session.user.email || "admin@sketchitup.internal",
            action: "SECURITY",
            entityType: "system",
            entityTitle: "Owner OS Enterprise Security Initialized",
            details: { event: "Initial setup", security_mode: "RBAC_ACTIVE" },
            ipAddress: "127.0.0.1",
          },
          {
            teamId,
            userId,
            userName: session.user.name || "Administrator",
            userEmail: session.user.email || "admin@sketchitup.internal",
            action: "CREATE",
            entityType: "channel",
            entityTitle: "#general and #announcements auto-provisioned",
            details: { channels: ["general", "announcements"] },
            ipAddress: "127.0.0.1",
          },
          {
            teamId,
            userId,
            userName: session.user.name || "Administrator",
            userEmail: session.user.email || "admin@sketchitup.internal",
            action: "LOGIN",
            entityType: "session",
            entityTitle: "Admin session authenticated via Better Auth",
            details: { auth_method: "email" },
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
    console.error("Error fetching audit logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
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
    const userName = session.user.name || "Member";
    const userEmail = session.user.email || "";

    const isMember = await isTeamMember(teamId, userId);
    if (!isMember) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { action, entityType, entityId, entityTitle, details } = body;

    const log = await db.auditLog.create({
      data: {
        teamId,
        userId,
        userName,
        userEmail,
        action: action || "UPDATE",
        entityType: entityType || "general",
        entityId,
        entityTitle,
        details,
        ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
      },
    });

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error("Error creating audit log:", error);
    return NextResponse.json(
      { error: "Failed to create audit log" },
      { status: 500 }
    );
  }
}
