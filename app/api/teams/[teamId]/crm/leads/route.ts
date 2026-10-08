import { NextRequest, NextResponse } from "next/server";
import { getUserId, getUser, verifyTeamMembership } from "@/lib/auth-server-helpers";
import { getLeads, createLead } from "@/lib/api/crm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const userId = await getUserId();
    await verifyTeamMembership(teamId, userId);

    const { searchParams } = new URL(request.url);
    const stageId = searchParams.get("stageId") || undefined;
    const temperature = searchParams.get("temperature") || undefined;
    const source = searchParams.get("source") || undefined;
    const overdueFollowUpsOnly = searchParams.get("overdue") === "true";
    const search = searchParams.get("search") || undefined;

    const leads = await getLeads(teamId, {
      stageId,
      temperature,
      source,
      overdueFollowUpsOnly,
      search,
    });

    return NextResponse.json({ leads, count: leads.length });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch leads" },
      { status: error.message === "Unauthorized" ? 401 : 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const userId = await getUserId();
    const user = await getUser();
    await verifyTeamMembership(teamId, userId);

    const body = await request.json();

    if (!body.title || !body.title.trim()) {
      return NextResponse.json(
        { error: "Lead title or company name is required" },
        { status: 400 }
      );
    }

    const lead = await createLead(
      teamId,
      {
        title: body.title.trim(),
        companyName: body.companyName?.trim(),
        contactName: body.contactName?.trim(),
        email: body.email?.trim(),
        phone: body.phone?.trim(),
        industryVertical: body.industryVertical?.trim(),
        source: body.source || "website",
        campaign: body.campaign?.trim(),
        estimatedValue: body.estimatedValue ? Number(body.estimatedValue) : undefined,
        currency: body.currency || "INR",
        expectedCloseDate: body.expectedCloseDate,
        requirementSummary: body.requirementSummary?.trim(),
        temperature: body.temperature || "warm",
        ownerId: body.ownerId || userId,
        ownerName: body.ownerName || user.name || "Sales Lead",
        nextFollowUpDate: body.nextFollowUpDate,
        stageId: body.stageId,
      },
      userId,
      user.name || undefined
    );

    return NextResponse.json(lead, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create lead:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create lead" },
      { status: error.message === "Unauthorized" ? 401 : 500 }
    );
  }
}
