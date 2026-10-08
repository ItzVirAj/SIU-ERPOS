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

    let expenses = await db.expense.findMany({
      where: { teamId },
      include: {
        project: { select: { id: true, name: true, key: true } },
      },
      orderBy: { expenseDate: "desc" },
    })

    // Auto-seed starter expenses if empty
    if (expenses.length === 0) {
      const now = new Date()
      await db.expense.createMany({
        data: [
          {
            teamId,
            vendorName: "Amazon Web Services",
            category: "CLOUD_HOSTING",
            amount: 14500,
            currency: "INR",
            expenseDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
            paymentStatus: "PAID",
            isBillable: false,
            notes: "Production EC2, S3 & RDS cloud infrastructure",
          },
          {
            teamId,
            vendorName: "Figma Inc",
            category: "SOFTWARE_SAAS",
            amount: 7200,
            currency: "INR",
            expenseDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
            paymentStatus: "PAID",
            isBillable: false,
            notes: "Organization design license for product sprint",
          },
          {
            teamId,
            vendorName: "Freelance 3D Specialist",
            category: "CONTRACTOR",
            amount: 35000,
            currency: "INR",
            expenseDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
            paymentStatus: "PAID",
            isBillable: true,
            notes: "Custom 3D visual assets for client web application",
          },
        ],
      })

      expenses = await db.expense.findMany({
        where: { teamId },
        include: {
          project: { select: { id: true, name: true, key: true } },
        },
        orderBy: { expenseDate: "desc" },
      })
    }

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
    console.error("Error fetching expenses:", error)
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 })
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
      vendorName,
      category = "SOFTWARE_SAAS",
      amount,
      currency = "INR",
      expenseDate = new Date(),
      projectId,
      isBillable = false,
      notes,
    } = body

    if (!vendorName || !amount || Number(amount) <= 0) {
      return NextResponse.json({ error: "Vendor name and valid amount are required" }, { status: 400 })
    }

    const expense = await db.expense.create({
      data: {
        teamId,
        vendorName: vendorName.trim(),
        category,
        amount: Number(amount),
        currency,
        expenseDate: new Date(expenseDate),
        projectId: projectId || null,
        isBillable: Boolean(isBillable),
        notes: notes?.trim() || null,
        paymentStatus: "PAID",
      },
    })

    return NextResponse.json({ expense })
  } catch (error) {
    console.error("Error creating expense:", error)
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 })
  }
}
