import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/auth-server-helpers"
import { db } from "@/lib/db"

// PATCH /api/teams/[teamId]/api-keys/[keyId] - Toggle active status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; keyId: string }> }
) {
  try {
    const { teamId, keyId } = await params
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
    const { isActive } = body

    const updated = await db.developerApiKey.update({
      where: { id: keyId, teamId },
      data: {
        isActive: Boolean(isActive),
      },
    })

    await db.auditLog.create({
      data: {
        teamId,
        userId,
        userName: membership.userName || "Admin",
        userEmail: membership.userEmail || "admin@sketchitup.internal",
        action: isActive ? "ENABLE" : "DISABLE",
        entityType: "API_KEY",
        entityId: keyId,
        entityTitle: updated.name,
        details: { keyName: updated.name, isActive },
      },
    })

    return NextResponse.json({ apiKey: updated })
  } catch (error) {
    console.error("Error updating API key:", error)
    return NextResponse.json({ error: "Failed to update API key" }, { status: 500 })
  }
}

// DELETE /api/teams/[teamId]/api-keys/[keyId] - Revoke & delete API key
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; keyId: string }> }
) {
  try {
    const { teamId, keyId } = await params
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

    const existingKey = await db.developerApiKey.findFirst({
      where: { id: keyId, teamId },
    })

    if (!existingKey) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 })
    }

    await db.developerApiKey.delete({
      where: { id: keyId },
    })

    await db.auditLog.create({
      data: {
        teamId,
        userId,
        userName: membership.userName || "Admin",
        userEmail: membership.userEmail || "admin@sketchitup.internal",
        action: "REVOKE",
        entityType: "API_KEY",
        entityId: keyId,
        entityTitle: existingKey.name,
        details: { keyName: existingKey.name, keyPrefix: existingKey.keyPrefix },
      },
    })

    return NextResponse.json({ success: true, message: "API key revoked successfully" })
  } catch (error) {
    console.error("Error revoking API key:", error)
    return NextResponse.json({ error: "Failed to revoke API key" }, { status: 500 })
  }
}
