import { NextRequest, NextResponse } from "next/server"
import { requireTeamMember, handleRouteError } from "@/lib/authz"
import { db } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamMember(teamId)

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
    return handleRouteError(error)
  }
}
