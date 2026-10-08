import { NextRequest, NextResponse } from "next/server";
import { requireTeamMember, handleRouteError } from "@/lib/authz";
import { getChatConversations, createChatConversation, getChatConversation } from "@/lib/api/chat";

// Get the most recent conversation or create a new one
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const { user } = await requireTeamMember(teamId);
    const userId = user.id;

    // Get most recent conversation for this team and user
    const conversations = await getChatConversations(teamId, userId);

    if (conversations.length > 0) {
      // Return the most recent conversation with messages
      const conversationId = conversations[0].id;
      const conversation = await getChatConversation(conversationId);
      return NextResponse.json(conversation || null);
    }

    // No conversation exists, return null
    return NextResponse.json(null);
  } catch (error) {
    return handleRouteError(error);
  }
}

// Create a new conversation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const { user } = await requireTeamMember(teamId);
    const userId = user.id;

    const conversation = await createChatConversation({
      teamId,
      userId,
    });

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
