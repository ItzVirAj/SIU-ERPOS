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

    const unpaidInvoices = await db.invoice.findMany({
      where: {
        teamId,
        status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] },
        balanceDue: { gt: 0 },
      },
      include: {
        client: { select: { id: true, name: true, company: true, email: true } },
      },
      orderBy: { dueDate: "asc" },
    })

    const now = new Date()
    const buckets = {
      current: { label: "Current (Not Due)", count: 0, amount: 0, invoices: [] as any[] },
      days1_30: { label: "1 - 30 Days Overdue", count: 0, amount: 0, invoices: [] as any[] },
      days31_60: { label: "31 - 60 Days Overdue", count: 0, amount: 0, invoices: [] as any[] },
      days61_90: { label: "61 - 90 Days Overdue", count: 0, amount: 0, invoices: [] as any[] },
      days90_plus: { label: "90+ Days Critical", count: 0, amount: 0, invoices: [] as any[] },
    }

    unpaidInvoices.forEach((inv) => {
      const diffTime = now.getTime() - new Date(inv.dueDate).getTime()
      const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24))

      const item = {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        clientName: inv.client.name,
        company: inv.client.company,
        email: inv.client.email,
        grandTotal: inv.grandTotal,
        balanceDue: inv.balanceDue,
        dueDate: inv.dueDate,
        daysOverdue: Math.max(0, daysOverdue),
      }

      if (daysOverdue <= 0) {
        buckets.current.count++
        buckets.current.amount += inv.balanceDue
        buckets.current.invoices.push(item)
      } else if (daysOverdue <= 30) {
        buckets.days1_30.count++
        buckets.days1_30.amount += inv.balanceDue
        buckets.days1_30.invoices.push(item)
      } else if (daysOverdue <= 60) {
        buckets.days31_60.count++
        buckets.days31_60.amount += inv.balanceDue
        buckets.days31_60.invoices.push(item)
      } else if (daysOverdue <= 90) {
        buckets.days61_90.count++
        buckets.days61_90.amount += inv.balanceDue
        buckets.days61_90.invoices.push(item)
      } else {
        buckets.days90_plus.count++
        buckets.days90_plus.amount += inv.balanceDue
        buckets.days90_plus.invoices.push(item)
      }
    })

    const totalReceivables =
      buckets.current.amount +
      buckets.days1_30.amount +
      buckets.days31_60.amount +
      buckets.days61_90.amount +
      buckets.days90_plus.amount

    const chartData = [
      { name: "Current", amount: buckets.current.amount, color: "#10b981" },
      { name: "1-30 Days", amount: buckets.days1_30.amount, color: "#f59e0b" },
      { name: "31-60 Days", amount: buckets.days31_60.amount, color: "#f97316" },
      { name: "61-90 Days", amount: buckets.days61_90.amount, color: "#ef4444" },
      { name: "90+ Days", amount: buckets.days90_plus.amount, color: "#991b1b" },
    ]

    return NextResponse.json({
      totalReceivables,
      buckets,
      chartData,
    })
  } catch (error) {
    console.error("Error fetching receivables ageing:", error)
    return NextResponse.json({ error: "Failed to fetch receivables" }, { status: 500 })
  }
}
