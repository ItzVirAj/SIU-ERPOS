import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireTeamAdmin, handleRouteError, HttpError } from "@/lib/authz"
import { db } from "@/lib/db"

const patchFlowSchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
}).strict()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; flowId: string }> }
) {
  try {
    const { teamId, flowId } = await params
    const { user, userId, member } = await requireTeamAdmin(teamId)

    const existing = await db.automationRule.findFirst({
      where: { id: flowId, teamId },
    })

    if (!existing) {
      throw new HttpError(404, "Flow not found")
    }

    const rawBody = await request.json()
    const { isActive, name, description } = patchFlowSchema.parse(rawBody)

    const updated = await db.automationRule.update({
      where: { id: flowId },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
      },
    })

    await db.auditLog.create({
      data: {
        teamId,
        userId,
        userName: member.userName || user.name || "Admin",
        userEmail: member.userEmail || user.email || "admin@sketchitup.internal",
        action: "UPDATE",
        entityType: "AUTOMATION",
        entityId: flowId,
        entityTitle: updated.name,
        details: { isActive: updated.isActive },
      },
    })

    return NextResponse.json({ flow: updated })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; flowId: string }> }
) {
  try {
    const { teamId, flowId } = await params
    const { user, userId, member } = await requireTeamAdmin(teamId)

    const existing = await db.automationRule.findFirst({
      where: { id: flowId, teamId },
    })

    if (!existing) {
      throw new HttpError(404, "Flow not found")
    }

    await db.automationRule.delete({
      where: { id: flowId },
    })

    await db.auditLog.create({
      data: {
        teamId,
        userId,
        userName: member.userName || user.name || "Admin",
        userEmail: member.userEmail || user.email || "admin@sketchitup.internal",
        action: "DELETE",
        entityType: "AUTOMATION",
        entityId: flowId,
        entityTitle: existing.name,
        details: { triggerType: existing.triggerType },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
