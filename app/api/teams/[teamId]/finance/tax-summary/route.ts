import { NextRequest, NextResponse } from "next/server"
import { requireTeamMember, handleRouteError } from "@/lib/authz"
import { db } from "@/lib/db"

function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""'
  const str = String(val)
  return `"${str.replace(/"/g, '""')}"`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamMember(teamId)

    const { searchParams } = new URL(request.url)
    const format = searchParams.get("format")

    const [invoices, companySetting] = await Promise.all([
      db.invoice.findMany({
        where: { teamId, status: { not: "CANCELLED" } },
        include: { client: { select: { name: true, gstin: true } } },
        orderBy: { issueDate: "desc" },
      }),
      db.companySetting.findUnique({
        where: { teamId },
      }),
    ])

    let totalTaxableValue = 0
    let totalCgst = 0
    let totalSgst = 0
    let totalIgst = 0
    let totalTax = 0

    // Monthly breakdown
    const monthlyMap: Record<
      string,
      {
        month: string
        taxable: number
        cgst: number
        sgst: number
        igst: number
        totalTax: number
        count: number
      }
    > = {}

    invoices.forEach((inv) => {
      const taxable = inv.subtotal - inv.discount
      totalTaxableValue += taxable
      totalCgst += inv.cgstAmount
      totalSgst += inv.sgstAmount
      totalIgst += inv.igstAmount
      totalTax += inv.taxTotal

      const d = new Date(inv.issueDate)
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const monthLabel = d.toLocaleString("default", { month: "short", year: "numeric" })

      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = {
          month: monthLabel,
          taxable: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          totalTax: 0,
          count: 0,
        }
      }

      monthlyMap[monthKey].taxable += taxable
      monthlyMap[monthKey].cgst += inv.cgstAmount
      monthlyMap[monthKey].sgst += inv.sgstAmount
      monthlyMap[monthKey].igst += inv.igstAmount
      monthlyMap[monthKey].totalTax += inv.taxTotal
      monthlyMap[monthKey].count++
    })

    const monthlyBreakdown = Object.values(monthlyMap)

    if (format === "csv") {
      const headers = [
        "Invoice Number",
        "Issue Date",
        "Client Name",
        "Client GSTIN",
        "Supply Type",
        "Taxable Value",
        "CGST (9%)",
        "SGST (9%)",
        "IGST (18%)",
        "Total Tax",
        "Grand Total",
        "Status",
      ]

      const rows = invoices.map((inv) => [
        inv.invoiceNumber,
        new Date(inv.issueDate).toISOString().split("T")[0],
        inv.client.name,
        inv.client.gstin || "Unregistered",
        inv.supplyType,
        inv.subtotal - inv.discount,
        inv.cgstAmount,
        inv.sgstAmount,
        inv.igstAmount,
        inv.taxTotal,
        inv.grandTotal,
        inv.status,
      ])

      const csvContent = [
        headers.map(escapeCsvCell).join(","),
        ...rows.map((row) => row.map(escapeCsvCell).join(",")),
      ].join("\n")

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="gst_summary_${teamId}_${new Date().toISOString().split("T")[0]}.csv"`,
        },
      })
    }

    return NextResponse.json({
      supplierGstin: companySetting?.gstin || "27AAACS1429B1ZB",
      companyName: companySetting?.companyName || "SketchItUp Technologies",
      summary: {
        totalTaxableValue,
        totalCgst,
        totalSgst,
        totalIgst,
        totalTax,
        invoicesCount: invoices.length,
      },
      monthlyBreakdown,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
