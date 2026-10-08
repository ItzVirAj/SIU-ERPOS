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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")

    const where: any = { teamId }
    if (status && status !== "ALL") {
      where.status = status
    }

    let invoices = await db.invoice.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, company: true, email: true, gstin: true } },
        project: { select: { id: true, name: true, key: true } },
        items: true,
        payments: { orderBy: { paymentDate: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    })

    // Auto-seed starter GST Invoices if empty for this team
    if (invoices.length === 0 && !status) {
      const client = await db.client.findFirst({ where: { teamId } })
      const clientRecord =
        client ||
        (await db.client.create({
          data: {
            teamId,
            name: "Apex Global Technologies",
            company: "Apex Global Pvt Ltd",
            email: "accounts@apextech.com",
            gstin: "27AAACA9876P1ZX",
            status: "active",
          },
        }))

      const now = new Date()
      const dueDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000)

      await db.invoice.create({
        data: {
          teamId,
          clientId: clientRecord.id,
          invoiceNumber: "INV-2026-0001",
          status: "SENT",
          issueDate: now,
          dueDate,
          currency: "INR",
          subtotal: 150000,
          discount: 0,
          taxTotal: 27000,
          grandTotal: 177000,
          amountPaid: 0,
          balanceDue: 177000,
          supplyType: "INTRA_STATE",
          cgstAmount: 13500,
          sgstAmount: 13500,
          igstAmount: 0,
          paymentTerms: "Net 15 Days. Bank transfer or UPI.",
          items: {
            create: [
              {
                description: "Design System & Frontend Sprint Deliverable",
                hsnSac: "998314",
                quantity: 1,
                unitPrice: 150000,
                taxRate: 18,
                amount: 150000,
              },
            ],
          },
        },
      })

      invoices = await db.invoice.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, company: true, email: true, gstin: true } },
          project: { select: { id: true, name: true, key: true } },
          items: true,
          payments: { orderBy: { paymentDate: "desc" } },
        },
        orderBy: { createdAt: "desc" },
      })
    }

    return NextResponse.json({ invoices })
  } catch (error) {
    console.error("Error fetching invoices:", error)
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 })
  }
}

export async function POST(
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
    const {
      clientId,
      projectId,
      issueDate = new Date(),
      dueDate,
      currency = "INR",
      supplyType = "INTRA_STATE", // "INTRA_STATE", "INTER_STATE", "EXPORT"
      items = [],
      discount = 0,
      paymentTerms = "Due within 15 days of invoice date",
      notes,
    } = body

    if (!clientId) {
      return NextResponse.json({ error: "Client is required" }, { status: 400 })
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "At least one line item is required" }, { status: 400 })
    }

    // Generate sequential invoice number
    const count = await db.invoice.count({ where: { teamId } })
    const invoiceNumber = `INV-2026-${String(count + 1).padStart(4, "0")}`

    // Compute Subtotal and Taxes
    let subtotal = 0
    items.forEach((item: any) => {
      const lineAmt = (Number(item.quantity) || 1) * Number(item.unitPrice || 0)
      subtotal += lineAmt
    })

    const taxableAmount = Math.max(0, subtotal - Number(discount || 0))
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
        discount: Number(discount || 0),
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
          create: items.map((it: any) => ({
            description: it.description,
            hsnSac: it.hsnSac || "998314",
            quantity: Number(it.quantity) || 1,
            unitPrice: Number(it.unitPrice) || 0,
            taxRate: supplyType === "EXPORT" ? 0 : 18,
            amount: (Number(it.quantity) || 1) * Number(it.unitPrice || 0),
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
        userName: membership.userName || "Admin",
        userEmail: membership.userEmail || "admin@sketchitup.internal",
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

    return NextResponse.json({ invoice })
  } catch (error) {
    console.error("Error creating invoice:", error)
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 })
  }
}
