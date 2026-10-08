import { NextRequest, NextResponse } from "next/server";
import { getSessionOrNull } from "@/lib/auth-server-helpers";
import { db } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const session = await getSessionOrNull();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messageId } = await params;
    const userId = session.user.id;

    // Verify ownership
    const message = await db.inboxMessage.findFirst({
      where: { id: messageId, userId },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const body = await request.json();
    const updateData: any = {};

    if (typeof body.read === "boolean") updateData.read = body.read;
    if (typeof body.starred === "boolean") updateData.starred = body.starred;
    if (typeof body.archived === "boolean") updateData.archived = body.archived;

    const updated = await db.inboxMessage.update({
      where: { id: messageId },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating inbox message:", error);
    return NextResponse.json(
      { error: "Failed to update message" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const session = await getSessionOrNull();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messageId } = await params;
    const userId = session.user.id;

    const message = await db.inboxMessage.findFirst({
      where: { id: messageId, userId },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    await db.inboxMessage.delete({
      where: { id: messageId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting inbox message:", error);
    return NextResponse.json(
      { error: "Failed to delete message" },
      { status: 500 }
    );
  }
}
