import { NextRequest, NextResponse } from "next/server"
import { requireTeamAdmin, handleRouteError, HttpError } from "@/lib/authz"
import { db } from "@/lib/db"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; webhookId: string }> }
) {
  try {
    const { teamId, webhookId } = await params
    const { user, userId, member } = await requireTeamAdmin(teamId)

    const webhook = await db.webhookEndpoint.findFirst({
      where: { id: webhookId, teamId },
    })

    if (!webhook) {
      throw new HttpError(404, "Webhook not found")
    }

    const payload = {
      event: "test.ping",
      timestamp: new Date().toISOString(),
      teamId,
      endpointId: webhook.id,
      triggeredBy: member.userName || user.name || "Admin",
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

    await db.webhookEndpoint.update({
      where: { id: webhookId },
      data: {
        lastStatus: "active",
      },
    })

    await db.auditLog.create({
      data: {
        teamId,
        userId,
        userName: member.userName || user.name || "Admin",
        userEmail: member.userEmail || user.email || "admin@sketchitup.internal",
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
    return handleRouteError(error)
  }
}
