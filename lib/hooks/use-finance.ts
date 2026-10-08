import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

export interface InvoiceItem {
  id?: string
  description: string
  sacCode?: string | null
  quantity: number
  unitPrice: number
  amount: number
}

export interface PaymentItem {
  id: string
  receiptNumber: string
  amount: number
  currency: string
  paymentDate: string
  paymentMethod: string
  referenceNumber?: string | null
  notes?: string | null
  invoice?: {
    id: string
    invoiceNumber: string
    client?: {
      id: string
      name: string
      company?: string | null
      email?: string | null
    } | null
  } | null
}

export interface InvoiceRecord {
  id: string
  teamId: string
  clientId: string
  projectId?: string | null
  invoiceNumber: string
  status: "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED"
  issueDate: string
  dueDate: string
  currency: string
  subtotal: number
  discount: number
  taxTotal: number
  grandTotal: number
  amountPaid: number
  balanceDue: number
  notes?: string | null
  terms?: string | null
  supplyType: "INTRA_STATE" | "INTER_STATE" | "EXPORT"
  cgstRate: number
  cgstAmount: number
  sgstRate: number
  sgstAmount: number
  igstRate: number
  igstAmount: number
  client: {
    id: string
    name: string
    company?: string | null
    email?: string | null
    gstin?: string | null
  }
  project?: {
    id: string
    name: string
    key: string
  } | null
  items: InvoiceItem[]
  payments?: PaymentItem[]
  createdAt: string
  updatedAt: string
}

export interface FinanceSummary {
  totalInvoiced: number
  totalCollected: number
  outstandingBalance: number
  totalOverdue: number
  totalInvoices: number
  paidInvoicesCount: number
  pendingInvoicesCount: number
  monthlyBurn: number
  monthlySaaSExpenses: number
  runwayMonths: number
  estimatedCashReserves: number
}

export interface ExpenseRecord {
  id: string
  vendorName: string
  category: string
  description?: string | null
  amount: number
  currency: string
  expenseDate: string
  paymentStatus: "PAID" | "PENDING"
  isBillable: boolean
  receiptUrl?: string | null
  projectId?: string | null
  project?: {
    id: string
    name: string
    key: string
  } | null
  createdAt: string
}

export interface ToolSubscriptionRecord {
  id: string
  name: string
  category: string
  cost: number
  currency: string
  billingCycle: string
  renewalDate: string
  ownerName?: string | null
  status: string
  daysUntilRenewal: number
  monthlyNormalizedCost: number
}

export interface ReceivablesBuckets {
  current: { label: string; count: number; amount: number; invoices: any[] }
  days1_30: { label: string; count: number; amount: number; invoices: any[] }
  days31_60: { label: string; count: number; amount: number; invoices: any[] }
  days61_90: { label: string; count: number; amount: number; invoices: any[] }
  days90_plus: { label: string; count: number; amount: number; invoices: any[] }
}

export interface TaxSummaryResponse {
  totals: {
    taxableValue: number
    cgst: number
    sgst: number
    igst: number
    totalTax: number
    companyGstin: string
    pan: string
  }
  monthlyBreakdown: Array<{
    month: string
    taxable: number
    cgst: number
    sgst: number
    igst: number
    totalTax: number
    invoiceCount: number
  }>
  invoicesCount: number
}

export function useFinanceOverview(teamId: string) {
  return useQuery<{ currency: string; summary: FinanceSummary }>({
    queryKey: ["finance-overview", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/finance/overview`)
      if (!res.ok) throw new Error("Failed to load finance overview")
      return res.json()
    },
    enabled: !!teamId,
  })
}

export function useInvoices(teamId: string, status?: string) {
  return useQuery<{ invoices: InvoiceRecord[] }>({
    queryKey: ["finance-invoices", teamId, status],
    queryFn: async () => {
      const url = status && status !== "ALL"
        ? `/api/teams/${teamId}/finance/invoices?status=${status}`
        : `/api/teams/${teamId}/finance/invoices`
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to load invoices")
      return res.json()
    },
    enabled: !!teamId,
  })
}

export function useInvoiceDetails(teamId: string, invoiceId?: string) {
  return useQuery<{ invoice: InvoiceRecord }>({
    queryKey: ["finance-invoice-detail", teamId, invoiceId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/finance/invoices/${invoiceId}`)
      if (!res.ok) throw new Error("Failed to load invoice details")
      return res.json()
    },
    enabled: !!teamId && !!invoiceId,
  })
}

export function useCreateInvoice(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      clientId: string
      projectId?: string
      issueDate?: string
      dueDate?: string
      currency?: string
      supplyType?: "INTRA_STATE" | "INTER_STATE" | "EXPORT"
      taxRate?: number
      discount?: number
      notes?: string
      terms?: string
      items: Array<{
        description: string
        sacCode?: string
        quantity: number
        unitPrice: number
      }>
    }) => {
      const res = await fetch(`/api/teams/${teamId}/finance/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create invoice")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-invoices", teamId] })
      queryClient.invalidateQueries({ queryKey: ["finance-overview", teamId] })
      queryClient.invalidateQueries({ queryKey: ["finance-receivables", teamId] })
      queryClient.invalidateQueries({ queryKey: ["finance-tax-summary", teamId] })
      toast.success("GST Invoice created successfully")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create invoice")
    },
  })
}

export function useUpdateInvoiceStatus(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ invoiceId, status }: { invoiceId: string; status: string }) => {
      const res = await fetch(`/api/teams/${teamId}/finance/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error("Failed to update status")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-invoices", teamId] })
      queryClient.invalidateQueries({ queryKey: ["finance-overview", teamId] })
      queryClient.invalidateQueries({ queryKey: ["finance-receivables", teamId] })
      toast.success("Invoice status updated")
    },
  })
}

