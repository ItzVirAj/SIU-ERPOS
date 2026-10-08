import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/auth-server-helpers"
import { db } from "@/lib/db"

// POST /api/teams/[teamId]/webhooks/[webhookId]/ping - Send a test ping delivery
export async function POST(
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
      where: { teamId, userId },
    })

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const webhook = await db.webhookEndpoint.findFirst({
      where: { id: webhookId, teamId },
    })

    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 })
    }

    // Prepare simulated ping delivery
    const payload = {
      event: "test.ping",
      timestamp: new Date().toISOString(),
      teamId,
      endpointId: webhook.id,
      triggeredBy: membership.userName || membership.userEmail || "User",
      environment: process.env.NODE_ENV || "development",
    }

    const delivery = await db.webhookDelivery.create({
      data: {
        endpointId: webhook.id,
        event: "test.ping",
        statusCode: 200,
        payload,
        response: JSON.stringify({
          status: "acknowledged",
          message: "Simulated test ping successfully dispatched and captured.",
          timestamp: new Date().toISOString(),
        }),
      },
    })

    // Update endpoint lastStatus
    await db.webhookEndpoint.update({
      where: { id: webhookId },
      data: {
        lastStatus: "active",
      },
    })

    // Create Audit Log
    await db.auditLog.create({
      data: {
        teamId,
        userId,
        userName: membership.userName || "User",
        userEmail: membership.userEmail || "user@sketchitup.internal",
        action: "TEST_PING",
        entityType: "WEBHOOK",
        entityId: webhookId,
        entityTitle: webhook.url,
        details: { deliveryId: delivery.id, event: "test.ping" },
      },
    })

    return NextResponse.json({
      success: true,
      message: "Webhook ping simulation successful",
      delivery,
    })
  } catch (error) {
    console.error("Error pinging webhook:", error)
    return NextResponse.json({ error: "Failed to ping webhook" }, { status: 500 })
  }
}
