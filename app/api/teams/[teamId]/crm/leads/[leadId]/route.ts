import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from "next/server";
import { handleRouteError, HttpError } from "@/lib/authz";
import { getLeadById, updateLead, deleteLead } from "@/lib/api/crm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; leadId: string }> }
) {
  try {
    const { teamId, leadId } = await params;
    await requireTeamAccess(teamId, { module: AppModule.CRM, level: AccessLevel.VIEW });

    const lead = await getLeadById(teamId, leadId);
    if (!lead) {
      throw new HttpError(404, "Lead not found");
    }

    return NextResponse.json(lead);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; leadId: string }> }
) {
  try {
    const { teamId, leadId } = await params;
    const { user } = await requireTeamAccess(teamId, { module: AppModule.CRM, level: AccessLevel.WRITE });

    const existing = await getLeadById(teamId, leadId);
    if (!existing) {
      throw new HttpError(404, "Lead not found");
    }

    const body = await request.json();
    const updated = await updateLead(teamId, leadId, body, user.name || "User");

    return NextResponse.json(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; leadId: string }> }
) {
  try {
    const { teamId, leadId } = await params;
    await requireTeamAccess(teamId, { module: AppModule.CRM, level: AccessLevel.MANAGE });

    const existing = await getLeadById(teamId, leadId);
    if (!existing) {
      throw new HttpError(404, "Lead not found");
    }

    await deleteLead(teamId, leadId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
