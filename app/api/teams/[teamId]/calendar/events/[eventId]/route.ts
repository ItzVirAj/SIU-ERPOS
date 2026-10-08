import { NextRequest, NextResponse } from "next/server";
import { getUserId, verifyTeamMembership } from "@/lib/auth-server-helpers";
import { getEventById, updateEvent, deleteEvent } from "@/lib/api/calendar";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; eventId: string }> }
) {
  try {
    const { teamId, eventId } = await params;
    const userId = await getUserId();
    await verifyTeamMembership(teamId, userId);

    const event = await getEventById(teamId, eventId);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json(event);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to get event" },
      { status: error.message === "Unauthorized" ? 401 : 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; eventId: string }> }
) {
  try {
    const { teamId, eventId } = await params;
    const userId = await getUserId();
    await verifyTeamMembership(teamId, userId);

    const body = await request.json();
    const updated = await updateEvent(teamId, eventId, body);

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update event" },
      { status: error.message === "Unauthorized" ? 401 : 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; eventId: string }> }
) {
  try {
    const { teamId, eventId } = await params;
    const userId = await getUserId();
    await verifyTeamMembership(teamId, userId);

    await deleteEvent(teamId, eventId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete event" },
      { status: error.message === "Unauthorized" ? 401 : 500 }
    );
  }
}
