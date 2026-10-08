"use client"

import React, { useState } from "react"
import { useActiveTeam } from "@/lib/context/team-context"
import {
  useFinanceOverview,
  useInvoices,
  useCreateInvoice,
  useUpdateInvoiceStatus,
  useDeleteInvoice,
  useRecordPayment,
  usePayments,
  useExpenses,
  useCreateExpense,
  useSubscriptions,
  useCreateSubscription,
  useReceivables,
  useTaxSummary,
  useFinanceClients,
  InvoiceRecord,
} from "@/lib/hooks/use-finance"
import { useProjects } from "@/lib/hooks/use-projects"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  CreditCard,
  FileText,
  DollarSign,
  TrendingDown,
  Clock,
  Plus,
  Printer,
  Download,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  Search,
  ExternalLink,
  Trash2,
  Copy,
  Building2,
  ShieldCheck,
  Send,
  Zap,
} from "lucide-react"
import { toast } from "sonner"

function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-"
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function FinanceConsole() {
  const { teamId: activeTeamId } = useActiveTeam()
  const teamId = activeTeamId || ""

  // Queries
  const { data: overviewData, isLoading: loadingOverview } = useFinanceOverview(teamId)
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("ALL")
  const { data: invoicesData, isLoading: loadingInvoices } = useInvoices(teamId, invoiceStatusFilter)
  const { data: paymentsData, isLoading: loadingPayments } = usePayments(teamId)
  const { data: expensesData, isLoading: loadingExpenses } = useExpenses(teamId)
  const { data: subscriptionsData, isLoading: loadingSubs } = useSubscriptions(teamId)
  const { data: receivablesData, isLoading: loadingReceivables } = useReceivables(teamId)
  const { data: taxSummaryData, isLoading: loadingTax } = useTaxSummary(teamId)
  const { data: clientsData } = useFinanceClients(teamId)
  const { data: projectsData } = useProjects(teamId)

  // Mutations
  const createInvoiceMutation = useCreateInvoice(teamId)
  const updateStatusMutation = useUpdateInvoiceStatus(teamId)
  const deleteInvoiceMutation = useDeleteInvoice(teamId)
  const recordPaymentMutation = useRecordPayment(teamId)
  const createExpenseMutation = useCreateExpense(teamId)
  const createSubMutation = useCreateSubscription(teamId)

  // Modals state
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false)
  const [selectedInvoiceForView, setSelectedInvoiceForView] = useState<InvoiceRecord | null>(null)
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<InvoiceRecord | null>(null)
  const [logExpenseOpen, setLogExpenseOpen] = useState(false)
  const [addSubOpen, setAddSubOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Form states: Create Invoice
  const [invClientId, setInvClientId] = useState("")
  const [invProjectId, setInvProjectId] = useState("NONE")
  const [invSupplyType, setInvSupplyType] = useState<"INTRA_STATE" | "INTER_STATE" | "EXPORT">("INTRA_STATE")
  const [invDueDateDays, setInvDueDateDays] = useState("15")
  const [invNotes, setInvNotes] = useState("Payment is due within 15 days of invoice date. Bank NEFT/RTGS details specified on footer.")
  const [invItems, setInvItems] = useState([
    { description: "Full-Stack Web & AI Engineering Services", sacCode: "998314", quantity: 1, unitPrice: 150000 },
  ])

  // Form states: Record Payment
  const [payAmount, setPayAmount] = useState<number>(0)
  const [payMethod, setPayMethod] = useState("BANK_TRANSFER")
  const [payReference, setPayReference] = useState("")
  const [payNotes, setPayNotes] = useState("")

  // Form states: Log Expense
  const [expVendor, setExpVendor] = useState("")
  const [expCategory, setExpCategory] = useState("CLOUD_HOSTING")
  const [expAmount, setExpAmount] = useState<number>(0)
  const [expBillable, setExpBillable] = useState(false)
  const [expProjectId, setExpProjectId] = useState("NONE")
  const [expDescription, setExpDescription] = useState("")

  // Form states: Add Subscription
  const [subName, setSubName] = useState("")
  const [subCategory, setSubCategory] = useState("DEVELOPER_TOOLS")
  const [subCost, setSubCost] = useState<number>(0)
  const [subCycle, setSubCycle] = useState<"monthly" | "annually">("monthly")
  const [subRenewalDays, setSubRenewalDays] = useState("30")
  const [subOwner, setSubOwner] = useState("")

  // Calculations for Create Invoice
  const calculatedSubtotal = invItems.reduce((acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0)
  const calculatedTaxRate = invSupplyType === "EXPORT" ? 0 : 0.18
  const calculatedTax = Math.round(calculatedSubtotal * calculatedTaxRate)
  const calculatedGrandTotal = calculatedSubtotal + calculatedTax

  const handleAddItem = () => {
    setInvItems([...invItems, { description: "", sacCode: "998314", quantity: 1, unitPrice: 0 }])
  }

  const handleRemoveItem = (index: number) => {
    if (invItems.length === 1) return
    setInvItems(invItems.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: string, value: any) => {
    const next = [...invItems]
    next[index] = { ...next[index], [field]: value }
    setInvItems(next)
  }

  const handleCreateInvoice = async () => {
    if (!invClientId) {
      toast.error("Please select a client")
      return
    }
    if (invItems.length === 0 || !invItems[0].description) {
      toast.error("Please provide at least one line item with description")
      return
    }

    const now = new Date()
    const due = new Date(now.getTime() + parseInt(invDueDateDays) * 24 * 60 * 60 * 1000)

    await createInvoiceMutation.mutateAsync({
      clientId: invClientId,
      projectId: invProjectId === "NONE" ? undefined : invProjectId,
      issueDate: now.toISOString(),
      dueDate: due.toISOString(),
      supplyType: invSupplyType,
      notes: invNotes,
      items: invItems.map((it) => ({
        description: it.description,
        sacCode: it.sacCode,
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice) || 0,
      })),
    })

    setCreateInvoiceOpen(false)
  }

  const handleRecordPayment = async () => {
    if (!paymentModalInvoice) return
    if (!payAmount || payAmount <= 0) {
      toast.error("Please enter a valid amount")
      return
    }

    await recordPaymentMutation.mutateAsync({
      invoiceId: paymentModalInvoice.id,
      amount: payAmount,
      paymentMethod: payMethod,
      referenceNumber: payReference,
      notes: payNotes,
    })

    setPaymentModalInvoice(null)
    setPayAmount(0)
    setPayReference("")
    setPayNotes("")
  }

  const handleLogExpense = async () => {
    if (!expVendor || !expAmount) {
      toast.error("Vendor and amount are required")
      return
    }

    await createExpenseMutation.mutateAsync({
      vendorName: expVendor,
      category: expCategory,
      amount: expAmount,
      isBillable: expBillable,
      projectId: expProjectId === "NONE" ? undefined : expProjectId,
      description: expDescription,
    })

    setLogExpenseOpen(false)
    setExpVendor("")
    setExpAmount(0)
    setExpDescription("")
  }

  const handleAddSubscription = async () => {
    if (!subName || !subCost) {
      toast.error("Tool name and cost are required")
      return
    }

    const renewal = new Date(Date.now() + parseInt(subRenewalDays) * 24 * 60 * 60 * 1000)

    await createSubMutation.mutateAsync({
      name: subName,
      category: subCategory,
      cost: subCost,
      billingCycle: subCycle,
      renewalDate: renewal.toISOString(),
      ownerName: subOwner || undefined,
    })

    setAddSubOpen(false)
    setSubName("")
    setSubCost(0)
  }

  const summary = overviewData?.summary
  const filteredInvoices = (invoicesData?.invoices || []).filter((inv) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.client.name.toLowerCase().includes(q) ||
      (inv.client.company && inv.client.company.toLowerCase().includes(q))
    )
  })

  return (
    <div className="flex-1 space-y-6 p-6 max-w-7xl mx-auto">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-primary" />
              Finance, Invoicing & GST
            </h1>
            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
              Module 6.10 FIN • Live Ledger
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Indian GST invoicing engine (SAC 998314), client receivables ageing, expense burn, and SaaS subscription register.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setCreateInvoiceOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium shadow-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create GST Invoice
          </Button>
          <Button
            variant="outline"
            onClick={() => setLogExpenseOpen(true)}
            className="text-sm border-border/60 hover:bg-muted/50 flex items-center gap-2"
          >
            <DollarSign className="w-4 h-4 text-amber-400" />
            Log Expense
          </Button>
        </div>
      </div>

      {/* Financial Executive KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Total Invoiced</span>
              <FileText className="w-4 h-4 text-blue-400" />
            </div>
            <div className="mt-2 text-xl font-bold text-foreground">
              {summary ? formatINR(summary.totalInvoiced) : "₹0"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {summary ? `${summary.totalInvoices} lifetime invoices` : "0 invoices"}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Total Collected</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-xl font-bold text-emerald-400">
              {summary ? formatINR(summary.totalCollected) : "₹0"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {summary ? `${summary.paidInvoicesCount} fully cleared` : "0 cleared"}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Outstanding / Overdue</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="mt-2 text-xl font-bold text-rose-400">
              {summary ? formatINR(summary.outstandingBalance) : "₹0"}
            </div>
            <div className="text-xs text-rose-400/80 mt-1">
              {summary && summary.totalOverdue > 0 ? `${formatINR(summary.totalOverdue)} overdue` : "0 overdue risk"}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Monthly Burn</span>
              <TrendingDown className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2 text-xl font-bold text-amber-400">
              {summary ? formatINR(summary.monthlyBurn) : "₹0"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              SaaS: {summary ? formatINR(summary.monthlySaaSExpenses) : "₹0"}/mo
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Runway Horizon</span>
              <Clock className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="mt-2 text-xl font-bold text-indigo-400">
              {summary ? `${summary.runwayMonths} Months` : "12.0 Months"}
            </div>
            <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Healthy Cash Reserves
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Multi-Tab Navigation */}
      <Tabs defaultValue="invoices" className="space-y-6">
        <TabsList className="bg-muted/40 p-1 border border-border/40 grid grid-cols-2 md:grid-cols-5 w-full">
          <TabsTrigger value="invoices" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Invoices & GST
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Payments & Receipts
          </TabsTrigger>
          <TabsTrigger value="receivables" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Receivables Ageing
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Expenses & Burn
          </TabsTrigger>
          <TabsTrigger value="saas-tax" className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            SaaS & Tax Export
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: INVOICES & GST */}
        <TabsContent value="invoices" className="space-y-4">
          <Card className="bg-card/60 border-border/50">
            <CardHeader className="p-4 pb-2 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold">Invoices & GST Invoicing</CardTitle>
                <CardDescription className="text-xs">
                  Issue sequential GST tax invoices, track payment status, and download compliant invoices.
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative w-48 md:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Search invoice or client..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 text-xs h-8 bg-background/50"
                  />
                </div>
                <Select value={invoiceStatusFilter} onValueChange={setInvoiceStatusFilter}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Status</SelectItem>
                    <SelectItem value="SENT">Sent</SelectItem>
                    <SelectItem value="PAID">Paid</SelectItem>
                    <SelectItem value="PARTIALLY_PAID">Partial</SelectItem>
                    <SelectItem value="OVERDUE">Overdue</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="rounded-md border-t border-border/40 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/40 bg-muted/20 text-xs">
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Client & GSTIN</TableHead>
                      <TableHead>Issue / Due Date</TableHead>
                      <TableHead>Supply & Tax</TableHead>
                      <TableHead className="text-right">Grand Total</TableHead>
                      <TableHead className="text-right">Balance Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingInvoices ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">
                          Loading invoices...
                        </TableCell>
                      </TableRow>
                    ) : filteredInvoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">
                          No invoices found. Click "Create GST Invoice" to generate one.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredInvoices.map((inv) => {
                        const isOverdue = inv.balanceDue > 0 && new Date(inv.dueDate) < new Date()
                        return (
                          <TableRow key={inv.id} className="border-border/30 hover:bg-muted/10 text-xs">
                            <TableCell className="font-mono font-medium text-foreground">
                              {inv.invoiceNumber}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-foreground">{inv.client.name}</div>
                              {inv.client.company && (
                                <div className="text-[11px] text-muted-foreground">{inv.client.company}</div>
                              )}
                              {inv.client.gstin && (
                                <div className="text-[10px] font-mono text-muted-foreground">
                                  GST: {inv.client.gstin}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div>Issued: {formatDate(inv.issueDate)}</div>
                              <div className={isOverdue ? "text-rose-400 font-semibold" : "text-muted-foreground"}>
                                Due: {formatDate(inv.dueDate)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Badge variant="outline" className="text-[10px] px-1 py-0">
                                  {inv.supplyType === "INTRA_STATE" ? "Intra (9+9%)" : inv.supplyType === "INTER_STATE" ? "Inter (18%)" : "Export 0%"}
                                </Badge>
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                Tax: {formatINR(inv.taxTotal)}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-foreground">
                              {formatINR(inv.grandTotal)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {inv.balanceDue > 0 ? (
                                <span className={isOverdue ? "text-rose-400 font-bold" : "text-amber-400 font-medium"}>
                                  {formatINR(inv.balanceDue)}
                                </span>
                              ) : (
                                <span className="text-emerald-400 font-medium">₹0 (Paid)</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {inv.status === "PAID" && (
                                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                                  Paid
                                </Badge>
                              )}
                              {inv.status === "PARTIALLY_PAID" && (
                                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                                  Partial
                                </Badge>
                              )}
                              {inv.status === "SENT" && (
                                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">
                                  Sent
                                </Badge>
                              )}
                              {inv.status === "OVERDUE" && (
                                <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-[10px]">
                                  Overdue
                                </Badge>
                              )}
                              {inv.status === "DRAFT" && (
                                <Badge variant="outline" className="text-muted-foreground text-[10px]">
                                  Draft
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-primary hover:bg-primary/10"
                                  onClick={() => setSelectedInvoiceForView(inv)}
                                  title="View GST Tax Invoice"
                                >
                                  <Printer className="w-3.5 h-3.5 mr-1" />
                                  View
                                </Button>
                                {inv.balanceDue > 0 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                                    onClick={() => {
                                      setPaymentModalInvoice(inv)
                                      setPayAmount(inv.balanceDue)
                                    }}
                                  >
                                    Pay
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-400"
                                  onClick={() => {
                                    if (confirm(`Delete invoice ${inv.invoiceNumber}?`)) {
                                      deleteInvoiceMutation.mutate(inv.id)
                                    }
                                  }}
                                  title="Delete Invoice"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: PAYMENTS & RECEIPTS */}
        <TabsContent value="payments" className="space-y-4">
          <Card className="bg-card/60 border-border/50">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-semibold">Payment & Receipt Ledger</CardTitle>
              <CardDescription className="text-xs">
                Real-time record of all partial and full settlements with bank UTR and receipt numbering.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="rounded-md border-t border-border/40 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/40 bg-muted/20 text-xs">
                      <TableHead>Receipt #</TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead>UTR / Reference #</TableHead>
                      <TableHead>Date Cleared</TableHead>
                      <TableHead className="text-right">Amount Received</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingPayments ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                          Loading payments...
                        </TableCell>
                      </TableRow>
                    ) : (paymentsData?.payments || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                          No payments recorded yet. Click "Pay" on any invoice to record a payment.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (paymentsData?.payments || []).map((pay) => (
                        <TableRow key={pay.id} className="border-border/30 hover:bg-muted/10 text-xs">
                          <TableCell className="font-mono font-medium text-emerald-400">
                            {pay.receiptNumber}
                          </TableCell>
                          <TableCell className="font-mono text-foreground">
                            {pay.invoice?.invoiceNumber || "-"}
                          </TableCell>
                          <TableCell>
                            <span className="font-medium text-foreground">
                              {pay.invoice?.client?.name || "Client"}
                            </span>
                            {pay.invoice?.client?.company && (
                              <span className="text-[11px] text-muted-foreground block">
                                {pay.invoice?.client?.company}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {pay.paymentMethod.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground text-[11px]">
                            {pay.referenceNumber || "NEFT/IMPS"}
                          </TableCell>
                          <TableCell>{formatDate(pay.paymentDate)}</TableCell>
                          <TableCell className="text-right font-bold text-emerald-400 font-mono">
                            {formatINR(pay.amount)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: RECEIVABLES AGEING */}
        <TabsContent value="receivables" className="space-y-4">
          {receivablesData && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <Card className="bg-emerald-950/20 border-emerald-500/30">
                  <CardContent className="p-3">
                    <div className="text-[11px] text-emerald-400 font-medium">Current (Not Due)</div>
                    <div className="text-lg font-bold text-foreground mt-1">
                      {formatINR(receivablesData.buckets.current.amount)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {receivablesData.buckets.current.count} invoices
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-amber-950/20 border-amber-500/30">
                  <CardContent className="p-3">
                    <div className="text-[11px] text-amber-400 font-medium">1 - 30 Days Overdue</div>
                    <div className="text-lg font-bold text-amber-400 mt-1">
                      {formatINR(receivablesData.buckets.days1_30.amount)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {receivablesData.buckets.days1_30.count} invoices
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-orange-950/20 border-orange-500/30">
                  <CardContent className="p-3">
                    <div className="text-[11px] text-orange-400 font-medium">31 - 60 Days Overdue</div>
                    <div className="text-lg font-bold text-orange-400 mt-1">
                      {formatINR(receivablesData.buckets.days31_60.amount)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {receivablesData.buckets.days31_60.count} invoices
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-rose-950/20 border-rose-500/30">
                  <CardContent className="p-3">
                    <div className="text-[11px] text-rose-400 font-medium">61 - 90 Days Overdue</div>
                    <div className="text-lg font-bold text-rose-400 mt-1">
                      {formatINR(receivablesData.buckets.days61_90.amount)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {receivablesData.buckets.days61_90.count} invoices
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-red-950/30 border-red-600/40">
                  <CardContent className="p-3">
                    <div className="text-[11px] text-red-400 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-red-500" />
                      90+ Days Critical
                    </div>
                    <div className="text-lg font-bold text-red-400 mt-1">
                      {formatINR(receivablesData.buckets.days90_plus.amount)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {receivablesData.buckets.days90_plus.count} invoices
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Invoices list awaiting collection */}
              <Card className="bg-card/60 border-border/50">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base font-semibold">Unpaid Invoices by Overdue Severity</CardTitle>
                  <CardDescription className="text-xs">
                    Prioritized collection list with 1-click payment reminder generator.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="rounded-md border-t border-border/40 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/40 bg-muted/20 text-xs">
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Client & Contact</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Days Overdue</TableHead>
                          <TableHead className="text-right">Balance Due</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[
                          ...receivablesData.buckets.days90_plus.invoices,
                          ...receivablesData.buckets.days61_90.invoices,
                          ...receivablesData.buckets.days31_60.invoices,
                          ...receivablesData.buckets.days1_30.invoices,
                          ...receivablesData.buckets.current.invoices,
                        ].length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                              🎉 No outstanding receivables. All invoices are fully paid!
                            </TableCell>
                          </TableRow>
                        ) : (
                          [
                            ...receivablesData.buckets.days90_plus.invoices,
                            ...receivablesData.buckets.days61_90.invoices,
                            ...receivablesData.buckets.days31_60.invoices,
                            ...receivablesData.buckets.days1_30.invoices,
                            ...receivablesData.buckets.current.invoices,
                          ].map((item) => (
                            <TableRow key={item.id} className="border-border/30 hover:bg-muted/10 text-xs">
                              <TableCell className="font-mono font-medium">{item.invoiceNumber}</TableCell>
                              <TableCell>
                                <div className="font-medium text-foreground">{item.clientName}</div>
                                {item.company && <div className="text-[11px] text-muted-foreground">{item.company}</div>}
                              </TableCell>
                              <TableCell>{formatDate(item.dueDate)}</TableCell>
                              <TableCell>
                                {item.daysOverdue > 0 ? (
                                  <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-[10px]">
                                    {item.daysOverdue} days overdue
                                  </Badge>
                                ) : (
                                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                                    Due soon
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold text-foreground">
                                {formatINR(item.balanceDue)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs border-border/60 hover:bg-muted/30"
                                  onClick={() => {
                                    const reminderText = `Dear ${item.clientName},\n\nThis is a polite reminder regarding Invoice ${item.invoiceNumber} for ${formatINR(item.balanceDue)}, which was due on ${formatDate(item.dueDate)}.\n\nPlease remit the balance to our bank account. Let us know if you need any clarifications.\n\nThank you,\nFinance Operations`
                                    navigator.clipboard.writeText(reminderText)
                                    toast.success(`Copied payment reminder notice for ${item.clientName}`)
                                  }}
                                >
                                  <Copy className="w-3 h-3 mr-1" />
                                  Copy Notice
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* TAB 4: EXPENSES & PROJECT COSTS */}
        <TabsContent value="expenses" className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Expenses & Project Cost Allocation</h2>
              <p className="text-xs text-muted-foreground">
                Track direct vendor expenses, hosting bills, and contractor costs attributed to projects.
              </p>
            </div>
            <Button
              onClick={() => setLogExpenseOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Log New Expense
            </Button>
          </div>

          <Card className="bg-card/60 border-border/50">
            <CardContent className="p-0">
              <div className="rounded-md border-t border-border/40 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/40 bg-muted/20 text-xs">
                      <TableHead>Vendor</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Project Attribution</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Billable</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingExpenses ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                          Loading expenses...
                        </TableCell>
                      </TableRow>
                    ) : (expensesData?.expenses || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                          No expenses recorded yet. Click "Log New Expense" above.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (expensesData?.expenses || []).map((exp) => (
                        <TableRow key={exp.id} className="border-border/30 hover:bg-muted/10 text-xs">
                          <TableCell className="font-semibold text-foreground">{exp.vendorName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {exp.category.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-[11px]">
                            {exp.description || "-"}
                          </TableCell>
                          <TableCell>
                            {exp.project ? (
                              <Badge variant="secondary" className="text-[10px] font-mono">
                                {exp.project.name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">General Overhead</span>
                            )}
                          </TableCell>
                          <TableCell>{formatDate(exp.expenseDate)}</TableCell>
                          <TableCell>
                            {exp.isBillable ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                                Billable
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-[10px]">Non-billable</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-foreground">
                            {formatINR(exp.amount)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: SAAS REGISTER & TAX EXPORT */}
        <TabsContent value="saas-tax" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SaaS Subscriptions Registry */}
            <Card className="bg-card/60 border-border/50">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">SaaS Tool Subscriptions</CardTitle>
                  <CardDescription className="text-xs">
                    Agency software renewals, recurring cloud seats, and renewal countdowns.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => setAddSubOpen(true)}
                  className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Tool
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="rounded-md border-t border-border/40 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/40 bg-muted/20 text-xs">
                        <TableHead>Tool Name</TableHead>
                        <TableHead>Billing Cycle</TableHead>
                        <TableHead>Renewal</TableHead>
                        <TableHead className="text-right">Monthly Burn</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingSubs ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground">
                            Loading tools...
                          </TableCell>
                        </TableRow>
                      ) : (subscriptionsData?.subscriptions || []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground">
                            No SaaS tools registered.
                          </TableCell>
                        </TableRow>
                      ) : (
                        (subscriptionsData?.subscriptions || []).map((sub) => (
                          <TableRow key={sub.id} className="border-border/30 text-xs">
                            <TableCell>
                              <div className="font-medium text-foreground">{sub.name}</div>
                              <div className="text-[10px] text-muted-foreground">{sub.category.replace("_", " ")}</div>
                            </TableCell>
                            <TableCell className="capitalize">{sub.billingCycle}</TableCell>
                            <TableCell>
                              <div>{formatDate(sub.renewalDate)}</div>
                              <div className="text-[10px] text-amber-400">
                                in {sub.daysUntilRenewal} days
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold text-foreground">
                              {formatINR(sub.monthlyNormalizedCost)}/mo
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Indian GST Tax Filing Helper */}
            <Card className="bg-card/60 border-border/50">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Indian GST Summary & Export</CardTitle>
                  <CardDescription className="text-xs">
                    Monthly GSTR-1 preparation data and direct CSV ledger download.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                  onClick={() => {
                    window.open(`/api/teams/${teamId}/finance/tax-summary?format=csv`, "_blank")
                  }}
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Download CSV
                </Button>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {taxSummaryData && (
                  <>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-muted/20 rounded border border-border/30">
                        <div className="text-muted-foreground">Total Taxable Value</div>
                        <div className="text-base font-bold text-foreground mt-0.5">
                          {formatINR(taxSummaryData.totals.taxableValue)}
                        </div>
                      </div>
                      <div className="p-3 bg-emerald-950/20 rounded border border-emerald-500/30">
                        <div className="text-emerald-400">Total GST Collected</div>
                        <div className="text-base font-bold text-emerald-400 mt-0.5">
                          {formatINR(taxSummaryData.totals.totalTax)}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="text-muted-foreground font-medium">Monthly Breakdown:</div>
                      <div className="rounded border border-border/30 overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-border/30 bg-muted/20 text-[11px]">
                              <TableHead>Month</TableHead>
                              <TableHead className="text-right">Taxable</TableHead>
                              <TableHead className="text-right">CGST</TableHead>
                              <TableHead className="text-right">SGST</TableHead>
                              <TableHead className="text-right">Total Tax</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {taxSummaryData.monthlyBreakdown.map((row) => (
                              <TableRow key={row.month} className="border-border/30 text-[11px]">
                                <TableCell className="font-medium">{row.month}</TableCell>
                                <TableCell className="text-right">{formatINR(row.taxable)}</TableCell>
                                <TableCell className="text-right">{formatINR(row.cgst)}</TableCell>
                                <TableCell className="text-right">{formatINR(row.sgst)}</TableCell>
                                <TableCell className="text-right font-bold text-emerald-400">
                                  {formatINR(row.totalTax)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* MODAL 1: CREATE GST INVOICE */}
      <Dialog open={createInvoiceOpen} onOpenChange={setCreateInvoiceOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Create GST Tax Invoice
            </DialogTitle>
            <DialogDescription className="text-xs">
              Generate an official Indian GST compliant invoice with SAC codes and automatic CGST/SGST/IGST calculation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Select Client *</Label>
                <Select value={invClientId} onValueChange={setInvClientId}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="Choose a client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(clientsData?.clients || []).map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.name} {c.company ? `(${c.company})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Linked Project (Optional)</Label>
                <Select value={invProjectId} onValueChange={setInvProjectId}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="Select project..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE" className="text-xs">None / General</SelectItem>
                    {(projectsData || []).map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">GST Supply Type *</Label>
                <Select
                  value={invSupplyType}
                  onValueChange={(val: any) => setInvSupplyType(val)}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INTRA_STATE" className="text-xs">
                      Intra-state (CGST 9% + SGST 9%)
                    </SelectItem>
                    <SelectItem value="INTER_STATE" className="text-xs">
                      Inter-state (IGST 18%)
                    </SelectItem>
                    <SelectItem value="EXPORT" className="text-xs">
                      Export of Services (0% LUT)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Payment Due Days</Label>
                <Select value={invDueDateDays} onValueChange={setInvDueDateDays}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7" className="text-xs">Net 7 Days</SelectItem>
                    <SelectItem value="15" className="text-xs">Net 15 Days</SelectItem>
                    <SelectItem value="30" className="text-xs">Net 30 Days</SelectItem>
                    <SelectItem value="45" className="text-xs">Net 45 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Line Items Builder */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Service Line Items (SAC 998314)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddItem}
                  className="h-7 text-xs text-primary"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Line
                </Button>
              </div>

              <div className="space-y-2">
                {invItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-muted/20 p-2 rounded border border-border/30">
                    <div className="flex-1">
                      <Input
                        placeholder="Item Description"
                        value={item.description}
                        onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                        className="text-xs h-8"
                      />
                    </div>
                    <div className="w-24">
                      <Input
                        placeholder="SAC Code"
                        value={item.sacCode || "998314"}
                        onChange={(e) => handleItemChange(idx, "sacCode", e.target.value)}
                        className="text-xs h-8 font-mono"
                      />
                    </div>
                    <div className="w-16">
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                        className="text-xs h-8"
                      />
                    </div>
                    <div className="w-28">
                      <Input
                        type="number"
                        placeholder="Rate (₹)"
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                        className="text-xs h-8 font-mono"
                      />
                    </div>
                    {invItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(idx)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Calculation Totals Card */}
            <div className="bg-muted/30 p-3 rounded border border-border/40 space-y-1 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal Taxable Value:</span>
                <span className="font-mono font-medium text-foreground">{formatINR(calculatedSubtotal)}</span>
              </div>
              {invSupplyType === "INTRA_STATE" && (
                <>
                  <div className="flex justify-between text-muted-foreground">
                    <span>CGST (9%):</span>
                    <span className="font-mono">{formatINR(Math.round(calculatedTax / 2))}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>SGST (9%):</span>
                    <span className="font-mono">{formatINR(Math.round(calculatedTax / 2))}</span>
                  </div>
                </>
              )}
              {invSupplyType === "INTER_STATE" && (
                <div className="flex justify-between text-muted-foreground">
                  <span>IGST (18%):</span>
                  <span className="font-mono">{formatINR(calculatedTax)}</span>
                </div>
              )}
              {invSupplyType === "EXPORT" && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Export LUT (0%):</span>
                  <span className="font-mono">₹0</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-border/40 font-bold text-foreground text-sm">
                <span>Grand Total:</span>
                <span className="font-mono text-emerald-400">{formatINR(calculatedGrandTotal)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes & Bank Remittance Instructions</Label>
              <Textarea
                value={invNotes}
                onChange={(e) => setInvNotes(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateInvoiceOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleCreateInvoice}
              disabled={createInvoiceMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
            >
              {createInvoiceMutation.isPending ? "Generating..." : "Generate Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: RECORD PAYMENT */}
      <Dialog open={!!paymentModalInvoice} onOpenChange={(open) => !open && setPaymentModalInvoice(null)}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-400" />
              Record Client Payment
            </DialogTitle>
            <DialogDescription className="text-xs">
              Record full or partial settlement against {paymentModalInvoice?.invoiceNumber}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-muted/20 rounded border border-border/30 space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Client:</span>
                <span className="font-medium text-foreground">{paymentModalInvoice?.client.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Grand Total:</span>
                <span className="font-mono">{formatINR(paymentModalInvoice?.grandTotal || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Already Paid:</span>
                <span className="font-mono text-emerald-400">{formatINR(paymentModalInvoice?.amountPaid || 0)}</span>
              </div>
              <div className="flex justify-between font-bold text-foreground">
                <span>Remaining Due:</span>
                <span className="font-mono text-rose-400">{formatINR(paymentModalInvoice?.balanceDue || 0)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Payment Amount (₹) *</Label>
              <Input
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(Number(e.target.value))}
                className="text-xs font-mono h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Payment Method</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK_TRANSFER" className="text-xs">Bank Transfer (NEFT/RTGS/IMPS)</SelectItem>
                  <SelectItem value="UPI" className="text-xs">UPI QR Code</SelectItem>
                  <SelectItem value="CHEQUE" className="text-xs">Cheque / Demand Draft</SelectItem>
                  <SelectItem value="STRIPE" className="text-xs">Stripe / International Wire</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Bank UTR / Transaction Reference Number</Label>
              <Input
                placeholder="e.g. UTR1234567890AX"
                value={payReference}
                onChange={(e) => setPayReference(e.target.value)}
                className="text-xs font-mono h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes / Remarks</Label>
              <Input
                placeholder="e.g. Cleared via HDFC Bank"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                className="text-xs h-9"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPaymentModalInvoice(null)} className="text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleRecordPayment}
              disabled={recordPaymentMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            >
              {recordPaymentMutation.isPending ? "Recording..." : "Record & Issue Receipt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: VIEW / PRINT GST TAX INVOICE */}
      <Dialog open={!!selectedInvoiceForView} onOpenChange={(open) => !open && setSelectedInvoiceForView(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-border text-foreground">
          {selectedInvoiceForView && (
            <div className="p-4 space-y-6 text-xs">
              {/* Invoice Header */}
              <div className="flex justify-between items-start border-b border-border/40 pb-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-primary" />
                    TAX INVOICE
                  </h2>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Original for Recipient • GSTIN: 27AABCS1429B1ZX
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    State: Maharashtra (27) • SAC Code: 998314
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold font-mono text-primary">
                    {selectedInvoiceForView.invoiceNumber}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Date: {formatDate(selectedInvoiceForView.issueDate)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Due: {formatDate(selectedInvoiceForView.dueDate)}
                  </div>
                  <Badge
                    className={`mt-1 text-[10px] ${
                      selectedInvoiceForView.status === "PAID"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-amber-500/20 text-amber-400"
                    }`}
                  >
                    {selectedInvoiceForView.status}
                  </Badge>
                </div>
              </div>

              {/* Bill To & Supply Info */}
              <div className="grid grid-cols-2 gap-4 bg-muted/20 p-3 rounded border border-border/30">
                <div>
                  <div className="font-semibold text-muted-foreground text-[11px]">Billed To:</div>
                  <div className="font-bold text-sm text-foreground mt-0.5">
                    {selectedInvoiceForView.client.name}
                  </div>
                  {selectedInvoiceForView.client.company && (
                    <div className="text-muted-foreground">{selectedInvoiceForView.client.company}</div>
                  )}
                  {selectedInvoiceForView.client.email && (
                    <div className="text-muted-foreground">{selectedInvoiceForView.client.email}</div>
                  )}
                  {selectedInvoiceForView.client.gstin && (
                    <div className="font-mono text-[11px] text-primary mt-1">
                      Client GSTIN: {selectedInvoiceForView.client.gstin}
                    </div>
                  )}
                </div>
                <div className="text-right space-y-1">
                  <div>
                    <span className="text-muted-foreground">Supply Type: </span>
                    <span className="font-semibold">{selectedInvoiceForView.supplyType}</span>
                  </div>
                  {selectedInvoiceForView.project && (
                    <div>
                      <span className="text-muted-foreground">Project: </span>
                      <span className="font-semibold">{selectedInvoiceForView.project.name}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Currency: </span>
                    <span className="font-semibold">{selectedInvoiceForView.currency}</span>
                  </div>
                </div>
              </div>

              {/* Itemized Table */}
              <div className="rounded border border-border/40 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/40 bg-muted/20 text-xs">
                      <TableHead>#</TableHead>
                      <TableHead>Service Description</TableHead>
                      <TableHead>SAC</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Unit Rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInvoiceForView.items.map((it, idx) => (
                      <TableRow key={idx} className="border-border/30 text-xs">
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell className="font-medium text-foreground">{it.description}</TableCell>
                        <TableCell className="font-mono text-muted-foreground">{it.sacCode || "998314"}</TableCell>
                        <TableCell className="text-center">{it.quantity}</TableCell>
                        <TableCell className="text-right font-mono">{formatINR(it.unitPrice)}</TableCell>
                        <TableCell className="text-right font-mono font-medium">{formatINR(it.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Tax Calculations */}
              <div className="flex justify-end">
                <div className="w-72 space-y-1.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Taxable Subtotal:</span>
                    <span className="font-mono">{formatINR(selectedInvoiceForView.subtotal)}</span>
                  </div>
                  {selectedInvoiceForView.cgstAmount > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>CGST (9%):</span>
                      <span className="font-mono">{formatINR(selectedInvoiceForView.cgstAmount)}</span>
                    </div>
                  )}
                  {selectedInvoiceForView.sgstAmount > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>SGST (9%):</span>
                      <span className="font-mono">{formatINR(selectedInvoiceForView.sgstAmount)}</span>
                    </div>
                  )}
                  {selectedInvoiceForView.igstAmount > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>IGST (18%):</span>
                      <span className="font-mono">{formatINR(selectedInvoiceForView.igstAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-foreground text-sm pt-1 border-t border-border/40">
                    <span>Grand Total:</span>
                    <span className="font-mono text-emerald-400">{formatINR(selectedInvoiceForView.grandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 pt-1">
                    <span>Amount Paid:</span>
                    <span className="font-mono font-semibold">{formatINR(selectedInvoiceForView.amountPaid)}</span>
                  </div>
                  <div className="flex justify-between text-rose-400 font-bold">
                    <span>Balance Due:</span>
                    <span className="font-mono">{formatINR(selectedInvoiceForView.balanceDue)}</span>
                  </div>
                </div>
              </div>

              {/* Remittance & Terms */}
              <div className="p-3 bg-muted/20 rounded border border-border/30 text-[11px] text-muted-foreground">
                <div className="font-semibold text-foreground mb-1">Bank Remittance Details:</div>
                <div>Bank: HDFC Bank Ltd • Branch: BKC Mumbai • Account: 50200088912345</div>
                <div>IFSC: HDFC0000240 • Account Name: SIU-ERPOS Systems Pvt Ltd</div>
                {selectedInvoiceForView.notes && (
                  <div className="mt-2 text-foreground font-medium">Notes: {selectedInvoiceForView.notes}</div>
                )}
              </div>

              <div className="flex justify-between items-center pt-2">
                <Button variant="outline" size="sm" onClick={() => window.print()} className="text-xs">
                  <Printer className="w-3.5 h-3.5 mr-1" />
                  Print / Save PDF
                </Button>
                <Button size="sm" onClick={() => setSelectedInvoiceForView(null)} className="text-xs">
                  Close Preview
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL 4: LOG EXPENSE */}
      <Dialog open={logExpenseOpen} onOpenChange={setLogExpenseOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-400" />
              Log Agency Expense
            </DialogTitle>
            <DialogDescription className="text-xs">
              Record hosting bills, software licenses, or project subcontractor disbursements.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs">Vendor Name *</Label>
              <Input
                placeholder="e.g. AWS Cloud, Vercel, Figma"
                value={expVendor}
                onChange={(e) => setExpVendor(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select value={expCategory} onValueChange={setExpCategory}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLOUD_HOSTING" className="text-xs">Cloud Hosting</SelectItem>
                    <SelectItem value="SOFTWARE_SUBSCRIPTION" className="text-xs">Software SaaS</SelectItem>
                    <SelectItem value="CONTRACTOR" className="text-xs">Subcontractor</SelectItem>
                    <SelectItem value="OFFICE" className="text-xs">Office & Admin</SelectItem>
                    <SelectItem value="HARDWARE" className="text-xs">Hardware / Device</SelectItem>
                    <SelectItem value="MARKETING" className="text-xs">Marketing & Ads</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Amount (₹) *</Label>
                <Input
                  type="number"
                  placeholder="e.g. 15000"
                  value={expAmount || ""}
                  onChange={(e) => setExpAmount(Number(e.target.value))}
                  className="text-xs font-mono h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Attribute to Project (Optional)</Label>
              <Select value={expProjectId} onValueChange={setExpProjectId}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Select project..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE" className="text-xs">General Overhead</SelectItem>
                  {(projectsData || []).map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Input
                placeholder="e.g. Monthly database instances & S3 storage"
                value={expDescription}
                onChange={(e) => setExpDescription(e.target.value)}
                className="text-xs h-9"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setLogExpenseOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleLogExpense}
              disabled={createExpenseMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
            >
              {createExpenseMutation.isPending ? "Logging..." : "Log Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 5: ADD SAAS SUBSCRIPTION */}
      <Dialog open={addSubOpen} onOpenChange={setAddSubOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              Add SaaS Subscription
            </DialogTitle>
            <DialogDescription className="text-xs">
              Track recurring software subscriptions and avoid surprise auto-renewals.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs">Tool Name *</Label>
              <Input
                placeholder="e.g. Cursor Pro, Linear, OpenAI API"
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Cost (₹) *</Label>
                <Input
                  type="number"
                  placeholder="e.g. 2000"
                  value={subCost || ""}
                  onChange={(e) => setSubCost(Number(e.target.value))}
                  className="text-xs font-mono h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Billing Cycle</Label>
                <Select value={subCycle} onValueChange={(val: any) => setSubCycle(val)}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly" className="text-xs">Monthly</SelectItem>
                    <SelectItem value="annually" className="text-xs">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Renewal in (Days)</Label>
                <Select value={subRenewalDays} onValueChange={setSubRenewalDays}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7" className="text-xs">7 Days</SelectItem>
                    <SelectItem value="15" className="text-xs">15 Days</SelectItem>
                    <SelectItem value="30" className="text-xs">30 Days</SelectItem>
                    <SelectItem value="60" className="text-xs">60 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Seat Owner / Lead</Label>
                <Input
                  placeholder="e.g. Tech Lead"
                  value={subOwner}
                  onChange={(e) => setSubOwner(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddSubOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleAddSubscription}
              disabled={createSubMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
            >
              {createSubMutation.isPending ? "Adding..." : "Add Subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
