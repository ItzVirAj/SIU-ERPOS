import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTeamMember, handleRouteError, HttpError } from "@/lib/authz";
import { getEventById, updateEvent, deleteEvent } from "@/lib/api/calendar";

const updateEventSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  type: z.string().optional(),
  startTime: z.union([z.string(), z.date()]).optional(),
  endTime: z.union([z.string(), z.date()]).optional(),
  allDay: z.boolean().optional(),
  location: z.string().nullable().optional(),
  meetUrl: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  recurrence: z.string().optional(),
  attendees: z.array(z.string()).optional(),
}).strict();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; eventId: string }> }
) {
  try {
    const { teamId, eventId } = await params;
    await requireTeamMember(teamId);

    const event = await getEventById(teamId, eventId);
    if (!event) {
      throw new HttpError(404, "Event not found");
    }

    return NextResponse.json(event);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; eventId: string }> }
) {
  try {
    const { teamId, eventId } = await params;
    await requireTeamMember(teamId, "developer");

    const existing = await getEventById(teamId, eventId);
    if (!existing) {
      throw new HttpError(404, "Event not found");
    }

    const rawBody = await request.json();
    const body = updateEventSchema.parse(rawBody);

    const updateData: any = { ...body };
    if (body.startTime) updateData.startTime = new Date(body.startTime);
    if (body.endTime) updateData.endTime = new Date(body.endTime);

    const updated = await updateEvent(teamId, eventId, updateData);
    return NextResponse.json(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; eventId: string }> }
) {
  try {
    const { teamId, eventId } = await params;
    await requireTeamMember(teamId, "developer");

    const existing = await getEventById(teamId, eventId);
    if (!existing) {
      throw new HttpError(404, "Event not found");
    }

    await deleteEvent(teamId, eventId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
