import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { handleRouteError, HttpError } from "@/lib/authz";
import { db } from "@/lib/db"

const patchProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  tagline: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  vertical: z.string().optional(),
  status: z.string().optional(),
  ownerName: z.string().nullable().optional(),
  pricingModel: z.string().optional(),
  targetQuarter: z.string().optional(),
  websiteUrl: z.string().nullable().optional(),
  repositoryUrl: z.string().nullable().optional(),
  mrr: z.number().nonnegative().optional(),
  activeUsers: z.number().nonnegative().optional(),
  healthScore: z.number().min(0).max(100).optional(),
}).strict()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; productId: string }> }
) {
  try {
    const { teamId, productId } = await params
    await requireTeamAccess(teamId, { module: AppModule.PRODUCTS, level: AccessLevel.VIEW })

    const product = await db.domainProduct.findFirst({
      where: { id: productId, teamId },
      include: {
        roadmapItems: { orderBy: { createdAt: "asc" } },
        featureRequests: { orderBy: { voteCount: "desc" } },
        pilotCustomers: { orderBy: { createdAt: "desc" } },
        releaseNotes: { orderBy: { releaseDate: "desc" } },
      },
    })

    if (!product) {
      throw new HttpError(404, "Product not found")
    }

    return NextResponse.json({ product })
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
    await requireTeamAccess(teamId, { module: AppModule.PRODUCTS, level: AccessLevel.WRITE })

    const existing = await db.domainProduct.findFirst({
      where: { id: productId, teamId },
    })

    if (!existing) {
      throw new HttpError(404, "Product not found")
    }

    const rawBody = await request.json()
    const validatedBody = patchProductSchema.parse(rawBody)

    const updated = await db.domainProduct.update({
      where: { id: productId },
      data: validatedBody,
    })

    return NextResponse.json({ product: updated })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; productId: string }> }
) {
  try {
    const { teamId, productId } = await params
    await requireTeamAccess(teamId, { module: AppModule.PRODUCTS, level: AccessLevel.MANAGE })

    const existing = await db.domainProduct.findFirst({
      where: { id: productId, teamId },
    })

    if (!existing) {
      throw new HttpError(404, "Product not found")
    }

    await db.domainProduct.delete({
      where: { id: productId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
