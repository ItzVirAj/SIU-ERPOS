import { NextRequest, NextResponse } from "next/server";
import { getUserId, getUser, verifyTeamMembership } from "@/lib/auth-server-helpers";
import { createStandupEntry, getStandupEntries } from "@/lib/api/calendar";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const userId = await getUserId();
    await verifyTeamMembership(teamId, userId);

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const date = dateParam ? new Date(dateParam) : new Date();

    const entries = await getStandupEntries(teamId, date);
    return NextResponse.json({ entries });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to get standup entries" },
      { status: error.message === "Unauthorized" ? 401 : 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const userId = await getUserId();
    const user = await getUser();
    await verifyTeamMembership(teamId, userId);

    const body = await request.json();

    if (!body.yesterday || !body.today) {
      return NextResponse.json(
        { error: "Yesterday and Today fields are required for stand-up" },
        { status: 400 }
      );
    }

    const result = await createStandupEntry(
      teamId,
      {
        yesterday: body.yesterday,
        today: body.today,
        blockers: body.blockers,
        autoCreateBlockerIssue: body.autoCreateBlockerIssue ?? true,
        projectId: body.projectId,
      },
      userId,
      user.name || "Developer",
      user.email || ""
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Failed to record standup:", error);
    return NextResponse.json(
      { error: error.message || "Failed to record standup" },
      { status: error.message === "Unauthorized" ? 401 : 500 }
    );
  }
}
