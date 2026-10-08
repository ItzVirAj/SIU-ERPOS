import { NextRequest, NextResponse } from "next/server";
import { getSessionOrNull, isTeamMember } from "@/lib/auth-server-helpers";
import { db } from "@/lib/db";

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      teamId: string;
      channelId: string;
      messageId: string;
    }>;
  }
) {
  try {
    const session = await getSessionOrNull();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId, messageId } = await params;
    const userId = session.user.id;
    const userName = session.user.name || "Member";

    const isMember = await isTeamMember(teamId, userId);
    if (!isMember) {
      return NextResponse.json(
        { error: "Access denied. Only team members can react to messages." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { emoji } = body;

    if (!emoji || typeof emoji !== "string") {
      return NextResponse.json({ error: "Emoji is required" }, { status: 400 });
    }

    // Check if reaction exists
    const existing = await db.teamChatReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji,
        },
      },
    });

    if (existing) {
      // Toggle off (remove)
      await db.teamChatReaction.delete({
        where: { id: existing.id },
      });
      return NextResponse.json({ action: "removed", emoji });
    } else {
      // Toggle on (add)
      const reaction = await db.teamChatReaction.create({
        data: {
          messageId,
          userId,
          userName,
          emoji,
        },
      });
      return NextResponse.json({ action: "added", reaction });
    }
  } catch (error) {
    console.error("Error toggling reaction:", error);
    return NextResponse.json(
      { error: "Failed to toggle reaction" },
      { status: 500 }
    );
  }
}
