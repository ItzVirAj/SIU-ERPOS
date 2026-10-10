import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError } from "@/lib/authz";
import { getChatConversations, createChatConversation } from "@/lib/api/chat";

const createConversationSchema = z.object({
  title: z.string().max(255).optional(),
}).strict();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const { user } = await requireTeamAccess(teamId, { module: AppModule.COLLAB, level: AccessLevel.VIEW });

    const conversations = await getChatConversations(teamId, user.id);
    return NextResponse.json(conversations);
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
    const { user } = await requireTeamAccess(teamId, { module: AppModule.COLLAB, level: AccessLevel.WRITE });

    const rawBody = await request.json().catch(() => ({}));
    const { title } = createConversationSchema.parse(rawBody);

    const conversation = await createChatConversation({
      teamId,
      userId: user.id,
      title: title || undefined,
    });

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
