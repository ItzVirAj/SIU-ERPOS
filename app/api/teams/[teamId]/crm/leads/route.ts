import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTeamMember, handleRouteError } from "@/lib/authz";
import { getLeads, createLead } from "@/lib/api/crm";

const createLeadSchema = z.object({
  title: z.string().min(1).max(200),
  companyName: z.string().nullable().optional(),
  contactName: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  phone: z.string().nullable().optional(),
  industryVertical: z.string().nullable().optional(),
  source: z.string().default("website"),
  campaign: z.string().nullable().optional(),
  estimatedValue: z.number().nonnegative().optional(),
  currency: z.string().default("INR"),
  expectedCloseDate: z.union([z.string(), z.date()]).nullable().optional(),
  requirementSummary: z.string().nullable().optional(),
  temperature: z.enum(["hot", "warm", "cold"]).default("warm"),
  ownerId: z.string().nullable().optional(),
  ownerName: z.string().nullable().optional(),
  nextFollowUpDate: z.union([z.string(), z.date()]).nullable().optional(),
  stageId: z.string().optional(),
}).strict()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    await requireTeamMember(teamId);

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
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const { user, userId } = await requireTeamMember(teamId, "developer");

    const rawBody = await request.json();
    const body = createLeadSchema.parse(rawBody);

    const lead = await createLead(
      teamId,
      {
        title: body.title.trim(),
        companyName: body.companyName?.trim() || undefined,
        contactName: body.contactName?.trim() || undefined,
        email: body.email ? body.email.trim() : undefined,
        phone: body.phone?.trim() || undefined,
        industryVertical: body.industryVertical?.trim() || undefined,
        source: body.source,
        campaign: body.campaign?.trim() || undefined,
        estimatedValue: body.estimatedValue,
        currency: body.currency,
        expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : undefined,
        requirementSummary: body.requirementSummary?.trim() || undefined,
        temperature: body.temperature,
        ownerId: body.ownerId || userId,
        ownerName: body.ownerName || user.name || "Sales Lead",
        nextFollowUpDate: body.nextFollowUpDate ? new Date(body.nextFollowUpDate) : undefined,
        stageId: body.stageId,
      },
      userId,
      user.name || undefined
    );

    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
