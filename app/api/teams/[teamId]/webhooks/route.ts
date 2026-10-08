import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/auth-server-helpers"
import { db } from "@/lib/db"
import crypto from "crypto"

// GET /api/teams/[teamId]/webhooks - List webhook endpoints
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const userId = await getUserId()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const membership = await db.teamMember.findFirst({
      where: { teamId, userId },
    })

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const webhooks = await db.webhookEndpoint.findMany({
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

    return NextResponse.json({ webhooks })
  } catch (error) {
    console.error("Error fetching webhooks:", error)
    return NextResponse.json({ error: "Failed to fetch webhooks" }, { status: 500 })
  }
}

// POST /api/teams/[teamId]/webhooks - Register a new webhook endpoint
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
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
    const { url, description, events = ["*"] } = body

    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      return NextResponse.json({ error: "Valid HTTP/HTTPS URL is required" }, { status: 400 })
    }

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
        userName: membership.userName || "Admin",
        userEmail: membership.userEmail || "admin@sketchitup.internal",
        action: "CREATE",
        entityType: "WEBHOOK",
        entityId: webhook.id,
        entityTitle: webhook.url,
        details: { url: webhook.url, events },
      },
    })

    return NextResponse.json({ webhook })
  } catch (error) {
    console.error("Error creating webhook endpoint:", error)
    return NextResponse.json({ error: "Failed to create webhook" }, { status: 500 })
  }
}
