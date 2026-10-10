import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from "next/server"
import { handleRouteError } from "@/lib/authz";
import { db } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamAccess(teamId, { module: AppModule.FINANCE, level: AccessLevel.VIEW })

    const [invoices, payments, expenses, subscriptions, companySetting] = await Promise.all([
      db.invoice.findMany({ where: { teamId } }),
      db.payment.findMany({ where: { teamId } }),
      db.expense.findMany({ where: { teamId } }),
      db.toolSubscription.findMany({ where: { teamId, status: "active" } }),
      db.companySetting.findUnique({ where: { teamId }, select: { currency: true } }),
    ])

    const currency = companySetting?.currency || "INR"
    const now = new Date()

    let totalInvoiced = 0
    let totalCollected = 0
    let totalOverdue = 0
    let paidInvoicesCount = 0
    let pendingInvoicesCount = 0

    invoices.forEach((inv) => {
      totalInvoiced += inv.grandTotal
      totalCollected += inv.amountPaid

      const isOverdue = inv.balanceDue > 0 && new Date(inv.dueDate) < now
      if (isOverdue) {
        totalOverdue += inv.balanceDue
      }

      if (inv.status === "PAID") {
        paidInvoicesCount++
      } else if (inv.status !== "CANCELLED") {
        pendingInvoicesCount++
      }
    })

    // Calculate Monthly Burn
    let monthlySaaSExpenses = 0
    subscriptions.forEach((sub) => {
      if (sub.billingCycle === "monthly") {
        monthlySaaSExpenses += sub.cost
      } else {
        monthlySaaSExpenses += Math.round(sub.cost / 12)
      }
    })

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const recentExpenses = expenses.filter((e) => new Date(e.expenseDate) >= thirtyDaysAgo)
    const monthlyVariableExpenses = recentExpenses.reduce((sum, e) => sum + e.amount, 0)
    const monthlyBurn = monthlySaaSExpenses + monthlyVariableExpenses

    // Runway calculation in months (based on collected cash balance vs monthly burn)
    const estimatedCashReserves = Math.max(totalCollected * 0.4, 500000)
    const runwayMonths = monthlyBurn > 0 ? (estimatedCashReserves / monthlyBurn).toFixed(1) : "12.0"

    return NextResponse.json({
      currency,
      summary: {
        totalInvoiced,
        totalCollected,
        outstandingBalance: totalInvoiced - totalCollected,
        totalOverdue,
        totalInvoices: invoices.length,
        paidInvoicesCount,
        pendingInvoicesCount,
        monthlyBurn,
        monthlySaaSExpenses,
        runwayMonths: Number(runwayMonths),
        estimatedCashReserves,
      },
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
