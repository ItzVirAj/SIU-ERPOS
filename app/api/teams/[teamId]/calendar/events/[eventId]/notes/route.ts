import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError, HttpError } from "@/lib/authz";
import { upsertMeetingNote, getEventById } from "@/lib/api/calendar";

const notesSchema = z.object({
  content: z.string().optional(),
  summary: z.string().optional(),
  decisions: z.any().optional(),
  rawTranscript: z.string().optional(),
  followUpEmailDraft: z.string().optional(),
  actionItems: z.any().optional(),
}).strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; eventId: string }> }
) {
  try {
    const { teamId, eventId } = await params;
    await requireTeamAccess(teamId, { module: AppModule.COLLAB, level: AccessLevel.WRITE });

    const event = await getEventById(teamId, eventId);
    if (!event) {
      throw new HttpError(404, "Event not found");
    }

    const rawBody = await request.json();
    const body = notesSchema.parse(rawBody);

    const updatedNote = await upsertMeetingNote(eventId, {
      content: body.content,
      summary: body.summary,
      decisions: body.decisions,
      rawTranscript: body.rawTranscript,
      followUpEmailDraft: body.followUpEmailDraft,
      actionItems: body.actionItems,
    });

    return NextResponse.json(updatedNote);
  } catch (error) {
    return handleRouteError(error);
  }
}
