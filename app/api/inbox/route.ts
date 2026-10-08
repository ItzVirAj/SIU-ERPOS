import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, handleRouteError } from "@/lib/authz";
import { db } from "@/lib/db";

const createMessageSchema = z.object({
  recipientId: z.string().min(1),
  subject: z.string().min(1).max(255),
  content: z.string().min(1),
  category: z.string().default("primary"),
  teamId: z.string().nullable().optional(),
}).strict();

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
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
            senderName: "Productivity Guide",
            senderEmail: "ai@sketchitup.internal",
            subject: "Quick tip: Use hotkeys and mention tags in team channels",
            snippet: "Type @username to ping any teammate directly or link tasks in chat with #123.",
            content: "Stay in the flow!\n\nEvery time a teammate mentions you with @name in a public or private team channel, an instant notification message is routed here with a deep link to the exact context.",
            category: "system",
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
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const senderId = session.user.id;
    const senderName = session.user.name || "User";
    const senderEmail = session.user.email || "";
    const senderAvatar = session.user.image || null;

    const rawBody = await request.json();
    const { recipientId, subject, content, category, teamId } = createMessageSchema.parse(rawBody);

    const message = await db.inboxMessage.create({
      data: {
        userId: recipientId,
        senderId,
        senderName,
        senderEmail,
        senderAvatar,
        subject: subject.trim(),
        snippet: content.trim().slice(0, 120),
        content: content.trim(),
        category,
        teamId: teamId || null,
      },
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
