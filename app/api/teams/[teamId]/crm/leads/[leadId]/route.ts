import { NextRequest, NextResponse } from "next/server";
import { getUserId, getUser, verifyTeamMembership } from "@/lib/auth-server-helpers";
import { getLeadById, updateLead, deleteLead } from "@/lib/api/crm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; leadId: string }> }
) {
  try {
    const { teamId, leadId } = await params;
    const userId = await getUserId();
    await verifyTeamMembership(teamId, userId);

    const lead = await getLeadById(teamId, leadId);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json(lead);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch lead" },
      { status: error.message === "Unauthorized" ? 401 : 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; leadId: string }> }
) {
  try {
    const { teamId, leadId } = await params;
    const userId = await getUserId();
    const user = await getUser();
    await verifyTeamMembership(teamId, userId);

    const body = await request.json();
    const updated = await updateLead(teamId, leadId, body, user.name || "User");

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update lead" },
      { status: error.message === "Unauthorized" ? 401 : 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; leadId: string }> }
) {
  try {
    const { teamId, leadId } = await params;
    const userId = await getUserId();
    await verifyTeamMembership(teamId, userId);

    await deleteLead(teamId, leadId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete lead" },
      { status: error.message === "Unauthorized" ? 401 : 500 }
    );
  }
}
