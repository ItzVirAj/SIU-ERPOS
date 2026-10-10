import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { handleRouteError, HttpError } from "@/lib/authz";
import { db } from "@/lib/db"

const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  paymentDate: z.union([z.string(), z.date()]).optional(),
  paymentMethod: z.string().default("BANK_TRANSFER"),
  referenceNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
}).strict()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; invoiceId: string }> }
) {
  try {
    const { teamId, invoiceId } = await params
    const { user, userId, member } = await requireTeamAccess(teamId, { module: AppModule.FINANCE, level: AccessLevel.WRITE })

    const rawBody = await request.json()
    const {
      amount,
      paymentDate = new Date(),
      paymentMethod = "BANK_TRANSFER",
      referenceNumber,
      notes,
    } = recordPaymentSchema.parse(rawBody)

    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId, teamId },
    })

    if (!invoice) {
      throw new HttpError(404, "Invoice not found")
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

    await db.auditLog.create({
      data: {
        teamId,
        userId,
        userName: member.userName || user.name || "Admin",
        userEmail: member.userEmail || user.email || "admin@sketchitup.internal",
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
    return handleRouteError(error)
  }
}
