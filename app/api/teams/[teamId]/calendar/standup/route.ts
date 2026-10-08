import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTeamMember, handleRouteError } from "@/lib/authz";
import { createStandupEntry, getStandupEntries } from "@/lib/api/calendar";

const createStandupSchema = z.object({
  yesterday: z.string().min(1),
  today: z.string().min(1),
  blockers: z.string().nullable().optional(),
  autoCreateBlockerIssue: z.boolean().optional(),
  projectId: z.string().nullable().optional(),
}).strict();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    await requireTeamMember(teamId);

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const date = dateParam ? new Date(dateParam) : new Date();

    const entries = await getStandupEntries(teamId, date);
    return NextResponse.json({ entries });
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
    const { user } = await requireTeamMember(teamId);
    const userId = user.id;

    const rawBody = await request.json();
    const body = createStandupSchema.parse(rawBody);

    const result = await createStandupEntry(
      teamId,
      {
        yesterday: body.yesterday.trim(),
        today: body.today.trim(),
        blockers: body.blockers?.trim() || undefined,
        autoCreateBlockerIssue: body.autoCreateBlockerIssue ?? true,
        projectId: body.projectId || undefined,
      },
      userId,
      user.name || "Developer",
      user.email || ""
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
