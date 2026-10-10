import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { handleRouteError, HttpError } from "@/lib/authz"
import { requireTeamAccess } from "@/lib/route-guards"
import { AppModule, AccessLevel } from "@/lib/prisma-client"
import { db } from "@/lib/db"

const patchWebhookSchema = z.object({
  url: z.string().url().optional(),
  description: z.string().max(500).nullable().optional(),
  events: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
}).strict()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; webhookId: string }> }
) {
  try {
    const { teamId, webhookId } = await params
    const { user, userId, member } = await requireTeamAccess(teamId, {
      module: AppModule.DEV_SETTINGS,
      level: AccessLevel.WRITE,
    })

    const existing = await db.webhookEndpoint.findFirst({
      where: { id: webhookId, teamId },
    })

    if (!existing) {
      throw new HttpError(404, "Webhook not found")
    }

    const rawBody = await request.json()
    const validatedBody = patchWebhookSchema.parse(rawBody)

    const updated = await db.webhookEndpoint.update({
      where: { id: webhookId },
      data: {
        ...(validatedBody.url && { url: validatedBody.url.trim() }),
        ...(validatedBody.description !== undefined && {
          description: validatedBody.description?.trim() || null,
        }),
        ...(validatedBody.events && { events: validatedBody.events }),
        ...(validatedBody.isActive !== undefined && { isActive: validatedBody.isActive }),
      },
    })

    await db.auditLog.create({
      data: {
        teamId,
        userId,
        userName: member.userName || user.name || "Admin",
        userEmail: member.userEmail || user.email || "admin@sketchitup.internal",
        action: "UPDATE",
        entityType: "WEBHOOK",
        entityId: webhookId,
        entityTitle: updated.url,
        details: { url: updated.url, isActive: updated.isActive },
      },
    })

    const { secret, ...safeWebhook } = updated
    return NextResponse.json({ webhook: safeWebhook })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; webhookId: string }> }
) {
  try {
    const { teamId, webhookId } = await params
    const { user, userId, member } = await requireTeamAccess(teamId, {
      module: AppModule.DEV_SETTINGS,
      level: AccessLevel.MANAGE,
    })

    const existing = await db.webhookEndpoint.findFirst({
      where: { id: webhookId, teamId },
    })

    if (!existing) {
      throw new HttpError(404, "Webhook not found")
    }

    await db.webhookEndpoint.delete({
      where: { id: webhookId },
    })

    await db.auditLog.create({
      data: {
        teamId,
        userId,
        userName: member.userName || user.name || "Admin",
        userEmail: member.userEmail || user.email || "admin@sketchitup.internal",
        action: "DELETE",
        entityType: "WEBHOOK",
        entityId: webhookId,
        entityTitle: existing.url,
        details: { url: existing.url },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
