"use client"

import { useState } from "react"
import {
  useSalesReport,
  useDeliveryReport,
  useFinancialReport,
  useTeamUtilizationReport,
  useCompanyKpis,
  useCreateKpi,
  useFounderDigest,
} from "@/lib/hooks/use-reports"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChartContainer } from "@/components/ui/chart"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts"
import { toast } from "sonner"
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  Download,
  Flame,
  Layers,
  PieChart as PieChartIcon,
  Plus,
  RefreshCw,
  Rocket,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react"

interface ReportsConsoleProps {
  teamId: string
  teamName?: string
}

const PALETTE = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#06b6d4", "#f97316"]

function formatCurrency(amount: number, currency = "INR"): string {
  if (currency === "INR") {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount)
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function ReportsConsole({ teamId, teamName = "Workspace" }: ReportsConsoleProps) {
  const [activeTab, setActiveTab] = useState("digest")
  const [salesTimeframe, setSalesTimeframe] = useState("all")

  // React Query Hooks
  const { data: digestData, isLoading: digestLoading, refetch: refetchDigest } = useFounderDigest(teamId)
  const { data: salesData, isLoading: salesLoading, refetch: refetchSales } = useSalesReport(teamId, salesTimeframe)
  const { data: deliveryData, isLoading: deliveryLoading, refetch: refetchDelivery } = useDeliveryReport(teamId)
  const { data: financeData, isLoading: financeLoading, refetch: refetchFinance } = useFinancialReport(teamId)
  const { data: teamData, isLoading: teamLoading, refetch: refetchTeam } = useTeamUtilizationReport(teamId)
  const { data: kpiData, isLoading: kpiLoading, refetch: refetchKpi } = useCompanyKpis(teamId)
  const createKpiMutation = useCreateKpi(teamId)

  // KPI Modal State
  const [isAddKpiOpen, setIsAddKpiOpen] = useState(false)
  const [newKpi, setNewKpi] = useState({
    name: "",
    category: "sales",
    targetValue: 100,
    currentValue: 0,
    unit: "count",
    period: "monthly",
  })

  const handleCreateKpi = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKpi.name.trim()) return
    createKpiMutation.mutate(newKpi, {
      onSuccess: () => {
        setIsAddKpiOpen(false)
        setNewKpi({
          name: "",
          category: "sales",
          targetValue: 100,
          currentValue: 0,
          unit: "count",
          period: "monthly",
        })
      },
    })
  }

  const handleRefreshAll = () => {
    refetchDigest()
    refetchSales()
    refetchDelivery()
    refetchFinance()
    refetchTeam()
    refetchKpi()
    toast.success("All analytics re-aggregated with latest database telemetry")
  }

  const currency = salesData?.summary?.currency || financeData?.summary?.currency || "INR"

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-100">Reporting & Analytics</h1>
            <Badge variant="outline" className="border-blue-500/40 text-blue-400 bg-blue-950/20 text-xs">
              Module 6.17 RPT
            </Badge>
          </div>
          <p className="text-sm text-neutral-400 mt-1">
            Real-time decision intelligence: Sales pipeline, sprint throughput, unit economics & founder digest for {teamName}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 border-neutral-800 text-xs text-neutral-300 hover:text-white"
            onClick={handleRefreshAll}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Re-aggregate</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 border-neutral-800 text-xs text-neutral-300 hover:text-white"
            onClick={() => {
              window.open(`/api/teams/${teamId}/export?entity=all&format=json`, "_blank")
            }}
          >
            <Download className="h-3.5 w-3.5" />
            Export Data
          </Button>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-neutral-950 border border-neutral-800 p-1 rounded-xl flex-wrap h-auto gap-1">
          <TabsTrigger value="digest" className="gap-2 text-xs py-2 px-3">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span>Weekly Founder Digest</span>
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-2 text-xs py-2 px-3">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <span>Sales & Pipeline</span>
          </TabsTrigger>
          <TabsTrigger value="delivery" className="gap-2 text-xs py-2 px-3">
            <Rocket className="h-4 w-4 text-blue-400" />
            <span>Delivery Velocity</span>
          </TabsTrigger>
          <TabsTrigger value="financial" className="gap-2 text-xs py-2 px-3">
            <Coins className="h-4 w-4 text-purple-400" />
            <span>Financial Forecast</span>
          </TabsTrigger>
          <TabsTrigger value="utilization" className="gap-2 text-xs py-2 px-3">
            <Users className="h-4 w-4 text-pink-400" />
            <span>Team Utilization</span>
          </TabsTrigger>
          <TabsTrigger value="okrs" className="gap-2 text-xs py-2 px-3">
            <Target className="h-4 w-4 text-cyan-400" />
            <span>Company OKRs</span>
          </TabsTrigger>
        </TabsList>

        {/* ============================================================== */}
        {/* TAB 1: WEEKLY FOUNDER DIGEST (RPT-06)                          */}
        {/* ============================================================== */}
        <TabsContent value="digest" className="space-y-6">
          {digestLoading ? (
            <div className="text-center py-12 text-xs text-neutral-500">
              Aggregating executive briefing...
            </div>
          ) : digestData?.founderDigest ? (
            <div className="space-y-6">
              {/* Executive KPI Scorecard */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-neutral-900/60 border-neutral-800">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-xs font-medium text-neutral-400">Revenue Closed (7D)</CardTitle>
                    <Coins className="h-4 w-4 text-emerald-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-neutral-100">
                      {formatCurrency(digestData.founderDigest.scorecard.revenueThisWeek, currency)}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-xs">
                      {digestData.founderDigest.scorecard.revenueDelta >= 0 ? (
                        <span className="text-emerald-400 flex items-center font-medium">
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          +{digestData.founderDigest.scorecard.revenueDelta}%
                        </span>
                      ) : (
                        <span className="text-rose-400 flex items-center font-medium">
                          <ArrowDownRight className="h-3.5 w-3.5" />
                          {digestData.founderDigest.scorecard.revenueDelta}%
                        </span>
                      )}
                      <span className="text-neutral-500 text-[11px]">vs prior week</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-neutral-900/60 border-neutral-800">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-xs font-medium text-neutral-400">Sprint Tasks Shipped</CardTitle>
                    <Rocket className="h-4 w-4 text-blue-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-neutral-100">
                      {digestData.founderDigest.scorecard.velocityThisWeek}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-xs">
                      {digestData.founderDigest.scorecard.velocityDelta >= 0 ? (
                        <span className="text-emerald-400 flex items-center font-medium">
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          +{digestData.founderDigest.scorecard.velocityDelta}%
                        </span>
                      ) : (
                        <span className="text-neutral-400 flex items-center">
                          {digestData.founderDigest.scorecard.velocityDelta}%
                        </span>
                      )}
                      <span className="text-neutral-500 text-[11px]">throughput velocity</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-neutral-900/60 border-neutral-800">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-xs font-medium text-neutral-400">Active Workspaces</CardTitle>
                    <Layers className="h-4 w-4 text-purple-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-neutral-100">
                      {digestData.founderDigest.scorecard.activeProjectsCount}
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">Projects in active delivery</p>
                  </CardContent>
                </Card>

                <Card className="bg-neutral-900/60 border-neutral-800">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-xs font-medium text-neutral-400">Active Sprint Backlog</CardTitle>
                    <Briefcase className="h-4 w-4 text-amber-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-neutral-100">
                      {digestData.founderDigest.scorecard.totalBacklogCount}
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">Tasks remaining in queues</p>
                  </CardContent>
                </Card>
              </div>

              {/* Founder Risks & High-Value Opportunities */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Risks & Bottlenecks */}
                <Card className="bg-neutral-900/60 border-neutral-800">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-amber-400" />
                      Operational Risks & Bottlenecks
                    </CardTitle>
                    <CardDescription className="text-xs text-neutral-400">
                      Automated audit warnings requiring founder attention
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {digestData.founderDigest.alerts.length === 0 ? (
                      <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-800/40 text-xs text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                        <span>All sprint items assigned, no critical blockers detected. Operations healthy!</span>
                      </div>
                    ) : (
                      digestData.founderDigest.alerts.map((alert, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                            alert.type === "danger"
                              ? "bg-rose-950/20 border-rose-800/50 text-rose-200"
                              : alert.type === "warning"
                              ? "bg-amber-950/20 border-amber-800/50 text-amber-200"
                              : "bg-blue-950/20 border-blue-800/50 text-blue-200"
                          }`}
                        >
                          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <p className="font-semibold text-neutral-100">{alert.title}</p>
                            <p className="text-neutral-400 text-[11px]">{alert.detail}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* High Value Pipeline */}
                <Card className="bg-neutral-900/60 border-neutral-800">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
                      <Flame className="h-4 w-4 text-orange-400" />
                      Highest-Value Active Deals
                    </CardTitle>
                    <CardDescription className="text-xs text-neutral-400">
                      Top leads in pipeline ready for closing
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {digestData.founderDigest.highValueOpportunities.length === 0 ? (
                      <p className="text-xs text-neutral-500 text-center py-6">
                        No active pipeline deals logged yet.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {digestData.founderDigest.highValueOpportunities.map((opp) => (
                          <div
                            key={opp.id}
                            className="p-2.5 rounded-lg border border-neutral-800 bg-neutral-950/50 flex items-center justify-between text-xs"
                          >
                            <div className="space-y-0.5">
                              <p className="font-medium text-neutral-200">{opp.title}</p>
                              <p className="text-[11px] text-neutral-500">{opp.company || "Independent Client"}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-emerald-400">
                                {formatCurrency(opp.value, currency)}
                              </p>
                              <Badge
                                variant="outline"
                                className={`text-[9px] uppercase px-1.5 py-0 ${
                                  opp.temperature === "hot"
                                    ? "bg-rose-950/40 text-rose-400 border-rose-800"
                                    : "bg-neutral-800 text-neutral-400"
                                }`}
                              >
                                {opp.temperature}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 2: SALES & PIPELINE INTELLIGENCE (RPT-01)                  */}
        {/* ============================================================== */}
        <TabsContent value="sales" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-neutral-200">Sales Funnel & Conversion Analytics</h2>
              <p className="text-xs text-neutral-400">
                Measure acquisition channels, stage drop-offs, and win/loss velocity.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={salesTimeframe} onValueChange={setSalesTimeframe}>
                <SelectTrigger className="h-8 w-32 bg-neutral-950 border-neutral-800 text-xs text-neutral-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-neutral-950 border-neutral-800 text-neutral-200">
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="90d">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sales Top-line KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardContent className="pt-4">
                <p className="text-xs text-neutral-400">Active Pipeline Value</p>
                <p className="text-lg font-bold text-neutral-100 mt-1">
                  {formatCurrency(salesData?.summary?.totalPipelineValue || 0, currency)}
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  {salesData?.summary?.activeDealsCount || 0} active deals
                </p>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardContent className="pt-4">
                <p className="text-xs text-neutral-400">Closed Won Revenue</p>
                <p className="text-lg font-bold text-emerald-400 mt-1">
                  {formatCurrency(salesData?.summary?.totalWonValue || 0, currency)}
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  {salesData?.summary?.wonDealsCount || 0} converted deals
                </p>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardContent className="pt-4">
                <p className="text-xs text-neutral-400">Deal Win Rate</p>
                <p className="text-lg font-bold text-neutral-100 mt-1">
                  {salesData?.summary?.winRate || 0}%
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">of closed opportunities</p>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardContent className="pt-4">
                <p className="text-xs text-neutral-400">Avg Sales Cycle</p>
                <p className="text-lg font-bold text-neutral-100 mt-1">
                  {salesData?.summary?.avgCycleDays || 0} Days
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">creation to contract</p>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardContent className="pt-4">
                <p className="text-xs text-neutral-400">Avg Deal Size (ACV)</p>
                <p className="text-lg font-bold text-blue-400 mt-1">
                  {formatCurrency(salesData?.summary?.avgDealSize || 0, currency)}
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">per won deal</p>
              </CardContent>
            </Card>
          </div>

          {/* Sales Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stage Funnel Chart */}
            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-neutral-200">Pipeline Funnel by Stage</CardTitle>
                <CardDescription className="text-xs text-neutral-500">
                  Lead volume and deal value progressing through sales stages
                </CardDescription>
              </CardHeader>
              <CardContent>
                {salesData?.funnel && salesData.funnel.length > 0 ? (
                  <ChartContainer config={{ count: { label: "Leads" } }} className="h-[240px] w-full">
                    <BarChart data={salesData.funnel}>
                      <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="h-[240px] flex items-center justify-center text-xs text-neutral-500">
                    No stage pipeline data found
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Lead Sources Chart */}
            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-neutral-200">Acquisition Channels ROI</CardTitle>
                <CardDescription className="text-xs text-neutral-500">
                  Lead generation sources (Website, Upwork, LinkedIn, Referral)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {salesData?.sources && salesData.sources.length > 0 ? (
                  <ChartContainer config={{ count: { label: "Leads" } }} className="h-[240px] w-full">
                    <BarChart data={salesData.sources}>
                      <XAxis dataKey="source" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="leads" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="h-[240px] flex items-center justify-center text-xs text-neutral-500">
                    No lead source distribution recorded
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 3: DELIVERY VELOCITY (RPT-02)                              */}
        {/* ============================================================== */}
        <TabsContent value="delivery" className="space-y-6">
          <div>
            <h2 className="text-base font-semibold text-neutral-200">Sprint Throughput & Delivery Metrics</h2>
            <p className="text-xs text-neutral-400">
              Engineering velocity, cycle time, bug rates, and project delivery health.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardContent className="pt-4">
                <p className="text-xs text-neutral-400">Tasks Completed</p>
                <p className="text-2xl font-bold text-neutral-100 mt-1">
                  {deliveryData?.summary?.completedCount || 0}
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  of {deliveryData?.summary?.totalIssues || 0} total issues
                </p>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardContent className="pt-4">
                <p className="text-xs text-neutral-400">Overall Completion</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">
                  {deliveryData?.summary?.overallCompletionRate || 0}%
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">across workspace backlog</p>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardContent className="pt-4">
                <p className="text-xs text-neutral-400">Avg Cycle Time</p>
                <p className="text-2xl font-bold text-neutral-100 mt-1">
                  {deliveryData?.summary?.avgCycleDays || 0} Days
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">from backlog to shipped</p>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardContent className="pt-4">
                <p className="text-xs text-neutral-400">Defect / Bug Rate</p>
                <p className="text-2xl font-bold text-rose-400 mt-1">
                  {deliveryData?.summary?.bugRate || 0}%
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  {deliveryData?.summary?.bugCount || 0} bugs resolved
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 8-Week Velocity Trend */}
          <Card className="bg-neutral-900/60 border-neutral-800">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-neutral-200">8-Week Sprint Velocity Trend</CardTitle>
              <CardDescription className="text-xs text-neutral-500">
                Weekly closed deliverables and story points shipped by the team
              </CardDescription>
            </CardHeader>
            <CardContent>
              {deliveryData?.velocity && deliveryData.velocity.length > 0 ? (
                <ChartContainer config={{ count: { label: "Tasks" } }} className="h-[250px] w-full">
                  <BarChart data={deliveryData.velocity}>
                    <XAxis dataKey="week" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-xs text-neutral-500">
                  No historical velocity data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Project Health Table */}
          <Card className="bg-neutral-900/60 border-neutral-800">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-neutral-200">Project Delivery Matrix (RAG Health)</CardTitle>
              <CardDescription className="text-xs text-neutral-500">
                Delivery health across all active projects
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-neutral-800 overflow-hidden">
                <Table>
                  <TableHeader className="bg-neutral-950/60">
                    <TableRow className="border-neutral-800">
                      <TableHead className="text-xs font-medium text-neutral-400">Project</TableHead>
                      <TableHead className="text-xs font-medium text-neutral-400">Key</TableHead>
                      <TableHead className="text-xs font-medium text-neutral-400">Total Tasks</TableHead>
                      <TableHead className="text-xs font-medium text-neutral-400">Completed</TableHead>
                      <TableHead className="text-xs font-medium text-neutral-400">Progress</TableHead>
                      <TableHead className="text-xs font-medium text-neutral-400">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveryData?.projectHealth && deliveryData.projectHealth.length > 0 ? (
                      deliveryData.projectHealth.map((p) => (
                        <TableRow key={p.id} className="border-neutral-850 hover:bg-neutral-800/30">
                          <TableCell className="text-xs font-medium text-neutral-200">{p.name}</TableCell>
                          <TableCell className="text-xs font-mono text-purple-400">{p.key}</TableCell>
                          <TableCell className="text-xs text-neutral-300">{p.totalIssues}</TableCell>
                          <TableCell className="text-xs text-emerald-400 font-medium">{p.completedIssues}</TableCell>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 rounded-full"
                                  style={{ width: `${p.completionRate}%` }}
                                />
                              </div>
                              <span className="text-neutral-400 text-[11px]">{p.completionRate}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-mono ${
                                p.status === "ON_TRACK"
                                  ? "bg-emerald-950/40 text-emerald-400 border-emerald-800"
                                  : p.status === "AT_RISK"
                                  ? "bg-amber-950/40 text-amber-400 border-amber-800"
                                  : "bg-rose-950/40 text-rose-400 border-rose-800"
                              }`}
                            >
                              {p.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-neutral-500 text-xs">
                          No projects found in this workspace.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 4: FINANCIAL FORECAST (RPT-03)                             */}
        {/* ============================================================== */}
        <TabsContent value="financial" className="space-y-6">
          <div>
            <h2 className="text-base font-semibold text-neutral-200">Financial Forecast & Deal Economics</h2>
            <p className="text-xs text-neutral-400">
              Revenue projections, weighted contract pipeline, and client account economics.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardContent className="pt-4">
                <p className="text-xs text-neutral-400">Realized Closed Revenue</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">
                  {formatCurrency(financeData?.summary?.realizedRevenue || 0, currency)}
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">from won contracts</p>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardContent className="pt-4">
                <p className="text-xs text-neutral-400">Weighted Pipeline Projection</p>
                <p className="text-2xl font-bold text-blue-400 mt-1">
                  {formatCurrency(financeData?.summary?.weightedPipeline || 0, currency)}
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">probability-adjusted pipeline</p>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardContent className="pt-4">
                <p className="text-xs text-neutral-400">Total Projected Runway</p>
                <p className="text-2xl font-bold text-purple-400 mt-1">
                  {formatCurrency(financeData?.summary?.totalProjectedRunway || 0, currency)}
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">realized + weighted pipeline</p>
              </CardContent>
            </Card>
          </div>

          {/* 6-Month Projected Runway */}
          <Card className="bg-neutral-900/60 border-neutral-800">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-neutral-200">6-Month Revenue Forecast Curve</CardTitle>
              <CardDescription className="text-xs text-neutral-500">
                Projected cash inflow based on sales velocity and active pipeline
              </CardDescription>
            </CardHeader>
            <CardContent>
              {financeData?.monthlyForecast && financeData.monthlyForecast.length > 0 ? (
                <ChartContainer config={{ projected: { label: "Projected" } }} className="h-[250px] w-full">
                  <BarChart data={financeData.monthlyForecast}>
                    <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="projected" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : null}
            </CardContent>
          </Card>

          {/* Top Client Accounts */}
          <Card className="bg-neutral-900/60 border-neutral-800">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-neutral-200">Top Client Accounts Economics</CardTitle>
              <CardDescription className="text-xs text-neutral-500">
                Customer lifetime revenue & pipeline potential
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-neutral-800 overflow-hidden">
                <Table>
                  <TableHeader className="bg-neutral-950/60">
                    <TableRow className="border-neutral-800">
                      <TableHead className="text-xs font-medium text-neutral-400">Client / Company</TableHead>
                      <TableHead className="text-xs font-medium text-neutral-400">Closed Revenue</TableHead>
                      <TableHead className="text-xs font-medium text-neutral-400">Open Pipeline</TableHead>
                      <TableHead className="text-xs font-medium text-neutral-400">Active Workspaces</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {financeData?.clientEconomics && financeData.clientEconomics.length > 0 ? (
                      financeData.clientEconomics.map((c) => (
                        <TableRow key={c.id} className="border-neutral-850 hover:bg-neutral-800/30">
                          <TableCell className="text-xs font-medium text-neutral-200">{c.company}</TableCell>
                          <TableCell className="text-xs font-semibold text-emerald-400">
                            {formatCurrency(c.wonValue, currency)}
                          </TableCell>
                          <TableCell className="text-xs text-blue-400">
                            {formatCurrency(c.pipelineValue, currency)}
                          </TableCell>
                          <TableCell className="text-xs text-neutral-400">{c.activeProjects}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-neutral-500 text-xs">
                          No client account records yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 5: TEAM UTILIZATION (RPT-04)                              */}
        {/* ============================================================== */}
        <TabsContent value="utilization" className="space-y-6">
          <div>
            <h2 className="text-base font-semibold text-neutral-200">Team Workload & Capacity Utilization</h2>
            <p className="text-xs text-neutral-400">
              Monitor individual backlog distribution, prevent burnout, and balance sprint capacity.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardContent className="pt-4">
                <p className="text-xs text-neutral-400">Total Team Members</p>
                <p className="text-2xl font-bold text-neutral-100 mt-1">
                  {teamData?.summary?.totalTeamMembers || 0}
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">workspace contributors</p>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardContent className="pt-4">
                <p className="text-xs text-neutral-400">Assigned Tasks</p>
                <p className="text-2xl font-bold text-neutral-100 mt-1">
                  {teamData?.summary?.totalAssignedIssues || 0}
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">currently distributed</p>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardContent className="pt-4">
                <p className="text-xs text-neutral-400">Avg Load / Member</p>
                <p className="text-2xl font-bold text-blue-400 mt-1">
                  {teamData?.summary?.avgAssignedPerMember || 0}
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">tasks per contributor</p>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardContent className="pt-4">
                <p className="text-xs text-neutral-400">Unassigned Backlog</p>
                <p className="text-2xl font-bold text-amber-400 mt-1">
                  {teamData?.summary?.unassignedIssues || 0}
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">awaiting allocation</p>
              </CardContent>
            </Card>
          </div>

          {/* Member Utilization Table */}
          <Card className="bg-neutral-900/60 border-neutral-800">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-neutral-200">Contributor Capacity Leaderboard</CardTitle>
              <CardDescription className="text-xs text-neutral-500">
                Workload allocation, active tasks, and completion velocity by team member
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-neutral-800 overflow-hidden">
                <Table>
                  <TableHeader className="bg-neutral-950/60">
                    <TableRow className="border-neutral-800">
                      <TableHead className="text-xs font-medium text-neutral-400">Contributor</TableHead>
                      <TableHead className="text-xs font-medium text-neutral-400">Role</TableHead>
                      <TableHead className="text-xs font-medium text-neutral-400">Active Load</TableHead>
                      <TableHead className="text-xs font-medium text-neutral-400">In Progress</TableHead>
                      <TableHead className="text-xs font-medium text-neutral-400">Completed</TableHead>
                      <TableHead className="text-xs font-medium text-neutral-400">Capacity Load</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamData?.members && teamData.members.length > 0 ? (
                      teamData.members.map((m) => (
                        <TableRow key={m.id} className="border-neutral-850 hover:bg-neutral-800/30">
                          <TableCell className="text-xs font-medium text-neutral-200">
                            <div>
                              <span>{m.name}</span>
                              {m.email && <p className="text-[11px] text-neutral-500">{m.email}</p>}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-[10px] uppercase font-mono bg-neutral-900 text-neutral-300">
                              {m.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-semibold text-neutral-200">{m.totalAssigned}</TableCell>
                          <TableCell className="text-xs text-blue-400 font-medium">{m.inProgress}</TableCell>
                          <TableCell className="text-xs text-emerald-400 font-medium">{m.completed}</TableCell>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    m.utilizationScore > 80
                                      ? "bg-rose-500"
                                      : m.utilizationScore > 50
                                      ? "bg-amber-500"
                                      : "bg-emerald-500"
                                  }`}
                                  style={{ width: `${m.utilizationScore}%` }}
                                />
                              </div>
                              <span className="text-neutral-400 text-[11px]">{m.utilizationScore}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-neutral-500 text-xs">
                          No team members registered yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 6: COMPANY OKRS & OBJECTIVES (RPT-08)                      */}
        {/* ============================================================== */}
        <TabsContent value="okrs" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-neutral-200">Company Objectives & KPI Tracking</h2>
              <p className="text-xs text-neutral-400">
                Track top-level quarterly goals for revenue, delivery, and sales conversion.
              </p>
            </div>
            <Button
              size="sm"
              className="gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-neutral-950 font-semibold text-xs"
              onClick={() => setIsAddKpiOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Add KPI Target
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiLoading ? (
              <div className="col-span-full text-center py-8 text-neutral-500 text-xs">
                Loading KPI goals...
              </div>
            ) : kpiData?.kpis && kpiData.kpis.length > 0 ? (
              kpiData.kpis.map((kpi) => {
                const percent = Math.min(100, Math.round((kpi.currentValue / kpi.targetValue) * 100))
                return (
                  <Card key={kpi.id} className="bg-neutral-900/60 border-neutral-800">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[10px] uppercase font-mono bg-neutral-950 text-cyan-400 border-cyan-800/40">
                          {kpi.period}
                        </Badge>
                        <span className="text-[11px] text-neutral-400 font-semibold">{percent}%</span>
                      </div>
                      <CardTitle className="text-sm font-semibold text-neutral-200 mt-2">{kpi.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-neutral-400">
                          <span>Current: {kpi.unit === "INR" ? formatCurrency(kpi.currentValue, currency) : `${kpi.currentValue} ${kpi.unit}`}</span>
                          <span>Target: {kpi.unit === "INR" ? formatCurrency(kpi.targetValue, currency) : `${kpi.targetValue} ${kpi.unit}`}</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            ) : (
              <div className="col-span-full text-center py-8 text-neutral-500 text-xs">
                No company KPIs defined yet.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* MODAL: ADD COMPANY KPI */}
      <Dialog open={isAddKpiOpen} onOpenChange={setIsAddKpiOpen}>
        <DialogContent className="bg-neutral-950 border-neutral-800 text-neutral-100">
          <DialogHeader>
            <DialogTitle className="text-base">Add Company Objective / KPI</DialogTitle>
            <DialogDescription className="text-xs text-neutral-400">
              Set target metrics for revenue, delivery velocity, or sales conversion.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateKpi} className="space-y-3.5 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-neutral-300">Goal / KPI Name</Label>
              <Input
                placeholder="e.g. Q4 Target Revenue"
                value={newKpi.name}
                onChange={(e) => setNewKpi({ ...newKpi, name: e.target.value })}
                className="bg-neutral-900 border-neutral-800 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-neutral-300">Category</Label>
                <Select
                  value={newKpi.category}
                  onValueChange={(val) => setNewKpi({ ...newKpi, category: val })}
                >
                  <SelectTrigger className="bg-neutral-900 border-neutral-800 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-100">
                    <SelectItem value="sales">Sales & Deals</SelectItem>
                    <SelectItem value="financial">Financial Revenue</SelectItem>
                    <SelectItem value="delivery">Delivery Velocity</SelectItem>
                    <SelectItem value="team">Team Expansion</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-neutral-300">Cadence / Period</Label>
                <Select
                  value={newKpi.period}
                  onValueChange={(val) => setNewKpi({ ...newKpi, period: val })}
                >
                  <SelectTrigger className="bg-neutral-900 border-neutral-800 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-100">
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-neutral-300">Target Value</Label>
                <Input
                  type="number"
                  value={newKpi.targetValue}
                  onChange={(e) => setNewKpi({ ...newKpi, targetValue: Number(e.target.value) })}
                  className="bg-neutral-900 border-neutral-800 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-neutral-300">Current Value</Label>
                <Input
                  type="number"
                  value={newKpi.currentValue}
                  onChange={(e) => setNewKpi({ ...newKpi, currentValue: Number(e.target.value) })}
                  className="bg-neutral-900 border-neutral-800 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-neutral-300">Unit</Label>
                <Select
                  value={newKpi.unit}
                  onValueChange={(val) => setNewKpi({ ...newKpi, unit: val })}
                >
                  <SelectTrigger className="bg-neutral-900 border-neutral-800 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-100">
                    <SelectItem value="INR">INR (₹)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="%">Percentage (%)</SelectItem>
                    <SelectItem value="pts">Story Points</SelectItem>
                    <SelectItem value="count">Count</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="submit"
                disabled={createKpiMutation.isPending}
                className="bg-cyan-600 hover:bg-cyan-500 text-neutral-950 font-semibold text-xs"
              >
                {createKpiMutation.isPending ? "Saving..." : "Save KPI Goal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
