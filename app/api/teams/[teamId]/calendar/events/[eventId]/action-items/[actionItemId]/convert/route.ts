import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTeamMember, handleRouteError, HttpError } from "@/lib/authz";
import { convertActionItemToIssue, getEventById } from "@/lib/api/calendar";

const convertSchema = z.object({
  projectId: z.string().optional(),
}).strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; eventId: string; actionItemId: string }> }
) {
  try {
    const { teamId, eventId, actionItemId } = await params;
    const { user } = await requireTeamMember(teamId, "developer");

    const event = await getEventById(teamId, eventId);
    if (!event) {
      throw new HttpError(404, "Event not found");
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
