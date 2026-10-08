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

    const items = await db.productRoadmapItem.findMany({
      where: { productId, teamId },
      orderBy: [{ quarter: "asc" }, { createdAt: "asc" }],
    })

    return NextResponse.json({ items })
  } catch (error) {
    console.error("Error listing roadmap items:", error)
    return NextResponse.json({ error: "Failed to list roadmap items" }, { status: 500 })
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
      title,
      description,
      quarter = "Q2_2026",
      stage = "PLANNED",
      priority = "MEDIUM",
      progress = 0,
      effortEstimate,
      targetDate,
    } = body

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    const item = await db.productRoadmapItem.create({
      data: {
        productId,
        teamId,
        title,
        description,
        quarter,
        stage,
        priority,
        progress: Number(progress) || 0,
        effortEstimate,
        targetDate: targetDate ? new Date(targetDate) : undefined,
      },
    })

    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    console.error("Error creating roadmap item:", error)
    return NextResponse.json({ error: "Failed to create roadmap item" }, { status: 500 })
  }
}
