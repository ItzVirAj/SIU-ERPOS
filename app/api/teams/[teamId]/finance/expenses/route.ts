import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { handleRouteError } from "@/lib/authz";
import { db } from "@/lib/db"

const createExpenseSchema = z.object({
  vendorName: z.string().min(1).max(200),
  category: z.string().default("SOFTWARE_SAAS"),
  amount: z.number().positive(),
  currency: z.string().default("INR"),
  expenseDate: z.union([z.string(), z.date()]).optional(),
  projectId: z.string().nullable().optional(),
  isBillable: z.boolean().default(false),
  notes: z.string().nullable().optional(),
}).strict()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamAccess(teamId, { module: AppModule.FINANCE, level: AccessLevel.VIEW })

    const expenses = await db.expense.findMany({
      where: { teamId },
      include: {
        project: { select: { id: true, name: true, key: true } },
      },
      orderBy: { expenseDate: "desc" },
    })

    // Category breakdown
    const categoryTotals: Record<string, number> = {}
    let totalExpenseAmount = 0

    expenses.forEach((e) => {
      totalExpenseAmount += e.amount
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount
    })

    const categoryData = Object.entries(categoryTotals).map(([cat, total]) => ({
      category: cat.replace("_", " "),
      amount: total,
    }))

    return NextResponse.json({
      expenses,
      summary: {
        totalExpenseAmount,
        expenseCount: expenses.length,
      },
      categoryData,
    })
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
    await requireTeamAccess(teamId, { module: AppModule.FINANCE, level: AccessLevel.WRITE })

    const rawBody = await request.json()
    const {
      vendorName,
      category,
      amount,
      currency,
      expenseDate = new Date(),
      projectId,
      isBillable,
      notes,
    } = createExpenseSchema.parse(rawBody)

    const expense = await db.expense.create({
      data: {
        teamId,
        vendorName: vendorName.trim(),
        category,
        amount,
        currency,
        expenseDate: new Date(expenseDate),
        projectId: projectId || null,
        isBillable,
        notes: notes?.trim() || null,
        paymentStatus: "PAID",
      },
    })

    return NextResponse.json({ expense }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