export function useDeleteInvoice(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await fetch(`/api/teams/${teamId}/finance/invoices/${invoiceId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete invoice")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-invoices", teamId] })
      queryClient.invalidateQueries({ queryKey: ["finance-overview", teamId] })
      queryClient.invalidateQueries({ queryKey: ["finance-receivables", teamId] })
      toast.success("Invoice deleted")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete invoice")
    },
  })
}

export function useRecordPayment(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      invoiceId,
      amount,
      paymentDate,
      paymentMethod,
      referenceNumber,
      notes,
    }: {
      invoiceId: string
      amount: number
      paymentDate?: string
      paymentMethod?: string
      referenceNumber?: string
      notes?: string
    }) => {
      const res = await fetch(`/api/teams/${teamId}/finance/invoices/${invoiceId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, paymentDate, paymentMethod, referenceNumber, notes }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to record payment")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-invoices", teamId] })
      queryClient.invalidateQueries({ queryKey: ["finance-overview", teamId] })
      queryClient.invalidateQueries({ queryKey: ["finance-receivables", teamId] })
      queryClient.invalidateQueries({ queryKey: ["finance-payments", teamId] })
      toast.success("Payment recorded and receipt generated")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to record payment")
    },
  })
}

export function usePayments(teamId: string) {
  return useQuery<{ payments: PaymentItem[] }>({
    queryKey: ["finance-payments", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/finance/payments`)
      if (!res.ok) throw new Error("Failed to load payments")
      return res.json()
    },
    enabled: !!teamId,
  })
}

export function useExpenses(teamId: string) {
  return useQuery<{
    expenses: ExpenseRecord[]
    summary: {
      totalExpenses: number
      billableTotal: number
      nonBillableTotal: number
      categoryBreakdown: Record<string, number>
    }
  }>({
    queryKey: ["finance-expenses", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/finance/expenses`)
      if (!res.ok) throw new Error("Failed to load expenses")
      return res.json()
    },
    enabled: !!teamId,
  })
}

export function useCreateExpense(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      vendorName: string
      category: string
      amount: number
      currency?: string
      expenseDate?: string
      paymentStatus?: "PAID" | "PENDING"
      isBillable?: boolean
      description?: string
      projectId?: string
    }) => {
      const res = await fetch(`/api/teams/${teamId}/finance/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to log expense")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-expenses", teamId] })
      queryClient.invalidateQueries({ queryKey: ["finance-overview", teamId] })
      toast.success("Expense logged successfully")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to log expense")
    },
  })
}

export function useSubscriptions(teamId: string) {
  return useQuery<{
    subscriptions: ToolSubscriptionRecord[]
    summary: {
      totalTools: number
      totalMonthlyBurn: number
      totalAnnualBurn: number
      renewingSoonCount: number
    }
  }>({
    queryKey: ["finance-subscriptions", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/finance/subscriptions`)
      if (!res.ok) throw new Error("Failed to load subscriptions")
      return res.json()
    },
    enabled: !!teamId,
  })
}

export function useCreateSubscription(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      name: string
      category: string
      cost: number
      currency?: string
      billingCycle: "monthly" | "annually"
      renewalDate: string
      ownerName?: string
    }) => {
      const res = await fetch(`/api/teams/${teamId}/finance/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to add subscription")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-subscriptions", teamId] })
      queryClient.invalidateQueries({ queryKey: ["finance-overview", teamId] })
      toast.success("SaaS subscription added")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add subscription")
    },
  })
}

export function useReceivables(teamId: string) {
  return useQuery<{
    totalReceivables: number
    buckets: ReceivablesBuckets
    chartData: Array<{ name: string; amount: number; color: string }>
  }>({
    queryKey: ["finance-receivables", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/finance/receivables`)
      if (!res.ok) throw new Error("Failed to load receivables")
      return res.json()
    },
    enabled: !!teamId,
  })
}

export function useFinanceClients(teamId: string) {
  return useQuery<{ clients: Array<{ id: string; name: string; company?: string | null; email?: string | null; gstin?: string | null }> }>({
    queryKey: ["finance-clients", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/crm/clients`)
      if (!res.ok) throw new Error("Failed to load clients")
      return res.json()
    },
    enabled: !!teamId,
  })
}

export function useTaxSummary(teamId: string) {
  return useQuery<TaxSummaryResponse>({
    queryKey: ["finance-tax-summary", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/finance/tax-summary`)
      if (!res.ok) throw new Error("Failed to load tax summary")
      return res.json()
    },
    enabled: !!teamId,
  })
}
