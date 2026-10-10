import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import crypto from "crypto"
import { handleRouteError } from "@/lib/authz"
import { requireTeamAccess } from "@/lib/route-guards"
import { AppModule, AccessLevel } from "@/lib/prisma-client"
import { db } from "@/lib/db"

const createWebhookSchema = z.object({
  url: z.string().url(),
  description: z.string().max(500).nullable().optional(),
  events: z.array(z.string()).default(["*"]),
}).strict()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamAccess(teamId, {
      module: AppModule.DEV_SETTINGS,
      level: AccessLevel.VIEW,
    })

    const rawWebhooks = await db.webhookEndpoint.findMany({
      where: { teamId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { deliveries: true } },
        deliveries: {
          take: 5,
          orderBy: { deliveredAt: "desc" },
        },
      },
    })

    // Never return webhook secrets on read
    const webhooks = rawWebhooks.map(({ secret, ...rest }) => rest)

    return NextResponse.json({ webhooks })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const { user, userId, member } = await requireTeamAccess(teamId, {
      module: AppModule.DEV_SETTINGS,
      level: AccessLevel.WRITE,
    })

    const rawBody = await request.json()
    const { url, description, events } = createWebhookSchema.parse(rawBody)

    const secret = `whsec_${crypto.randomBytes(20).toString("hex")}`

    const webhook = await db.webhookEndpoint.create({
      data: {
        teamId,
        url: url.trim(),
        description: description?.trim() || null,
        secret,
        events,
        isActive: true,
        lastStatus: "active",
      },
    })

    await db.auditLog.create({
      data: {
        teamId,
        userId,
        userName: member.userName || user.name || "Admin",
        userEmail: member.userEmail || user.email || "admin@sketchitup.internal",
        action: "CREATE",
        entityType: "WEBHOOK",
        entityId: webhook.id,
        entityTitle: webhook.url,
        details: { url: webhook.url, events },
      },
    })

    return NextResponse.json({ webhook }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
