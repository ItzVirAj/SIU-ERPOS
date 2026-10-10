import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from "next/server";
import { handleRouteError } from "@/lib/authz";
import { getClients } from "@/lib/api/crm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    await requireTeamAccess(teamId, { module: AppModule.CRM, level: AccessLevel.VIEW });

    const clients = await getClients(teamId);
    return NextResponse.json({ clients, count: clients.length });
  } catch (error) {
    return handleRouteError(error);
  }
}
