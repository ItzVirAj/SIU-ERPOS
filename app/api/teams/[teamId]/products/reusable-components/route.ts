import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireTeamMember, handleRouteError } from "@/lib/authz"
import { db } from "@/lib/db"

const createComponentSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().default("BACKEND"),
  description: z.string().nullable().optional(),
  techStack: z.string().nullable().optional(),
  repoUrl: z.string().nullable().optional(),
  timesReused: z.number().int().nonnegative().optional(),
  hoursSavedEstimate: z.number().nonnegative().optional(),
}).strict()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamMember(teamId)

    const components = await db.reusableComponent.findMany({
      where: { teamId },
      orderBy: { timesReused: "desc" },
    })

    return NextResponse.json({ components })
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
      category,
      description,
      techStack,
      repoUrl,
      timesReused = 1,
      hoursSavedEstimate = 40,
    } = createComponentSchema.parse(rawBody)

    const component = await db.reusableComponent.create({
      data: {
        teamId,
        name: name.trim(),
        category,
        description: description?.trim() || null,
        techStack: techStack?.trim() || undefined,
        repoUrl: repoUrl?.trim() || null,
        timesReused,
        hoursSavedEstimate,
      },
    })

    return NextResponse.json({ component }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
