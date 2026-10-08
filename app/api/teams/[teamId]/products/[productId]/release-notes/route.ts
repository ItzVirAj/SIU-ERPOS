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

    const releases = await db.productReleaseNote.findMany({
      where: { productId, teamId },
      orderBy: { releaseDate: "desc" },
    })

    return NextResponse.json({ releases })
  } catch (error) {
    console.error("Error listing release notes:", error)
    return NextResponse.json({ error: "Failed to list release notes" }, { status: 500 })
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
      version,
      title,
      isPublished = true,
      features = [],
      improvements = [],
      fixes = [],
      notes,
    } = body

    if (!version || !title) {
      return NextResponse.json({ error: "Version and title are required" }, { status: 400 })
    }

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
        notes,
      },
    })

    return NextResponse.json({ release }, { status: 201 })
  } catch (error) {
    console.error("Error creating release note:", error)
    return NextResponse.json({ error: "Failed to create release note" }, { status: 500 })
  }
}
