import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError, HttpError } from "@/lib/authz";
import { convertActionItemToIssue, getEventById } from "@/lib/api/calendar";
import { db } from "@/lib/db";

const convertSchema = z.object({
  projectId: z.string().optional(),
}).strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; eventId: string; actionItemId: string }> }
) {
  try {
    const { teamId, eventId, actionItemId } = await params;
    const { user } = await requireTeamAccess(teamId, [
      { module: AppModule.COLLAB, level: AccessLevel.WRITE },
      { module: AppModule.WORK, level: AccessLevel.WRITE },
    ]);

    const event = await getEventById(teamId, eventId);
    if (!event) {
      throw new HttpError(404, "Event not found");
    }

    const actionItem = await db.meetingActionItem.findFirst({
      where: {
        id: actionItemId,
        meetingNote: {
          eventId,
        },
      },
    });
    if (!actionItem) {
      throw new HttpError(404, "Action item not found in this event");
    }

    const rawBody = await request.json().catch(() => ({}));
    const body = convertSchema.parse(rawBody);

    const result = await convertActionItemToIssue(
      teamId,
      actionItemId,
      user.id,
      user.name || "Team Member",
      body.projectId
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
