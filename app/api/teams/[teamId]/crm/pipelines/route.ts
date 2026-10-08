import { NextRequest, NextResponse } from "next/server";
import { getUserId, verifyTeamMembership } from "@/lib/auth-server-helpers";
import { getOrCreateDefaultPipeline } from "@/lib/api/crm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const userId = await getUserId();
    await verifyTeamMembership(teamId, userId);

    const pipeline = await getOrCreateDefaultPipeline(teamId);
    return NextResponse.json(pipeline);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch CRM pipelines" },
      { status: error.message === "Unauthorized" ? 401 : 500 }
    );
  }
}
