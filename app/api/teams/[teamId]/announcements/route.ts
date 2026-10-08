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
        { error: "Access denied. Only team members can view announcements." },
        { status: 403 }
      );
    }

    const announcements = await db.teamAnnouncement.findMany({
      where: { teamId },
      include: {
        acks: {
          select: {
            userId: true,
            userName: true,
            acknowledgedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const enriched = announcements.map((a) => ({
      ...a,
      isAcknowledgedByMe: a.acks.some((ack) => ack.userId === userId),
      ackCount: a.acks.length,
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("Error fetching announcements:", error);
    return NextResponse.json(
      { error: "Failed to fetch announcements" },
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
    const userName = session.user.name || "Team Lead";

    const isMember = await isTeamMember(teamId, userId);
    if (!isMember) {
      return NextResponse.json(
        { error: "Access denied. Only team members can post announcements." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, content, priority = "normal", isPinned = true } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

    const announcement = await db.teamAnnouncement.create({
      data: {
        teamId,
        title,
        content,
        priority,
        authorId: userId,
        authorName: userName,
        isPinned: Boolean(isPinned),
      },
      include: {
        acks: true,
      },
    });

    // Notify all members of this team in their inbox
    const teamMembers = await db.teamMember.findMany({
      where: { teamId },
    });

    for (const member of teamMembers) {
      if (member.userId !== userId) {
        await db.inboxMessage.create({
          data: {
            userId: member.userId,
            senderId: userId,
            senderName: userName,
            subject: `📢 New Team Announcement: ${title}`,
            snippet: content.slice(0, 120),
            content,
            category: "alert",
            entityType: "announcement",
            entityId: announcement.id,
            entityUrl: `/dashboard/team?tab=overview`,
            teamId,
          },
        });
      }
    }

    return NextResponse.json(announcement, { status: 201 });
  } catch (error) {
    console.error("Error creating announcement:", error);
    return NextResponse.json(
      { error: "Failed to create announcement" },
      { status: 500 }
    );
  }
}
