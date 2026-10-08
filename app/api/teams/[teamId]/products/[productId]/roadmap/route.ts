import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireTeamMember, handleRouteError, HttpError } from "@/lib/authz"
import { db } from "@/lib/db"

const createRoadmapItemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  quarter: z.string().default("Q2_2026"),
  stage: z.string().default("PLANNED"),
  priority: z.string().default("MEDIUM"),
  progress: z.number().min(0).max(100).default(0),
  effortEstimate: z.string().nullable().optional(),
  targetDate: z.union([z.string(), z.date()]).nullable().optional(),
}).strict()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; productId: string }> }
) {
  try {
    const { teamId, productId } = await params
    await requireTeamMember(teamId)

    const items = await db.productRoadmapItem.findMany({
      where: { productId, teamId },
      orderBy: [{ quarter: "asc" }, { createdAt: "asc" }],
    })

    return NextResponse.json({ items })
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
      title,
      description,
      quarter,
      stage,
      priority,
      progress,
      effortEstimate,
      targetDate,
    } = createRoadmapItemSchema.parse(rawBody)

    const item = await db.productRoadmapItem.create({
      data: {
        productId,
        teamId,
        title,
        description: description?.trim() || null,
        quarter,
        stage,
        priority,
        progress,
        effortEstimate: effortEstimate?.trim() || null,
        targetDate: targetDate ? new Date(targetDate) : undefined,
      },
    })

    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
