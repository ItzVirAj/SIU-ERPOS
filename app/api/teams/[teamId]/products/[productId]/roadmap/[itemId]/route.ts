import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/auth-server-helpers"
import { db } from "@/lib/db"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; productId: string; itemId: string }> }
) {
  try {
    const { itemId } = await params
    const userId = await getUserId()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    const item = await db.productRoadmapItem.update({
      where: { id: itemId },
      data: body,
    })

    return NextResponse.json({ item })
  } catch (error) {
    console.error("Error updating roadmap item:", error)
    return NextResponse.json({ error: "Failed to update roadmap item" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; productId: string; itemId: string }> }
) {
  try {
    const { itemId } = await params
    const userId = await getUserId()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await db.productRoadmapItem.delete({
      where: { id: itemId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting roadmap item:", error)
    return NextResponse.json({ error: "Failed to delete roadmap item" }, { status: 500 })
  }
}
