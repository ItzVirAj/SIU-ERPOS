import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/auth-server-helpers"
import { db } from "@/lib/db"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; flowId: string }> }
) {
  try {
    const { teamId, flowId } = await params
    const userId = await getUserId()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const membership = await db.teamMember.findFirst({
      where: {
        teamId,
        userId,
        role: { in: ["admin", "developer"] },
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const body = await request.json()
    const { isActive, name, description } = body

    const updated = await db.automationRule.update({
      where: { id: flowId, teamId },
      data: {
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
      },
    })

    await db.auditLog.create({
      data: {
        teamId,
        userId,
        userName: membership.userName || "Admin",
        userEmail: membership.userEmail || "admin@sketchitup.internal",
        action: "UPDATE",
        entityType: "AUTOMATION",
        entityId: flowId,
        entityTitle: updated.name,
        details: { isActive: updated.isActive },
      },
    })

    return NextResponse.json({ flow: updated })
  } catch (error) {
    console.error("Error updating flow:", error)
    return NextResponse.json({ error: "Failed to update flow" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; flowId: string }> }
) {
  try {
    const { teamId, flowId } = await params
    const userId = await getUserId()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const membership = await db.teamMember.findFirst({
      where: {
        teamId,
        userId,
        role: { in: ["admin", "developer"] },
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const existing = await db.automationRule.findFirst({
      where: { id: flowId, teamId },
    })

    if (!existing) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 })
    }

    await db.automationRule.delete({
      where: { id: flowId },
    })

    await db.auditLog.create({
      data: {
        teamId,
        userId,
        userName: membership.userName || "Admin",
        userEmail: membership.userEmail || "admin@sketchitup.internal",
        action: "DELETE",
        entityType: "AUTOMATION",
        entityId: flowId,
        entityTitle: existing.name,
        details: { triggerType: existing.triggerType },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting flow:", error)
    return NextResponse.json({ error: "Failed to delete flow" }, { status: 500 })
  }
}
