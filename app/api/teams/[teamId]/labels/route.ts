import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLabels, createLabel, updateLabel, deleteLabel } from "@/lib/api/labels";
import { CreateLabelData } from "@/lib/types";
import { handleRouteError, HttpError } from "@/lib/authz";
import { db } from "@/lib/db";

const createLabelSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().max(20).optional(),
}).strict();

const updateLabelSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(50).optional(),
  color: z.string().max(20).optional(),
}).strict();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    await requireTeamAccess(teamId, { module: AppModule.WORK, level: AccessLevel.VIEW });

    const labels = await getLabels(teamId);
    return NextResponse.json(labels);
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
    await requireTeamAccess(teamId, { module: AppModule.WORK, level: AccessLevel.MANAGE });

    const rawBody = await request.json();
    const body = createLabelSchema.parse(rawBody);

    const labelData: CreateLabelData = {
      name: body.name.trim(),
      color: body.color || "#64748b",
    };

    const label = await createLabel(teamId, labelData);
    return NextResponse.json(label, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    await requireTeamAccess(teamId, { module: AppModule.WORK, level: AccessLevel.MANAGE });

    const rawBody = await request.json();
    const body = updateLabelSchema.parse(rawBody);

    const labelId = body.id || request.nextUrl.searchParams.get("id");
    if (!labelId) {
      throw new HttpError(400, "Label ID is required");
    }

    const existing = await db.label.findFirst({
      where: { id: labelId, teamId },
    });
    if (!existing) {
      throw new HttpError(404, "Label not found");
    }

    const updateData: Partial<CreateLabelData> = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.color !== undefined) updateData.color = body.color;

    const label = await updateLabel(teamId, labelId, updateData);
    return NextResponse.json(label);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    await requireTeamAccess(teamId, { module: AppModule.WORK, level: AccessLevel.MANAGE });

    const labelId = request.nextUrl.searchParams.get("id");
    if (!labelId) {
      throw new HttpError(400, "Label ID is required");
    }

    const existing = await db.label.findFirst({
      where: { id: labelId, teamId },
    });
    if (!existing) {
      throw new HttpError(404, "Label not found");
    }

    await deleteLabel(teamId, labelId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
