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

    const requests = await db.productFeatureRequest.findMany({
      where: { productId, teamId },
      orderBy: { voteCount: "desc" },
    })

    return NextResponse.json({ requests })
  } catch (error) {
    console.error("Error listing feature requests:", error)
    return NextResponse.json({ error: "Failed to list feature requests" }, { status: 500 })
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
      category = "FEATURE",
      source = "PILOT_CUSTOMER",
      requesterName,
    } = body

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    const featureReq = await db.productFeatureRequest.create({
      data: {
        productId,
        teamId,
        title,
        description,
        category,
        source,
        requesterName,
        voteCount: 1,
        upvotedBy: [userId],
      },
    })

    return NextResponse.json({ request: featureReq }, { status: 201 })
  } catch (error) {
    console.error("Error creating feature request:", error)
    return NextResponse.json({ error: "Failed to create feature request" }, { status: 500 })
  }
}

export async function PATCH(
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
    const { requestId, action, status } = body

    if (!requestId) {
      return NextResponse.json({ error: "requestId is required" }, { status: 400 })
    }

    const current = await db.productFeatureRequest.findUnique({
      where: { id: requestId },
    })

    if (!current) {
      return NextResponse.json({ error: "Feature request not found" }, { status: 404 })
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
    console.error("Error updating feature request:", error)
    return NextResponse.json({ error: "Failed to update feature request" }, { status: 500 })
  }
}
