import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError, HttpError } from "@/lib/authz";
import { addLeadActivity, getLeadById } from "@/lib/api/crm";

const addActivitySchema = z.object({
  type: z.enum(["email", "note", "call", "whatsapp", "meeting"]).default("note"),
  content: z.string().min(1),
  nextFollowUpDate: z.union([z.string(), z.date()]).optional(),
}).strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; leadId: string }> }
) {
  try {
    const { teamId, leadId } = await params;
    const { user } = await requireTeamAccess(teamId, { module: AppModule.CRM, level: AccessLevel.WRITE });

    const lead = await getLeadById(teamId, leadId);
    if (!lead) {
      throw new HttpError(404, "Lead not found");
    }

    const rawBody = await request.json();
    const body = addActivitySchema.parse(rawBody);

    const activity = await addLeadActivity(leadId, {
      type: body.type,
      content: body.content.trim(),
      performedBy: user.name || "Sales Member",
      newNextFollowUpDate: body.nextFollowUpDate ? new Date(body.nextFollowUpDate) : undefined,
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
