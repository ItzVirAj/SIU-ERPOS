import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { handleRouteError, HttpError } from "@/lib/authz";
import { db } from "@/lib/db"

const patchInvoiceSchema = z.object({
  status: z.enum(["draft", "sent", "paid", "partially_paid", "overdue", "cancelled"]).optional(),
  paymentTerms: z.string().optional(),
  notes: z.string().nullable().optional(),
}).strict()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; invoiceId: string }> }
) {
  try {
    const { teamId, invoiceId } = await params
    await requireTeamAccess(teamId, { module: AppModule.FINANCE, level: AccessLevel.VIEW })

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
      throw new HttpError(404, "Invoice not found")
    }

    return NextResponse.json({ invoice })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; invoiceId: string }> }
) {
  try {
    const { teamId, invoiceId } = await params
    await requireTeamAccess(teamId, { module: AppModule.FINANCE, level: AccessLevel.WRITE })

    const existing = await db.invoice.findFirst({
      where: { id: invoiceId, teamId },
    })

    if (!existing) {
      throw new HttpError(404, "Invoice not found")
    }

    const rawBody = await request.json()
    const { status, paymentTerms, notes } = patchInvoiceSchema.parse(rawBody)

    const updated = await db.invoice.update({
      where: { id: invoiceId },
      data: {
        ...(status && { status }),
        ...(paymentTerms !== undefined && { paymentTerms }),
        ...(notes !== undefined && { notes }),
      },
    })

    return NextResponse.json({ invoice: updated })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; invoiceId: string }> }
) {
  try {
    const { teamId, invoiceId } = await params
    const { user, userId, member } = await requireTeamAccess(teamId, { module: AppModule.FINANCE, level: AccessLevel.MANAGE })

    const existing = await db.invoice.findFirst({
      where: { id: invoiceId, teamId },
    })

    if (!existing) {
      throw new HttpError(404, "Invoice not found")
    }

    await db.invoice.delete({
      where: { id: invoiceId },
    })

    await db.auditLog.create({
      data: {
        teamId,
        userId,
        userName: member.userName || user.name || "Admin",
        userEmail: member.userEmail || user.email || "admin@sketchitup.internal",
        action: "DELETE",
        entityType: "INVOICE",
        entityId: invoiceId,
        entityTitle: existing.invoiceNumber,
        details: { invoiceNumber: existing.invoiceNumber },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
