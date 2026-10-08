import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTeamMember, handleRouteError } from "@/lib/authz";
import { db } from "@/lib/db";

const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  isPinned: z.boolean().default(true),
}).strict();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const { user } = await requireTeamMember(teamId);

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
      isAcknowledgedByMe: a.acks.some((ack) => ack.userId === user.id),
      ackCount: a.acks.length,
    }));

    return NextResponse.json(enriched);
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
    const { user } = await requireTeamMember(teamId, "developer");

    const rawBody = await request.json();
    const { title, content, priority, isPinned } = createAnnouncementSchema.parse(rawBody);

    const announcement = await db.teamAnnouncement.create({
      data: {
        teamId,
        title: title.trim(),
        content: content.trim(),
        priority,
        authorId: user.id,
        authorName: user.name || "Team Lead",
        isPinned,
      },
      include: {
        acks: true,
      },
    });

    // Notify all other members of this team in their inbox
    const teamMembers = await db.teamMember.findMany({
      where: { teamId },
    });

    for (const member of teamMembers) {
      if (member.userId !== user.id) {
        await db.inboxMessage.create({
          data: {
            userId: member.userId,
            senderId: user.id,
            senderName: user.name || "Team Lead",
            subject: `📢 New Team Announcement: ${title.trim()}`,
            snippet: content.trim().slice(0, 120),
            content: content.trim(),
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
    return handleRouteError(error);
  }
}
