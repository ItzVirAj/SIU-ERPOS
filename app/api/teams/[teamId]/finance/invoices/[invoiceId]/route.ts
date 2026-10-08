import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/auth-server-helpers"
import { db } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; invoiceId: string }> }
) {
  try {
    const { teamId, invoiceId } = await params
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

    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId, teamId },
      include: {
        client: true,
        project: true,
        items: true,
        payments: { orderBy: { paymentDate: "desc" } },
        team: {
          include: { companySettings: true },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    return NextResponse.json({ invoice })
  } catch (error) {
    console.error("Error fetching invoice:", error)
    return NextResponse.json({ error: "Failed to fetch invoice" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; invoiceId: string }> }
) {
  try {
    const { teamId, invoiceId } = await params
    const userId = await getUserId()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const membership = await db.teamMember.findFirst({
      where: {
        teamId,
        userId,
        role: { in: ["admin", "developer"] },
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const body = await request.json()
    const { status, paymentTerms, notes } = body

    const updated = await db.invoice.update({
      where: { id: invoiceId, teamId },
      data: {
        ...(status && { status }),
        ...(paymentTerms !== undefined && { paymentTerms }),
        ...(notes !== undefined && { notes }),
      },
    })

    return NextResponse.json({ invoice: updated })
  } catch (error) {
    console.error("Error updating invoice:", error)
    return NextResponse.json({ error: "Failed to update invoice" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; invoiceId: string }> }
) {
  try {
    const { teamId, invoiceId } = await params
    const userId = await getUserId()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const membership = await db.teamMember.findFirst({
      where: {
        teamId,
        userId,
        role: { in: ["admin", "developer"] },
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const existing = await db.invoice.findFirst({
      where: { id: invoiceId, teamId },
    })

    if (!existing) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    await db.invoice.delete({
      where: { id: invoiceId },
    })

    await db.auditLog.create({
      data: {
        teamId,
        userId,
        userName: membership.userName || "Admin",
        userEmail: membership.userEmail || "admin@sketchitup.internal",
        action: "DELETE",
        entityType: "INVOICE",
        entityId: invoiceId,
        entityTitle: existing.invoiceNumber,
        details: { invoiceNumber: existing.invoiceNumber },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting invoice:", error)
    return NextResponse.json({ error: "Failed to delete invoice" }, { status: 500 })
  }
}
