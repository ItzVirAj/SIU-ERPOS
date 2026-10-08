import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/auth-server-helpers"
import { db } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const userId = await getUserId()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const membership = await db.teamMember.findFirst({
      where: { teamId, userId },
    })

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const payments = await db.payment.findMany({
      where: { teamId },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            client: {
              select: {
                id: true,
                name: true,
                company: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { paymentDate: "desc" },
    })

    return NextResponse.json({ payments })
  } catch (error) {
    console.error("Error fetching payments list:", error)
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 })
  }
}
