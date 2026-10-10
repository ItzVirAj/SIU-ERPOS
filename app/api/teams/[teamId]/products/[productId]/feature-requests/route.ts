import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { handleRouteError, HttpError } from "@/lib/authz";
import { db } from "@/lib/db"

const createFeatureRequestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  category: z.string().default("FEATURE"),
  source: z.string().default("PILOT_CUSTOMER"),
  requesterName: z.string().nullable().optional(),
}).strict()

const patchFeatureRequestSchema = z.object({
  requestId: z.string().min(1),
  action: z.enum(["upvote"]).optional(),
  status: z.string().optional(),
}).strict()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; productId: string }> }
) {
  try {
    const { teamId, productId } = await params
    await requireTeamAccess(teamId, { module: AppModule.PRODUCTS, level: AccessLevel.VIEW })

    const requests = await db.productFeatureRequest.findMany({
      where: { productId, teamId },
      orderBy: { voteCount: "desc" },
    })

    return NextResponse.json({ requests })
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
    const { userId } = await requireTeamAccess(teamId, { module: AppModule.PRODUCTS, level: AccessLevel.WRITE })

    const product = await db.domainProduct.findFirst({
      where: { id: productId, teamId },
    })
    if (!product) {
      throw new HttpError(404, "Product not found")
    }

    const rawBody = await request.json()
    const { title, description, category, source, requesterName } =
      createFeatureRequestSchema.parse(rawBody)

    const featureReq = await db.productFeatureRequest.create({
      data: {
        productId,
        teamId,
        title,
        description: description?.trim() || null,
        category,
        source,
        requesterName: requesterName?.trim() || null,
        voteCount: 1,
        upvotedBy: [userId],
      },
    })

    return NextResponse.json({ request: featureReq }, { status: 201 })
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
    const { userId } = await requireTeamAccess(teamId, { module: AppModule.PRODUCTS, level: AccessLevel.WRITE })

    const rawBody = await request.json()
    const { requestId, action, status } = patchFeatureRequestSchema.parse(rawBody)

    const current = await db.productFeatureRequest.findFirst({
      where: { id: requestId, productId, teamId },
    })

    if (!current) {
      throw new HttpError(404, "Feature request not found")
    }

    if (action === "upvote") {
      const upvoted = (current.upvotedBy as string[]) || []
      const hasUpvoted = upvoted.includes(userId)
      const newUpvoted = hasUpvoted ? upvoted.filter((id) => id !== userId) : [...upvoted, userId]
      const delta = hasUpvoted ? -1 : 1

      const updated = await db.productFeatureRequest.update({
        where: { id: requestId },
        data: {
          voteCount: Math.max(1, current.voteCount + delta),
          upvotedBy: newUpvoted,
        },
      })
      return NextResponse.json({ request: updated })
    }

    if (status) {
      const updated = await db.productFeatureRequest.update({
        where: { id: requestId },
        data: { status },
      })
      return NextResponse.json({ request: updated })
    }

    return NextResponse.json({ request: current })
  } catch (error) {
    return handleRouteError(error)
  }
}
