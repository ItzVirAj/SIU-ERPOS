import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireTeamMember, handleRouteError, HttpError } from "@/lib/authz"
import { db } from "@/lib/db"

const createPilotSchema = z.object({
  companyName: z.string().min(1).max(200),
  contactName: z.string().nullable().optional(),
  contactEmail: z.string().email().nullable().optional().or(z.literal("")),
  clientId: z.string().nullable().optional(),
  stage: z.string().default("PILOT_ACTIVE"),
  healthScore: z.number().min(0).max(100).default(85),
  feedbackNotes: z.string().nullable().optional(),
  endDate: z.union([z.string(), z.date()]).nullable().optional(),
}).strict()

const patchPilotSchema = z.object({
  pilotId: z.string().min(1),
  stage: z.string().optional(),
  healthScore: z.number().min(0).max(100).optional(),
  feedbackNotes: z.string().nullable().optional(),
}).strict()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; productId: string }> }
) {
  try {
    const { teamId, productId } = await params
    await requireTeamMember(teamId)

    const pilots = await db.productPilotCustomer.findMany({
      where: { productId, teamId },
      include: { client: { select: { id: true, name: true, company: true } } },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ pilots })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; productId: string }> }
) {
  try {
    const { teamId, productId } = await params
    await requireTeamMember(teamId, "developer")

    const product = await db.domainProduct.findFirst({
      where: { id: productId, teamId },
    })
    if (!product) {
      throw new HttpError(404, "Product not found")
    }

    const rawBody = await request.json()
    const {
      companyName,
      contactName,
      contactEmail,
      clientId,
      stage,
      healthScore,
      feedbackNotes,
      endDate,
    } = createPilotSchema.parse(rawBody)

    const pilot = await db.productPilotCustomer.create({
      data: {
        productId,
        teamId,
        companyName,
        contactName: contactName?.trim() || null,
        contactEmail: contactEmail ? contactEmail.trim() : null,
        clientId: clientId || undefined,
        stage,
        healthScore,
        feedbackNotes: feedbackNotes?.trim() || null,
        endDate: endDate ? new Date(endDate) : undefined,
      },
    })

    return NextResponse.json({ pilot }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; productId: string }> }
) {
  try {
    const { teamId, productId } = await params
    await requireTeamMember(teamId, "developer")

    const rawBody = await request.json()
    const { pilotId, stage, healthScore, feedbackNotes } = patchPilotSchema.parse(rawBody)

    const existing = await db.productPilotCustomer.findFirst({
      where: { id: pilotId, productId, teamId },
    })

    if (!existing) {
      throw new HttpError(404, "Pilot customer not found")
    }

    const pilot = await db.productPilotCustomer.update({
      where: { id: pilotId },
      data: {
        ...(stage && { stage }),
        ...(healthScore !== undefined && { healthScore }),
        ...(feedbackNotes !== undefined && { feedbackNotes: feedbackNotes?.trim() || null }),
      },
    })

    return NextResponse.json({ pilot })
  } catch (error) {
    return handleRouteError(error)
  }
}
