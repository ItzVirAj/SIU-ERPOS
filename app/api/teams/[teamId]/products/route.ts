import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireTeamMember, handleRouteError } from "@/lib/authz"
import { db } from "@/lib/db"

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  tagline: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  vertical: z.string().default("SAAS"),
  status: z.string().default("DEVELOPMENT"),
  ownerName: z.string().nullable().optional(),
  pricingModel: z.string().default("SUBSCRIPTION"),
  targetQuarter: z.string().default("Q3_2026"),
  websiteUrl: z.string().nullable().optional(),
  repositoryUrl: z.string().nullable().optional(),
  mrr: z.number().nonnegative().optional(),
  activeUsers: z.number().nonnegative().optional(),
}).strict()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamMember(teamId)

    const products = await db.domainProduct.findMany({
      where: { teamId },
      include: {
        roadmapItems: { orderBy: { createdAt: "asc" } },
        featureRequests: { orderBy: { voteCount: "desc" } },
        pilotCustomers: { orderBy: { createdAt: "desc" } },
        releaseNotes: { orderBy: { releaseDate: "desc" } },
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json({ products })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamMember(teamId, "developer")

    const rawBody = await request.json()
    const {
      name,
      tagline,
      description,
      vertical,
      status,
      ownerName,
      pricingModel,
      targetQuarter,
      websiteUrl,
      repositoryUrl,
      mrr = 0,
      activeUsers = 0,
    } = createProductSchema.parse(rawBody)

    let slug = slugify(name)
    const existing = await db.domainProduct.findUnique({
      where: { teamId_slug: { teamId, slug } },
    })

    if (existing) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`
    }

    const product = await db.domainProduct.create({
      data: {
        teamId,
        name: name.trim(),
        slug,
        tagline: tagline?.trim() || null,
        description: description?.trim() || null,
        vertical,
        status,
        ownerName: ownerName?.trim() || null,
        pricingModel,
        targetQuarter,
        websiteUrl: websiteUrl?.trim() || null,
        repositoryUrl: repositoryUrl?.trim() || null,
        mrr,
        activeUsers,
      },
    })

    return NextResponse.json({ product }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
