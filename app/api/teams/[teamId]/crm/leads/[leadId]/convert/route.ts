import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError, HttpError } from "@/lib/authz";
import { convertLeadToClientAndProject, getLeadById } from "@/lib/api/crm";

const convertLeadSchema = z.object({
  clientName: z.string().optional(),
  projectKey: z.string().optional(),
  projectName: z.string().optional(),
}).strict()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; leadId: string }> }
) {
  try {
    const { teamId, leadId } = await params;
    await requireTeamAccess(teamId, { module: AppModule.CRM, level: AccessLevel.WRITE });

    const lead = await getLeadById(teamId, leadId);
    if (!lead) {
      throw new HttpError(404, "Lead not found");
    }

    const rawBody = await request.json().catch(() => ({}));
    const body = convertLeadSchema.parse(rawBody);

    const result = await convertLeadToClientAndProject(teamId, leadId, {
      clientName: body.clientName,
      projectKey: body.projectKey,
      projectName: body.projectName,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
