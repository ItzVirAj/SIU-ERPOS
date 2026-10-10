import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from "next/server";
import { handleRouteError, HttpError } from "@/lib/authz";
import { getChatConversation, deleteChatConversation } from "@/lib/api/chat";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; conversationId: string }> }
) {
  try {
    const { teamId, conversationId } = await params;
    const { user } = await requireTeamAccess(teamId, { module: AppModule.COLLAB, level: AccessLevel.VIEW });

    const conversation = await getChatConversation(conversationId);

    if (!conversation || conversation.teamId !== teamId) {
      throw new HttpError(404, "Conversation not found");
    }

    if (conversation.userId !== user.id) {
      throw new HttpError(403, "Forbidden");
    }

    return NextResponse.json(conversation);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; conversationId: string }> }
) {
  try {
    const { teamId, conversationId } = await params;
    const { user, member } = await requireTeamAccess(teamId, { module: AppModule.COLLAB, level: AccessLevel.MANAGE });

    const conversation = await getChatConversation(conversationId);

    if (!conversation || conversation.teamId !== teamId) {
      throw new HttpError(404, "Conversation not found");
    }

    // Only owner of conversation or team admin can delete
    if (conversation.userId !== user.id && member.role !== "admin") {
      throw new HttpError(403, "Forbidden");
    }

    await deleteChatConversation(conversationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
