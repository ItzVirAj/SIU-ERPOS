import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

export interface SalesReportData {
  summary: {
    totalLeads: number
    activeDealsCount: number
    wonDealsCount: number
    lostDealsCount: number
    totalPipelineValue: number
    totalWonValue: number
    totalLostValue: number
    winRate: number
    avgCycleDays: number
    avgDealSize: number
    currency: string
  }
  funnel: Array<{ name: string; count: number; value: number }>
  sources: Array<{ source: string; leads: number; revenue: number }>
  lostReasons: Array<{ reason: string; count: number }>
  recentLeads: Array<{
    id: string
    title: string
    company?: string | null
    value: number
    stage: string
    temperature: string
    isWon: boolean
    isLost: boolean
    createdAt: string
  }>
}

export interface DeliveryReportData {
  summary: {
    totalIssues: number
    completedCount: number
    inProgressCount: number
    overallCompletionRate: number
    totalEstimateCompleted: number
    avgCycleDays: number
    bugCount: number
    featureCount: number
    bugRate: number
  }
  velocity: Array<{ week: string; count: number; points: number }>
  projectHealth: Array<{
    id: string
    name: string
    key: string
    color: string
    totalIssues: number
    completedIssues: number
    inProgressIssues: number
    completionRate: number
    status: "ON_TRACK" | "AT_RISK" | "DELAYED"
  }>
  typeDistribution: Array<{ name: string; count: number; color: string }>
}

export interface FinancialReportData {
  summary: {
    currency: string
    realizedRevenue: number
    pipelineGross: number
    weightedPipeline: number
    totalProjectedRunway: number
    totalClients: number
    avgDealSize: number
  }
  clientEconomics: Array<{
    id: string
    name: string
    company: string
    wonValue: number
    pipelineValue: number
    activeProjects: number
  }>
  monthlyForecast: Array<{
    month: string
    realized: number
    projected: number
  }>
}

export interface TeamUtilizationData {
  summary: {
    totalTeamMembers: number
    totalAssignedIssues: number
    unassignedIssues: number
    avgAssignedPerMember: number
  }
  members: Array<{
    id: string
    name: string
    email: string
    role: string
    totalAssigned: number
    inProgress: number
    completed: number
    overdue: number
    storyPoints: number
    activeLoad: number
    utilizationScore: number
  }>
}

export interface CompanyKpiItem {
  id: string
  category: string
  name: string
  metricKey: string
  targetValue: number
  currentValue: number
  unit: string
  period: string
  createdAt: string
}

export interface FounderDigestData {
  founderDigest: {
    companyName: string
    generatedAt: string
    currency: string
    scorecard: {
      revenueThisWeek: number
      revenueDelta: number
      dealsWonThisWeek: number
      velocityThisWeek: number
      velocityDelta: number
      activeProjectsCount: number
      totalBacklogCount: number
    }
    highValueOpportunities: Array<{
      id: string
      title: string
      company?: string | null
      value: number
      temperature: string
    }>
    alerts: Array<{
      type: "warning" | "danger" | "info"
      title: string
      detail: string
    }>
  }
}

export function useSalesReport(teamId: string, timeframe = "all") {
  return useQuery<SalesReportData>({
    queryKey: ["reports", "sales", teamId, timeframe],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/reports/sales?timeframe=${timeframe}`)
      if (!res.ok) throw new Error("Failed to load sales report")
      return res.json()
    },
    enabled: !!teamId,
  })
}

export function useDeliveryReport(teamId: string) {
  return useQuery<DeliveryReportData>({
    queryKey: ["reports", "delivery", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/reports/delivery`)
      if (!res.ok) throw new Error("Failed to load delivery report")
      return res.json()
    },
    enabled: !!teamId,
  })
}

export function useFinancialReport(teamId: string) {
  return useQuery<FinancialReportData>({
    queryKey: ["reports", "financial", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/reports/financial`)
      if (!res.ok) throw new Error("Failed to load financial report")
      return res.json()
    },
    enabled: !!teamId,
  })
}

export function useTeamUtilizationReport(teamId: string) {
  return useQuery<TeamUtilizationData>({
    queryKey: ["reports", "team-utilization", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/reports/team-utilization`)
      if (!res.ok) throw new Error("Failed to load team utilization report")
      return res.json()
    },
    enabled: !!teamId,
  })
}

export function useCompanyKpis(teamId: string) {
  return useQuery<{ kpis: CompanyKpiItem[] }>({
    queryKey: ["reports", "kpis", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/reports/kpis`)
      if (!res.ok) throw new Error("Failed to load company KPIs")
      return res.json()
    },
    enabled: !!teamId,
  })
}

export function useCreateKpi(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      name: string
      category: string
      targetValue: number
      currentValue?: number
      unit: string
      period?: string
    }) => {
      const res = await fetch(`/api/teams/${teamId}/reports/kpis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Failed to create KPI")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports", "kpis", teamId] })
      toast.success("Goal / KPI recorded")
    },
  })
}

export function useFounderDigest(teamId: string) {
  return useQuery<FounderDigestData>({
    queryKey: ["reports", "founder-digest", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/reports/founder-digest`)
      if (!res.ok) throw new Error("Failed to load founder digest")
      return res.json()
    },
    enabled: !!teamId,
  })
}
