import { NextRequest, NextResponse } from "next/server";
import { getSessionOrNull } from "@/lib/auth-server-helpers";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionOrNull();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || "all";
    const search = searchParams.get("search") || "";

    const whereClause: any = {
      userId,
      archived: false,
    };

    if (category === "unread") {
      whereClause.read = false;
    } else if (category === "starred") {
      whereClause.starred = true;
    } else if (category === "archived") {
      whereClause.archived = true;
      delete whereClause.archived; // override
    } else if (category !== "all") {
      whereClause.category = category;
    }

    if (search.trim()) {
      whereClause.OR = [
        { subject: { contains: search, mode: "insensitive" } },
        { snippet: { contains: search, mode: "insensitive" } },
        { content: { contains: search, mode: "insensitive" } },
        { senderName: { contains: search, mode: "insensitive" } },
      ];
    }

    // Auto-seed welcoming messages if user has zero inbox messages
    const totalCount = await db.inboxMessage.count({ where: { userId } });
    if (totalCount === 0) {
      await db.inboxMessage.createMany({
        data: [
          {
            userId,
            senderId: null,
            senderName: "SketchItUp System",
            senderEmail: "system@sketchitup.internal",
            subject: "Welcome to your Personal Inbox & Alert Center",
            snippet: "Track all mentions, assigned tasks, project deadlines and team notices in one unified feed.",
            content: "Welcome to Owner OS!\n\nThis is your private communication and notification center. Whenever someone assigns you a task, mentions you in team chat, or issues an important announcement, it will land directly here.\n\nYou can star messages, reply to updates, and triage notifications with standard keyboard shortcuts.",
            category: "primary",
            read: false,
            starred: true,
          },
          {
            userId,
            senderId: null,
            senderName: "Operations Bot",
            senderEmail: "ops@sketchitup.internal",
            subject: "Team Communication & Alert Module Activated",
            snippet: "Your workspace is connected to live database communication channels.",
            content: "Module 6.8 (COMM) is now active.\n\n- Access your dedicated Team Chat under Teams in the sidebar\n- Quick Google Meet huddles can be started with a single click\n- Mark items as read to update your unread badge counter in real-time.",
            category: "alert",
            read: false,
            starred: false,
          },
        ],
      });
    }

    const messages = await db.inboxMessage.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error("Error fetching inbox messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch inbox messages" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionOrNull();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const senderId = session.user.id;
    const senderName = session.user.name || "User";
    const senderEmail = session.user.email || "";
    const senderAvatar = session.user.image || null;

    const body = await request.json();
    const { recipientId, subject, content, category = "primary", teamId = null } = body;

    if (!recipientId || !subject || !content) {
      return NextResponse.json(
        { error: "Recipient, subject, and content are required" },
        { status: 400 }
      );
    }

    const message = await db.inboxMessage.create({
      data: {
        userId: recipientId,
        senderId,
        senderName,
        senderEmail,
        senderAvatar,
        subject,
        snippet: content.slice(0, 120),
        content,
        category,
        teamId,
      },
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error("Error creating inbox message:", error);
    return NextResponse.json(
      { error: "Failed to create message" },
      { status: 500 }
    );
  }
}
