import { NextRequest, NextResponse } from "next/server";
import { requireTeamMember, handleRouteError } from "@/lib/authz";
import { getClients } from "@/lib/api/crm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    await requireTeamMember(teamId);

    const clients = await getClients(teamId);
    return NextResponse.json({ clients, count: clients.length });
  } catch (error) {
    return handleRouteError(error);
  }
}
