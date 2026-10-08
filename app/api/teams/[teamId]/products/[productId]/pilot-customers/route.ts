import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/auth-server-helpers"
import { db } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; productId: string }> }
) {
  try {
    const { teamId, productId } = await params
    const userId = await getUserId()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const pilots = await db.productPilotCustomer.findMany({
      where: { productId, teamId },
      include: { client: { select: { id: true, name: true, company: true } } },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ pilots })
  } catch (error) {
    console.error("Error listing pilot customers:", error)
    return NextResponse.json({ error: "Failed to list pilot customers" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; productId: string }> }
) {
  try {
    const { teamId, productId } = await params
    const userId = await getUserId()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      companyName,
      contactName,
      contactEmail,
      clientId,
      stage = "PILOT_ACTIVE",
      healthScore = 85,
      feedbackNotes,
      endDate,
    } = body

    if (!companyName) {
      return NextResponse.json({ error: "Company name is required" }, { status: 400 })
    }

    const pilot = await db.productPilotCustomer.create({
      data: {
        productId,
        teamId,
        companyName,
        contactName,
        contactEmail,
        clientId: clientId || undefined,
        stage,
        healthScore: Number(healthScore) || 85,
        feedbackNotes,
        endDate: endDate ? new Date(endDate) : undefined,
      },
    })

    return NextResponse.json({ pilot }, { status: 201 })
  } catch (error) {
    console.error("Error creating pilot customer:", error)
    return NextResponse.json({ error: "Failed to create pilot customer" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; productId: string }> }
) {
  try {
    const { teamId, productId } = await params
    const userId = await getUserId()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { pilotId, stage, healthScore, feedbackNotes } = body

    if (!pilotId) {
      return NextResponse.json({ error: "pilotId is required" }, { status: 400 })
    }

    const pilot = await db.productPilotCustomer.update({
      where: { id: pilotId },
      data: {
        stage: stage || undefined,
        healthScore: healthScore !== undefined ? Number(healthScore) : undefined,
        feedbackNotes: feedbackNotes !== undefined ? feedbackNotes : undefined,
      },
    })

    return NextResponse.json({ pilot })
  } catch (error) {
    console.error("Error updating pilot customer:", error)
    return NextResponse.json({ error: "Failed to update pilot customer" }, { status: 500 })
  }
}
