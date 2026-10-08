import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTeamMember, handleRouteError, HttpError } from "@/lib/authz";
import { db } from "@/lib/db";

const reactionSchema = z.object({
  emoji: z.string().min(1).max(32),
}).strict();

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
    const { teamId, channelId, messageId } = await params;
    const { user } = await requireTeamMember(teamId);
    const userId = user.id;
    const userName = user.name || "Member";

    // Verify channel belongs to team
    const channel = await db.teamChannel.findFirst({
      where: { id: channelId, teamId },
    });
    if (!channel) {
      throw new HttpError(404, "Channel not found in this team");
    }

    // Verify message belongs to channel
    const targetMessage = await db.teamChatMessage.findFirst({
      where: { id: messageId, channelId },
    });
    if (!targetMessage) {
      throw new HttpError(404, "Message not found in this channel");
    }

    const rawBody = await request.json();
    const { emoji } = reactionSchema.parse(rawBody);

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
    return handleRouteError(error);
  }
}
