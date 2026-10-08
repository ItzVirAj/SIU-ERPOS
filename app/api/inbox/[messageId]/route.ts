import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, handleRouteError, HttpError } from "@/lib/authz";
import { db } from "@/lib/db";

const updateMessageSchema = z.object({
  read: z.boolean().optional(),
  starred: z.boolean().optional(),
  archived: z.boolean().optional(),
}).strict();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const session = await requireSession();
    const { messageId } = await params;
    const userId = session.user.id;

    // Verify ownership
    const message = await db.inboxMessage.findFirst({
      where: { id: messageId, userId },
    });

    if (!message) {
      throw new HttpError(404, "Message not found");
    }

    const rawBody = await request.json();
    const body = updateMessageSchema.parse(rawBody);

    const updated = await db.inboxMessage.update({
      where: { id: messageId },
      data: body,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const session = await requireSession();
    const { messageId } = await params;
    const userId = session.user.id;

    const message = await db.inboxMessage.findFirst({
      where: { id: messageId, userId },
    });

    if (!message) {
      throw new HttpError(404, "Message not found");
    }

    await db.inboxMessage.delete({
      where: { id: messageId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
