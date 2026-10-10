import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { handleRouteError, HttpError } from "@/lib/authz";
import { db } from "@/lib/db"

const patchRoadmapItemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  quarter: z.string().optional(),
  stage: z.string().optional(),
  priority: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
  effortEstimate: z.string().nullable().optional(),
  targetDate: z.union([z.string(), z.date()]).nullable().optional(),
}).strict()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; productId: string; itemId: string }> }
) {
  try {
    const { teamId, productId, itemId } = await params
    await requireTeamAccess(teamId, { module: AppModule.PRODUCTS, level: AccessLevel.WRITE })

    const existing = await db.productRoadmapItem.findFirst({
      where: { id: itemId, productId, teamId },
    })

    if (!existing) {
      throw new HttpError(404, "Roadmap item not found")
    }

    const rawBody = await request.json()
    const body = patchRoadmapItemSchema.parse(rawBody)

    const item = await db.productRoadmapItem.update({
      where: { id: itemId },
      data: {
        ...(body.title && { title: body.title.trim() }),
        ...(body.description !== undefined && { description: body.description?.trim() || null }),
        ...(body.quarter && { quarter: body.quarter }),
        ...(body.stage && { stage: body.stage }),
        ...(body.priority && { priority: body.priority }),
        ...(body.progress !== undefined && { progress: body.progress }),
        ...(body.effortEstimate !== undefined && {
          effortEstimate: body.effortEstimate?.trim() || null,
        }),
        ...(body.targetDate !== undefined && {
          targetDate: body.targetDate ? new Date(body.targetDate) : null,
        }),
      },
    })

    return NextResponse.json({ item })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; productId: string; itemId: string }> }
) {
  try {
    const { teamId, productId, itemId } = await params
    await requireTeamAccess(teamId, { module: AppModule.PRODUCTS, level: AccessLevel.MANAGE })

    const existing = await db.productRoadmapItem.findFirst({
      where: { id: itemId, productId, teamId },
    })

    if (!existing) {
      throw new HttpError(404, "Roadmap item not found")
    }

    await db.productRoadmapItem.delete({
      where: { id: itemId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
