import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz";
import { getOrCreateDefaultPipeline } from "@/lib/api/crm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    await requireTeamAccess(teamId, { module: AppModule.CRM, level: AccessLevel.VIEW });

    const pipeline = await getOrCreateDefaultPipeline(teamId);
    return NextResponse.json(pipeline);
  } catch (error) {
    return handleRouteError(error);
  }
}
