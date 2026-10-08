import { NextRequest, NextResponse } from "next/server";
import { getUserId, verifyTeamMembership } from "@/lib/auth-server-helpers";
import { convertLeadToClientAndProject } from "@/lib/api/crm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; leadId: string }> }
) {
  try {
    const { teamId, leadId } = await params;
    const userId = await getUserId();
    await verifyTeamMembership(teamId, userId);

    const body = await request.json().catch(() => ({}));
    const result = await convertLeadToClientAndProject(teamId, leadId, {
      clientName: body.clientName,
      projectKey: body.projectKey,
      projectName: body.projectName,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Failed to convert lead:", error);
    return NextResponse.json(
      { error: error.message || "Failed to convert lead" },
      { status: error.message === "Unauthorized" ? 401 : 500 }
    );
  }
}
