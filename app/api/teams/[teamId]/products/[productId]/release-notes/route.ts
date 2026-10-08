import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireTeamMember, handleRouteError, HttpError } from "@/lib/authz"
import { db } from "@/lib/db"

const createReleaseNoteSchema = z.object({
  version: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  isPublished: z.boolean().default(true),
  features: z.array(z.string()).default([]),
  improvements: z.array(z.string()).default([]),
  fixes: z.array(z.string()).default([]),
  notes: z.string().nullable().optional(),
}).strict()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; productId: string }> }
) {
  try {
    const { teamId, productId } = await params
    await requireTeamMember(teamId)

    const releases = await db.productReleaseNote.findMany({
      where: { productId, teamId },
      orderBy: { releaseDate: "desc" },
    })

    return NextResponse.json({ releases })
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
      version,
      title,
      isPublished,
      features,
      improvements,
      fixes,
      notes,
    } = createReleaseNoteSchema.parse(rawBody)

    const release = await db.productReleaseNote.create({
      data: {
        productId,
        teamId,
        version,
        title,
        isPublished,
        features,
        improvements,
        fixes,
        notes: notes?.trim() || null,
      },
    })

    return NextResponse.json({ release }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
