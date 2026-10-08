import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getWorkflowStates, createWorkflowState, updateWorkflowState, deleteWorkflowState } from "@/lib/api/labels";
import { CreateWorkflowStateData } from "@/lib/types";
import { requireTeamMember, requireTeamAdmin, handleRouteError, HttpError } from "@/lib/authz";
import { db } from "@/lib/db";

const workflowStateType = z.enum(["unstarted", "started", "backlog", "completed", "canceled"]);

const createStateSchema = z.object({
  name: z.string().min(1).max(50),
  type: workflowStateType,
  color: z.string().max(20).optional(),
  position: z.number().int().optional(),
}).strict();

const updateStateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(50).optional(),
  type: workflowStateType.optional(),
  color: z.string().max(20).optional(),
  position: z.number().int().optional(),
}).strict();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    await requireTeamMember(teamId);
    
    const states = await getWorkflowStates(teamId);
    return NextResponse.json(states);
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
    await requireTeamAdmin(teamId);

    const rawBody = await request.json();
    const body = createStateSchema.parse(rawBody);

    const stateData: CreateWorkflowStateData = {
      name: body.name.trim(),
      type: body.type,
      color: body.color || "#64748b",
      position: body.position || 0,
    };

    const state = await createWorkflowState(teamId, stateData);
    return NextResponse.json(state, { status: 201 });
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
    await requireTeamAdmin(teamId);

    const rawBody = await request.json();
    const body = updateStateSchema.parse(rawBody);

    const stateId = body.id || request.nextUrl.searchParams.get("id");
    if (!stateId) {
      throw new HttpError(400, "State ID is required");
    }

    const existing = await db.workflowState.findFirst({
      where: { id: stateId, teamId },
    });
    if (!existing) {
      throw new HttpError(404, "Workflow state not found");
    }

    const updateData: Partial<CreateWorkflowStateData> = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.type !== undefined) updateData.type = body.type;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.position !== undefined) updateData.position = body.position;

    const state = await updateWorkflowState(teamId, stateId, updateData);
    return NextResponse.json(state);
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
    await requireTeamAdmin(teamId);

    const stateId = request.nextUrl.searchParams.get("id");
    if (!stateId) {
      throw new HttpError(400, "State ID is required");
    }

    const existing = await db.workflowState.findFirst({
      where: { id: stateId, teamId },
    });
    if (!existing) {
      throw new HttpError(404, "Workflow state not found");
    }

    await deleteWorkflowState(teamId, stateId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
