import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/auth-server-helpers"
import { db } from "@/lib/db"

// PATCH /api/teams/[teamId]/webhooks/[webhookId] - Update webhook
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; webhookId: string }> }
) {
  try {
    const { teamId, webhookId } = await params
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
    const { url, description, events, isActive } = body

    const updated = await db.webhookEndpoint.update({
      where: { id: webhookId, teamId },
      data: {
        ...(url && { url: url.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(events && { events }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    })

    await db.auditLog.create({
      data: {
        teamId,
        userId,
        userName: membership.userName || "Admin",
        userEmail: membership.userEmail || "admin@sketchitup.internal",
        action: "UPDATE",
        entityType: "WEBHOOK",
        entityId: webhookId,
        entityTitle: updated.url,
        details: { url: updated.url, isActive: updated.isActive },
      },
    })

    return NextResponse.json({ webhook: updated })
  } catch (error) {
    console.error("Error updating webhook:", error)
    return NextResponse.json({ error: "Failed to update webhook" }, { status: 500 })
  }
}

// DELETE /api/teams/[teamId]/webhooks/[webhookId] - Delete webhook
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; webhookId: string }> }
) {
  try {
    const { teamId, webhookId } = await params
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

    const existing = await db.webhookEndpoint.findFirst({
      where: { id: webhookId, teamId },
    })

    if (!existing) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 })
    }

    await db.webhookEndpoint.delete({
      where: { id: webhookId },
    })

    await db.auditLog.create({
      data: {
        teamId,
        userId,
        userName: membership.userName || "Admin",
        userEmail: membership.userEmail || "admin@sketchitup.internal",
        action: "DELETE",
        entityType: "WEBHOOK",
        entityId: webhookId,
        entityTitle: existing.url,
        details: { url: existing.url },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting webhook:", error)
    return NextResponse.json({ error: "Failed to delete webhook" }, { status: 500 })
  }
}
