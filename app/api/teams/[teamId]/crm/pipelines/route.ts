import { NextRequest, NextResponse } from "next/server";
import { requireTeamMember, handleRouteError } from "@/lib/authz";
import { getOrCreateDefaultPipeline } from "@/lib/api/crm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    await requireTeamMember(teamId);

    const pipeline = await getOrCreateDefaultPipeline(teamId);
    return NextResponse.json(pipeline);
  } catch (error) {
    return handleRouteError(error);
  }
}
