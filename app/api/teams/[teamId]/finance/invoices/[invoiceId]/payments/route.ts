import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/auth-server-helpers"
import { db } from "@/lib/db"

export async function POST(
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
    const { amount, paymentDate = new Date(), paymentMethod = "BANK_TRANSFER", referenceNumber, notes } = body

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: "Valid payment amount is required" }, { status: 400 })
    }

    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId, teamId },
    })

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    const payAmount = Number(amount)
    const newAmountPaid = invoice.amountPaid + payAmount
    const newBalanceDue = Math.max(0, invoice.grandTotal - newAmountPaid)
    const isFullyPaid = newBalanceDue === 0
    const newStatus = isFullyPaid ? "PAID" : "PARTIALLY_PAID"

    // Generate receipt number
    const paymentCount = await db.payment.count({ where: { teamId } })
    const receiptNumber = `REC-2026-${String(paymentCount + 1).padStart(4, "0")}`

    const [payment, updatedInvoice] = await db.$transaction([
      db.payment.create({
        data: {
          teamId,
          invoiceId,
          amount: payAmount,
          currency: invoice.currency,
          paymentDate: new Date(paymentDate),
          paymentMethod,
          referenceNumber: referenceNumber?.trim() || null,
          receiptNumber,
          notes: notes?.trim() || null,
        },
      }),
      db.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: newAmountPaid,
          balanceDue: newBalanceDue,
          status: newStatus,
          paidAt: isFullyPaid ? new Date() : invoice.paidAt,
        },
      }),
    ])

    // Log to Audit Trail
    await db.auditLog.create({
      data: {
        teamId,
        userId,
        userName: membership.userName || "Admin",
        userEmail: membership.userEmail || "admin@sketchitup.internal",
        action: "RECORD_PAYMENT",
        entityType: "INVOICE",
        entityId: invoiceId,
        entityTitle: invoice.invoiceNumber,
        details: {
          invoiceNumber: invoice.invoiceNumber,
          paidAmount: payAmount,
          receiptNumber,
          newStatus,
          referenceNumber,
        },
      },
    })

    return NextResponse.json({ payment, invoice: updatedInvoice })
  } catch (error) {
    console.error("Error recording payment:", error)
    return NextResponse.json({ error: "Failed to record payment" }, { status: 500 })
  }
}
