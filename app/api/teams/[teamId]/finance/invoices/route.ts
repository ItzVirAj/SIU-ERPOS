import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { handleRouteError } from "@/lib/authz"
import { requireTeamAccess } from "@/lib/route-guards"
import { AppModule, AccessLevel } from "@/lib/prisma-client"
import { db } from "@/lib/db"

const invoiceItemSchema = z.object({
  description: z.string().min(1),
  hsnSac: z.string().optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  taxRate: z.number().optional(),
  amount: z.number().optional(),
}).strict()

const createInvoiceSchema = z.object({
  clientId: z.string().min(1),
  projectId: z.string().nullable().optional(),
  issueDate: z.union([z.string(), z.date()]).optional(),
  dueDate: z.union([z.string(), z.date()]).optional(),
  currency: z.string().default("INR"),
  supplyType: z.enum(["INTRA_STATE", "INTER_STATE", "EXPORT"]).default("INTRA_STATE"),
  items: z.array(invoiceItemSchema).min(1),
  discount: z.number().nonnegative().optional(),
  paymentTerms: z.string().optional(),
  notes: z.string().nullable().optional(),
}).strict()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamAccess(teamId, { module: AppModule.FINANCE, level: AccessLevel.VIEW })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")

    const where: any = { teamId }
    if (status && status !== "ALL") {
      where.status = status
    }

    const invoices = await db.invoice.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, company: true, email: true, gstin: true } },
        project: { select: { id: true, name: true, key: true } },
        items: true,
        payments: { orderBy: { paymentDate: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ invoices })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const { user, userId, member } = await requireTeamAccess(teamId, { module: AppModule.FINANCE, level: AccessLevel.WRITE })

    const rawBody = await request.json()
    const body = createInvoiceSchema.parse(rawBody)

    const {
      clientId,
      projectId,
      issueDate = new Date(),
      dueDate,
      currency = "INR",
      supplyType = "INTRA_STATE",
      items,
      discount = 0,
      paymentTerms = "Due within 15 days of invoice date",
      notes,
    } = body

    // Generate sequential invoice number
    const count = await db.invoice.count({ where: { teamId } })
    const invoiceNumber = `INV-2026-${String(count + 1).padStart(4, "0")}`

    // Compute Subtotal and Taxes
    let subtotal = 0
    items.forEach((item) => {
      const lineAmt = item.quantity * item.unitPrice
      subtotal += lineAmt
    })

    const taxableAmount = Math.max(0, subtotal - discount)
    let cgstAmount = 0
    let sgstAmount = 0
    let igstAmount = 0

    if (supplyType === "INTRA_STATE") {
      cgstAmount = Math.round(taxableAmount * 0.09) // 9%
      sgstAmount = Math.round(taxableAmount * 0.09) // 9%
    } else if (supplyType === "INTER_STATE") {
      igstAmount = Math.round(taxableAmount * 0.18) // 18%
    } // EXPORT is 0%

    const taxTotal = cgstAmount + sgstAmount + igstAmount
    const grandTotal = taxableAmount + taxTotal

    const invoice = await db.invoice.create({
      data: {
        teamId,
        clientId,
        projectId: projectId || null,
        invoiceNumber,
        status: "SENT",
        issueDate: new Date(issueDate),
        dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        currency,
        subtotal,
        discount,
        taxTotal,
        grandTotal,
        amountPaid: 0,
        balanceDue: grandTotal,
        supplyType,
        cgstAmount,
        sgstAmount,
        igstAmount,
        paymentTerms,
        notes: notes?.trim() || null,
        items: {
          create: items.map((it) => ({
            description: it.description,
            hsnSac: it.hsnSac || "998314",
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            taxRate: supplyType === "EXPORT" ? 0 : 18,
            amount: it.quantity * it.unitPrice,
          })),
        },
      },
      include: {
        items: true,
        client: true,
      },
    })

    // Log to Audit Trail
    await db.auditLog.create({
      data: {
        teamId,
        userId,
        userName: member.userName || user.name || "Admin",
        userEmail: member.userEmail || user.email || "admin@sketchitup.internal",
        action: "CREATE",
        entityType: "INVOICE",
        entityId: invoice.id,
        entityTitle: invoice.invoiceNumber,
        details: {
          invoiceNumber: invoice.invoiceNumber,
          grandTotal: invoice.grandTotal,
          client: invoice.client.name,
        },
      },
    })

    return NextResponse.json({ invoice }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
