import { NextRequest, NextResponse } from "next/server";
import { getUserId, verifyTeamMembership } from "@/lib/auth-server-helpers";
import { upsertMeetingNote, getEventById } from "@/lib/api/calendar";

export async function POST(
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

    const body = await request.json();
    const updatedNote = await upsertMeetingNote(eventId, {
      content: body.content,
      summary: body.summary,
      decisions: body.decisions,
      rawTranscript: body.rawTranscript,
      followUpEmailDraft: body.followUpEmailDraft,
      actionItems: body.actionItems,
    });

    return NextResponse.json(updatedNote);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to save meeting notes" },
      { status: error.message === "Unauthorized" ? 401 : 500 }
    );
  }
}
