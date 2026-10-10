import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { handleRouteError, HttpError } from "@/lib/authz"
import { requireTeamAccess } from "@/lib/route-guards"
import { AppModule, AccessLevel } from "@/lib/prisma-client"
import { db } from "@/lib/db"

const patchApiKeySchema = z.object({
  isActive: z.boolean(),
}).strict()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; keyId: string }> }
) {
  try {
    const { teamId, keyId } = await params
    const { user, userId, member } = await requireTeamAccess(teamId, {
      module: AppModule.DEV_SETTINGS,
      level: AccessLevel.WRITE,
    })

    const existingKey = await db.developerApiKey.findFirst({
      where: { id: keyId, teamId },
    })

    if (!existingKey) {
      throw new HttpError(404, "API key not found")
    }

    const rawBody = await request.json()
    const { isActive } = patchApiKeySchema.parse(rawBody)

    const updated = await db.developerApiKey.update({
      where: { id: keyId },
      data: {
        isActive,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        createdBy: true,
        createdByName: true,
        lastUsedAt: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      },
    })

    await db.auditLog.create({
      data: {
        teamId,
        userId,
        userName: member.userName || user.name || "Admin",
        userEmail: member.userEmail || user.email || "admin@sketchitup.internal",
        action: isActive ? "ENABLE" : "DISABLE",
        entityType: "API_KEY",
        entityId: keyId,
        entityTitle: updated.name,
        details: { keyName: updated.name, isActive },
      },
    })

    return NextResponse.json({ apiKey: updated })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; keyId: string }> }
) {
  try {
    const { teamId, keyId } = await params
    const { user, userId, member } = await requireTeamAccess(teamId, {
      module: AppModule.DEV_SETTINGS,
      level: AccessLevel.MANAGE,
    })

    const existingKey = await db.developerApiKey.findFirst({
      where: { id: keyId, teamId },
    })

    if (!existingKey) {
      throw new HttpError(404, "API key not found")
    }

    await db.developerApiKey.delete({
      where: { id: keyId },
    })

    await db.auditLog.create({
      data: {
        teamId,
        userId,
        userName: member.userName || user.name || "Admin",
        userEmail: member.userEmail || user.email || "admin@sketchitup.internal",
        action: "REVOKE",
        entityType: "API_KEY",
        entityId: keyId,
        entityTitle: existingKey.name,
        details: { keyName: existingKey.name, keyPrefix: existingKey.keyPrefix },
      },
    })

    return NextResponse.json({ success: true, message: "API key revoked successfully" })
  } catch (error) {
    return handleRouteError(error)
  }
}
