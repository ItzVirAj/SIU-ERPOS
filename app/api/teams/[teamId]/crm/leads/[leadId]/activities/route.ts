import { NextRequest, NextResponse } from "next/server";
import { getUserId, getUser, verifyTeamMembership } from "@/lib/auth-server-helpers";
import { addLeadActivity, getLeadById } from "@/lib/api/crm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; leadId: string }> }
) {
  try {
    const { teamId, leadId } = await params;
    const userId = await getUserId();
    const user = await getUser();
    await verifyTeamMembership(teamId, userId);

    const lead = await getLeadById(teamId, leadId);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const body = await request.json();

    if (!body.content || !body.content.trim()) {
      return NextResponse.json(
        { error: "Activity content or notes are required" },
        { status: 400 }
      );
    }

    const activity = await addLeadActivity(leadId, {
      type: body.type || "note",
      content: body.content.trim(),
      performedBy: user.name || "Sales Member",
      newNextFollowUpDate: body.nextFollowUpDate,
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to log activity" },
      { status: error.message === "Unauthorized" ? 401 : 500 }
    );
  }
}
