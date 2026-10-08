import { NextRequest, NextResponse } from "next/server";
import { getUserId, verifyTeamMembership } from "@/lib/auth-server-helpers";
import { getClients } from "@/lib/api/crm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const userId = await getUserId();
    await verifyTeamMembership(teamId, userId);

    const clients = await getClients(teamId);
    return NextResponse.json({ clients, count: clients.length });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch clients" },
      { status: error.message === "Unauthorized" ? 401 : 500 }
    );
  }
}
