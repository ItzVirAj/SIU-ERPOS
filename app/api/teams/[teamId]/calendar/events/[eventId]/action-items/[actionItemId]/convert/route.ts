import { NextRequest, NextResponse } from "next/server";
import { getUserId, getUser, verifyTeamMembership } from "@/lib/auth-server-helpers";
import { convertActionItemToIssue } from "@/lib/api/calendar";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; eventId: string; actionItemId: string }> }
) {
  try {
    const { teamId, actionItemId } = await params;
    const userId = await getUserId();
    const user = await getUser();
    await verifyTeamMembership(teamId, userId);

    const body = await request.json().catch(() => ({}));
    const result = await convertActionItemToIssue(
      teamId,
      actionItemId,
      userId,
      user.name || "Team Member",
      body.projectId
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Failed to convert action item to issue:", error);
    return NextResponse.json(
      { error: error.message || "Failed to convert action item" },
      { status: error.message === "Unauthorized" ? 401 : 500 }
    );
  }
}
