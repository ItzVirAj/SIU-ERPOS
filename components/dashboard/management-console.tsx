"use client"

import { useState, useTransition } from "react"
import {
  useAuditLogs,
  useCompanySettings,
  useUpdateCompanySettings,
  useAutomations,
  useCreateAutomation,
  useToggleAutomation,
  useDeleteAutomation,
  useTestRunAutomation,
  useDeveloperApiKeys,
  useCreateApiKey,
  useToggleApiKey,
  useRevokeApiKey,
  useWebhooks,
  useCreateWebhook,
  useToggleWebhook,
  useDeleteWebhook,
  usePingWebhook,
  useSystemHealth,
} from "@/lib/hooks/use-admin"
import { useTeamStats } from "@/lib/hooks/use-team-data"
import { useAccess } from "@/lib/hooks/use-access"
import { AppModule, AccessLevel } from "@/lib/prisma-client"
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
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, Tooltip } from "recharts"
import { toast } from "sonner"
import {
  Activity,
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Download,
  FileText,
  Key,
  Layers,
  Play,
  Plus,
  RefreshCw,
  Server,
  Shield,
  ShieldCheck,
  Trash2,
  Webhook,
  Zap,
} from "lucide-react"

interface ManagementConsoleProps {
  teamId: string
  teamName?: string
}

const CHART_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4"]
const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#3b82f6",
  none: "#64748b",
}

export function ManagementConsole({ teamId, teamName = "Workspace" }: ManagementConsoleProps) {
  const { can } = useAccess()
  const canAudit = can(AppModule.AUDIT_LOGS, AccessLevel.VIEW)
  const canCompany = can(AppModule.COMPANY_SETTINGS, AccessLevel.VIEW)
  const canAutomations = can(AppModule.AUTOMATIONS, AccessLevel.VIEW)
  const canDev = can(AppModule.DEV_SETTINGS, AccessLevel.VIEW)
  const canRoles = can(AppModule.ROLES, AccessLevel.VIEW)
  const canExport = can(AppModule.COMPANY_SETTINGS, AccessLevel.MANAGE)

  const [activeTab, setActiveTab] = useState("overview")

  // ==================== QUERIES ====================
  const { data: statsData, refetch: refetchStats } = useTeamStats(teamId)
  const [auditFilterAction, setAuditFilterAction] = useState("all")
  const [auditFilterEntity, setAuditFilterEntity] = useState("all")
  const [auditSearch, setAuditSearch] = useState("")

  const { data: auditData, isLoading: auditLoading, refetch: refetchAudit } = useAuditLogs(
    teamId,
    {
      action: auditFilterAction,
      entityType: auditFilterEntity,
      search: auditSearch,
    },
    { enabled: canAudit }
  )

  const { data: companyData, isLoading: companyLoading } = useCompanySettings(teamId, { enabled: canCompany })
  const updateCompanyMutation = useUpdateCompanySettings(teamId)

  const { data: automationsData, isLoading: automationsLoading, refetch: refetchAutomations } = useAutomations(teamId, {
    enabled: canAutomations,
  })
  const createAutomationMutation = useCreateAutomation(teamId)
  const toggleAutomationMutation = useToggleAutomation(teamId)
  const deleteAutomationMutation = useDeleteAutomation(teamId)
  const testRunAutomationMutation = useTestRunAutomation(teamId)

  const { data: apiKeysData, isLoading: keysLoading, refetch: refetchKeys } = useDeveloperApiKeys(teamId, {
    enabled: canDev,
  })
  const createApiKeyMutation = useCreateApiKey(teamId)
  const toggleApiKeyMutation = useToggleApiKey(teamId)
  const revokeApiKeyMutation = useRevokeApiKey(teamId)

  const { data: webhooksData, isLoading: webhooksLoading, refetch: refetchWebhooks } = useWebhooks(teamId, {
    enabled: canDev,
  })
  const createWebhookMutation = useCreateWebhook(teamId)
  const toggleWebhookMutation = useToggleWebhook(teamId)
  const deleteWebhookMutation = useDeleteWebhook(teamId)
  const pingWebhookMutation = usePingWebhook(teamId)

  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useSystemHealth(teamId, {
    enabled: canCompany,
  })

  // ==================== LOCAL FORM STATES ====================
  // Company Settings Form State
  const [companyForm, setCompanyForm] = useState({
    legalName: "",
    gstin: "",
    pan: "",
    currency: "INR",
    address: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
  })
  const [companyInitialized, setCompanyInitialized] = useState(false)

  if (companyData?.settings && !companyInitialized) {
    setCompanyForm({
      legalName: companyData.settings.legalName || "",
      gstin: companyData.settings.gstin || "",
      pan: companyData.settings.pan || "",
      currency: companyData.settings.currency || "INR",
      address: companyData.settings.address || "",
      city: companyData.settings.city || "",
      state: companyData.settings.state || "",
      pincode: companyData.settings.pincode || "",
      country: companyData.settings.country || "India",
    })
    setCompanyInitialized(true)
  }

  // Automation Modal State
  const [isAddAutoOpen, setIsAddAutoOpen] = useState(false)
  const [newAuto, setNewAuto] = useState({
    name: "",
    description: "",
    triggerType: "lead_won",
    actionType: "create_project",
  })

  // API Key Modal State
  const [isCreateKeyOpen, setIsCreateKeyOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(["tasks:read", "tasks:write", "projects:read"])
  const [createdKeySecret, setCreatedKeySecret] = useState<string | null>(null)

  // Webhook Modal State
  const [isCreateWebhookOpen, setIsCreateWebhookOpen] = useState(false)
  const [newWebhookUrl, setNewWebhookUrl] = useState("")
  const [newWebhookDesc, setNewWebhookDesc] = useState("")

  // Log Inspection State
  const [selectedLog, setSelectedLog] = useState<any | null>(null)

  // ==================== ACTIONS ====================
  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault()
    updateCompanyMutation.mutate(companyForm)
  }

  const handleCreateAutomation = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAuto.name.trim()) return
    createAutomationMutation.mutate(newAuto, {
      onSuccess: () => {
        setIsAddAutoOpen(false)
        setNewAuto({ name: "", description: "", triggerType: "lead_won", actionType: "create_project" })
      },
    })
  }

  const handleCreateApiKey = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKeyName.trim()) return
    createApiKeyMutation.mutate(
      { name: newKeyName.trim(), scopes: newKeyScopes },
      {
        onSuccess: (data: any) => {
          setCreatedKeySecret(data.apiKey?.secretKey || "sk_live_generated")
          setNewKeyName("")
        },
      }
    )
  }

  const handleCreateWebhook = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newWebhookUrl.trim()) return
    createWebhookMutation.mutate(
      {
        url: newWebhookUrl.trim(),
        description: newWebhookDesc.trim(),
        events: ["*"],
      },
      {
        onSuccess: () => {
          setIsCreateWebhookOpen(false)
          setNewWebhookUrl("")
          setNewWebhookDesc("")
        },
      }
    )
  }

  const copyToClipboard = (text: string, label = "Key") => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard!`)
  }

  // Stats Breakdown
  const priorityData =
    statsData?.priorityBreakdown?.map((item: any) => ({
      name: item.priority === "none" ? "None" : item.priority.charAt(0).toUpperCase() + item.priority.slice(1),
      value: item.count,
      color: PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.none,
    })) || []

  const statusData =
    statsData?.statusBreakdown?.map((item: any) => ({
      name: item.status,
      value: item.count,
    })) || []

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-100">Workspace Administration</h1>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-950/20 text-xs">
              Module 6.18 ADM
            </Badge>
          </div>
          <p className="text-sm text-neutral-400 mt-1">
            Enterprise governance, audit trail, tax configurations, automations, and developer API keys for {teamName}
          </p>
        </div>

        {/* Database Latency Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {healthData && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-neutral-800 bg-neutral-900/80 text-xs text-neutral-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Neon DB: {healthData.database?.latencyMs}ms</span>
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 border-neutral-800 text-neutral-300 hover:text-white"
            onClick={() => {
              refetchAudit()
              refetchAutomations()
              refetchKeys()
              refetchWebhooks()
              refetchHealth()
              toast.success("Telemetry updated")
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* MAIN TABS NAVIGATION */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-neutral-950 border border-neutral-800 p-1 rounded-xl flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="gap-2 text-xs py-2 px-3">
            <Activity className="h-4 w-4" />
            <span>Overview</span>
          </TabsTrigger>
          {canAudit && (
            <TabsTrigger value="audit-logs" className="gap-2 text-xs py-2 px-3">
              <FileText className="h-4 w-4" />
              <span>Audit Trail</span>
              {auditData?.logs?.length ? (
                <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-neutral-800">
                  {auditData.logs.length}
                </Badge>
              ) : null}
            </TabsTrigger>
          )}
          {canAutomations && (
            <TabsTrigger value="automations" className="gap-2 text-xs py-2 px-3">
              <Zap className="h-4 w-4 text-amber-400" />
              <span>Automations</span>
              {automationsData?.rules?.length ? (
                <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-amber-500/20 text-amber-300">
                  {automationsData.rules.length}
                </Badge>
              ) : null}
            </TabsTrigger>
          )}
          {canCompany && (
            <TabsTrigger value="company" className="gap-2 text-xs py-2 px-3">
              <Building2 className="h-4 w-4" />
              <span>Company & Tax</span>
            </TabsTrigger>
          )}
          {canRoles && (
            <TabsTrigger value="roles" className="gap-2 text-xs py-2 px-3">
              <ShieldCheck className="h-4 w-4 text-blue-400" />
              <span>Roles & RBAC</span>
            </TabsTrigger>
          )}
          {canDev && (
            <TabsTrigger value="developers" className="gap-2 text-xs py-2 px-3">
              <Key className="h-4 w-4 text-purple-400" />
              <span>API Keys & Webhooks</span>
            </TabsTrigger>
          )}
          {canExport && (
            <TabsTrigger value="export" className="gap-2 text-xs py-2 px-3">
              <Download className="h-4 w-4" />
              <span>Data Export</span>
            </TabsTrigger>
          )}
          {canCompany && (
            <TabsTrigger value="diagnostics" className="gap-2 text-xs py-2 px-3">
              <Database className="h-4 w-4 text-emerald-400" />
              <span>System Health</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* ============================================================== */}
        {/* TAB 1: OVERVIEW & ANALYTICS                                   */}
        {/* ============================================================== */}
        <TabsContent value="overview" className="space-y-6">
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-neutral-400">Team Collaborators</CardTitle>
                <Shield className="h-4 w-4 text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-neutral-100">{statsData?.stats?.members || 1}</div>
                <p className="text-xs text-neutral-500 mt-1">Multi-tenant role members</p>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-neutral-400">Active Workspaces</CardTitle>
                <Layers className="h-4 w-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-neutral-100">{statsData?.stats?.projects || 0}</div>
                <p className="text-xs text-neutral-500 mt-1">Running projects in progress</p>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-neutral-400">Active Automations</CardTitle>
                <Zap className="h-4 w-4 text-amber-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-neutral-100">
                  {automationsData?.rules?.filter((r) => r.isActive).length || 0}
                </div>
                <p className="text-xs text-neutral-500 mt-1">Cross-module event handlers</p>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-neutral-400">Audit Events Logged</CardTitle>
                <FileText className="h-4 w-4 text-emerald-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-neutral-100">{healthData?.workspace?.recordedAuditLogs || 0}</div>
                <p className="text-xs text-neutral-500 mt-1">Immutable security entries</p>
              </CardContent>
            </Card>
          </div>

          {/* Issue Priority & Status Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-neutral-200">Workload by Priority</CardTitle>
                <CardDescription className="text-xs text-neutral-500">Distribution of active sprint backlog</CardDescription>
              </CardHeader>
              <CardContent>
                {priorityData.length > 0 ? (
                  <ChartContainer config={{ count: { label: "Count" } }} className="h-[240px] w-full">
                    <BarChart data={priorityData}>
                      <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {priorityData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="h-[240px] flex items-center justify-center text-xs text-neutral-500">
                    No active tasks recorded yet
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-neutral-200">Workload by Workflow State</CardTitle>
                <CardDescription className="text-xs text-neutral-500">Task distribution across Kanban columns</CardDescription>
              </CardHeader>
              <CardContent>
                {statusData.length > 0 ? (
                  <ChartContainer config={{ count: { label: "Count" } }} className="h-[240px] w-full">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={75}
                        dataKey="value"
                      >
                        {statusData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ChartContainer>
                ) : (
                  <div className="h-[240px] flex items-center justify-center text-xs text-neutral-500">
                    No task status records found
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 2: AUDIT LOGS (ADM-03)                                     */}
        {/* ============================================================== */}
        <TabsContent value="audit-logs" className="space-y-4">
          <Card className="bg-neutral-900/60 border-neutral-800">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
              <div>
                <CardTitle className="text-base text-neutral-200">Immutable Audit Trail</CardTitle>
                <CardDescription className="text-xs text-neutral-400">
                  Every create, update, delete, configuration change, and data export is permanently recorded.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-neutral-800 text-xs text-neutral-300"
                  onClick={() => {
                    window.open(`/api/teams/${teamId}/export?entity=audit_logs&format=csv`, "_blank")
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Export Log CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filter controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-neutral-400">Action Filter</Label>
                  <Select value={auditFilterAction} onValueChange={setAuditFilterAction}>
                    <SelectTrigger className="h-8 mt-1 text-xs bg-neutral-950 border-neutral-800 text-neutral-200">
                      <SelectValue placeholder="All actions" />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-950 border-neutral-800 text-neutral-200">
                      <SelectItem value="all">All Actions</SelectItem>
                      <SelectItem value="CREATE">CREATE</SelectItem>
                      <SelectItem value="UPDATE">UPDATE</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                      <SelectItem value="EXPORT">EXPORT</SelectItem>
                      <SelectItem value="ENABLE">ENABLE</SelectItem>
                      <SelectItem value="DISABLE">DISABLE</SelectItem>
                      <SelectItem value="TEST_PING">TEST_PING</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-neutral-400">Entity Scope</Label>
                  <Select value={auditFilterEntity} onValueChange={setAuditFilterEntity}>
                    <SelectTrigger className="h-8 mt-1 text-xs bg-neutral-950 border-neutral-800 text-neutral-200">
                      <SelectValue placeholder="All entities" />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-950 border-neutral-800 text-neutral-200">
                      <SelectItem value="all">All Entities</SelectItem>
                      <SelectItem value="COMPANY_SETTINGS">COMPANY_SETTINGS</SelectItem>
                      <SelectItem value="AUTOMATION">AUTOMATION</SelectItem>
                      <SelectItem value="API_KEY">API_KEY</SelectItem>
                      <SelectItem value="WEBHOOK">WEBHOOK</SelectItem>
                      <SelectItem value="WORKSPACE">WORKSPACE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-neutral-400">Search Actor / ID</Label>
                  <Input
                    placeholder="Search userName or entityId..."
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    className="h-8 mt-1 text-xs bg-neutral-950 border-neutral-800 text-neutral-200"
                  />
                </div>
              </div>

              {/* Log Table */}
              <div className="rounded-lg border border-neutral-800 overflow-hidden">
                <Table>
                  <TableHeader className="bg-neutral-950/60">
                    <TableRow className="border-neutral-800">
                      <TableHead className="text-xs font-medium text-neutral-400">Timestamp</TableHead>
                      <TableHead className="text-xs font-medium text-neutral-400">Actor</TableHead>
                      <TableHead className="text-xs font-medium text-neutral-400">Action</TableHead>
                      <TableHead className="text-xs font-medium text-neutral-400">Entity Type</TableHead>
                      <TableHead className="text-xs font-medium text-neutral-400">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-neutral-500 text-xs">
                          Loading audit stream...
                        </TableCell>
                      </TableRow>
                    ) : !auditData?.logs?.length ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-neutral-500 text-xs">
                          No audit events recorded matching current filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      auditData.logs.map((log) => {
                        const dateStr = new Date(log.createdAt || log.timestamp || Date.now()).toLocaleString()
                        const actionColor =
                          log.action === "CREATE"
                            ? "bg-emerald-950/60 text-emerald-400 border-emerald-800"
                            : log.action === "DELETE" || log.action === "REVOKE"
                            ? "bg-rose-950/60 text-rose-400 border-rose-800"
                            : log.action === "UPDATE"
                            ? "bg-blue-950/60 text-blue-400 border-blue-800"
                            : "bg-neutral-800 text-neutral-300 border-neutral-700"

                        return (
                          <TableRow key={log.id} className="border-neutral-850 hover:bg-neutral-800/30">
                            <TableCell className="text-xs text-neutral-400 whitespace-nowrap">{dateStr}</TableCell>
                            <TableCell className="text-xs font-medium text-neutral-200">{log.userName || "System"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[10px] uppercase font-mono px-2 ${actionColor}`}>
                                {log.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-neutral-300 font-mono">{log.entityType}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs text-neutral-400 hover:text-neutral-100"
                                onClick={() => setSelectedLog(log)}
                              >
                                View Payload
                              </Button>
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

        {/* ============================================================== */}
        {/* TAB 3: AUTOMATIONS ENGINE (ADM-07)                             */}
        {/* ============================================================== */}
        <TabsContent value="automations" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-neutral-200">Event-Driven Automation Workflows</h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Automatically execute cross-module operations when CRM deals close, tasks delay, or meetings conclude.
              </p>
            </div>
            <Button
              size="sm"
              className="gap-1.5 bg-amber-600 hover:bg-amber-500 text-neutral-950 font-semibold"
              onClick={() => setIsAddAutoOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Create Automation
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {automationsLoading ? (
              <div className="col-span-full text-center py-8 text-neutral-500 text-xs">
                Loading automation workflows...
              </div>
            ) : !automationsData?.rules?.length ? (
              <div className="col-span-full text-center py-8 text-neutral-500 text-xs">
                No automation rules created yet.
              </div>
            ) : (
              automationsData.rules.map((rule) => (
                <Card
                  key={rule.id}
                  className={`border transition-all ${
                    rule.isActive
                      ? "bg-neutral-900/70 border-neutral-800"
                      : "bg-neutral-950/40 border-neutral-900 opacity-60"
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <CardTitle className="text-sm font-semibold text-neutral-100">{rule.name}</CardTitle>
                        <CardDescription className="text-xs text-neutral-400 line-clamp-2">
                          {rule.description || "Custom trigger action workflow"}
                        </CardDescription>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase font-mono ${
                          rule.isActive
                            ? "bg-emerald-950/40 text-emerald-400 border-emerald-800"
                            : "bg-neutral-800 text-neutral-400 border-neutral-700"
                        }`}
                      >
                        {rule.isActive ? "Active" : "Paused"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    {/* Visual workflow step */}
                    <div className="p-2.5 rounded-lg bg-neutral-950/80 border border-neutral-850 space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-amber-400">
                        <Zap className="h-3.5 w-3.5" />
                        <span className="font-semibold">When:</span>
                        <span className="text-neutral-300 font-mono text-[11px]">{rule.triggerType}</span>
                      </div>
                      <div className="flex items-center gap-2 text-blue-400">
                        <Play className="h-3.5 w-3.5" />
                        <span className="font-semibold">Then:</span>
                        <span className="text-neutral-300 font-mono text-[11px]">{rule.actionType}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-neutral-400 pt-1">
                      <span>Executions: <strong className="text-neutral-200">{rule.executionCount}</strong></span>
                      {rule.lastTriggeredAt && (
                        <span className="text-[11px] text-neutral-500">
                          Last: {new Date(rule.lastTriggeredAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-800/80">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-neutral-800 text-neutral-300 hover:text-white"
                        onClick={() => toggleAutomationMutation.mutate({ ruleId: rule.id, isActive: !rule.isActive })}
                      >
                        {rule.isActive ? "Pause" : "Enable"}
                      </Button>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-950/20 gap-1"
                          onClick={() => testRunAutomationMutation.mutate(rule.id)}
                        >
                          <Play className="h-3 w-3" />
                          Test Run
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-950/20"
                          onClick={() => deleteAutomationMutation.mutate(rule.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 4: COMPANY & TAX (ADM-04, ADM-05)                          */}
        {/* ============================================================== */}
        <TabsContent value="company" className="space-y-4">
          <Card className="bg-neutral-900/60 border-neutral-800">
            <CardHeader>
              <CardTitle className="text-base text-neutral-200">Legal Company & Tax Configuration</CardTitle>
              <CardDescription className="text-xs text-neutral-400">
                Configure your registered business entity, GSTIN, PAN, and billing preferences for automated invoices.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveCompany} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-neutral-300">Legal Business Name</Label>
                    <Input
                      placeholder="e.g. SketchItUp Studio Pvt Ltd"
                      value={companyForm.legalName}
                      onChange={(e) => setCompanyForm({ ...companyForm, legalName: e.target.value })}
                      className="bg-neutral-950 border-neutral-800 text-neutral-200 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-neutral-300">GSTIN (India GST ID)</Label>
                    <Input
                      placeholder="e.g. 27AADCB2230M1Z2"
                      value={companyForm.gstin}
                      onChange={(e) => setCompanyForm({ ...companyForm, gstin: e.target.value.toUpperCase() })}
                      className="bg-neutral-950 border-neutral-800 text-neutral-200 text-xs font-mono uppercase"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-neutral-300">PAN Number</Label>
                    <Input
                      placeholder="e.g. AADCB2230M"
                      value={companyForm.pan}
                      onChange={(e) => setCompanyForm({ ...companyForm, pan: e.target.value.toUpperCase() })}
                      className="bg-neutral-950 border-neutral-800 text-neutral-200 text-xs font-mono uppercase"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-neutral-300">Base Currency</Label>
                    <Select
                      value={companyForm.currency}
                      onValueChange={(val) => setCompanyForm({ ...companyForm, currency: val })}
                    >
                      <SelectTrigger className="bg-neutral-950 border-neutral-800 text-neutral-200 text-xs">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-950 border-neutral-800 text-neutral-200">
                        <SelectItem value="INR">INR (₹) - Indian Rupee</SelectItem>
                        <SelectItem value="USD">USD ($) - US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR (€) - Euro</SelectItem>
                        <SelectItem value="GBP">GBP (£) - British Pound</SelectItem>
                        <SelectItem value="AED">AED (د.إ) - UAE Dirham</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-neutral-300">Registered Office Address</Label>
                  <Input
                    placeholder="Floor 4, Enterprise Tech Park"
                    value={companyForm.address}
                    onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                    className="bg-neutral-950 border-neutral-800 text-neutral-200 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-neutral-300">City</Label>
                    <Input
                      placeholder="Bengaluru"
                      value={companyForm.city}
                      onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })}
                      className="bg-neutral-950 border-neutral-800 text-neutral-200 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-neutral-300">State</Label>
                    <Input
                      placeholder="Karnataka"
                      value={companyForm.state}
                      onChange={(e) => setCompanyForm({ ...companyForm, state: e.target.value })}
                      className="bg-neutral-950 border-neutral-800 text-neutral-200 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-neutral-300">Postal / Pin Code</Label>
                    <Input
                      placeholder="560001"
                      value={companyForm.pincode}
                      onChange={(e) => setCompanyForm({ ...companyForm, pincode: e.target.value })}
                      className="bg-neutral-950 border-neutral-800 text-neutral-200 text-xs"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    disabled={updateCompanyMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                  >
                    {updateCompanyMutation.isPending ? "Saving..." : "Save Company Profile"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 5: ROLES & PERMISSIONS (RBAC) (ADM-02)                     */}
        {/* ============================================================== */}
        <TabsContent value="roles" className="space-y-4">
          <Card className="bg-neutral-900/60 border-neutral-800">
            <CardHeader>
              <CardTitle className="text-base text-neutral-200">Role-Based Access Control (RBAC)</CardTitle>
              <CardDescription className="text-xs text-neutral-400">
                Visual matrix of system permissions across Founder, Project Manager, Developer, Sales, and Client roles.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-neutral-800 overflow-hidden">
                <Table>
                  <TableHeader className="bg-neutral-950/60">
                    <TableRow className="border-neutral-800">
                      <TableHead className="text-xs font-medium text-neutral-400">Capability / Area</TableHead>
                      <TableHead className="text-xs font-medium text-amber-400 text-center">Owner / Founder</TableHead>
                      <TableHead className="text-xs font-medium text-purple-400 text-center">Project Manager</TableHead>
                      <TableHead className="text-xs font-medium text-blue-400 text-center">Developer</TableHead>
                      <TableHead className="text-xs font-medium text-emerald-400 text-center">Sales / CRM</TableHead>
                      <TableHead className="text-xs font-medium text-neutral-400 text-center">Client / Viewer</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {[
                      { area: "Workspace Billing & GST", o: true, pm: false, d: false, s: false, c: false },
                      { area: "Developer API Keys & Webhooks", o: true, pm: false, d: true, s: false, c: false },
                      { area: "Full Audit Trail Access", o: true, pm: true, d: false, s: false, c: false },
                      { area: "Cross-Module Automations", o: true, pm: true, d: false, s: false, c: false },
                      { area: "Create & Lead Projects", o: true, pm: true, d: false, s: false, c: false },
                      { area: "Task Creation & Sprints", o: true, pm: true, d: true, s: false, c: false },
                      { area: "CRM Leads & Pipeline Deals", o: true, pm: true, d: false, s: true, c: false },
                      { area: "Client Deliverable Approval", o: true, pm: true, d: false, s: false, c: true },
                      { area: "Export Database CSV / JSON", o: true, pm: true, d: false, s: true, c: false },
                    ].map((row, idx) => (
                      <TableRow key={idx} className="border-neutral-850 hover:bg-neutral-800/30">
                        <TableCell className="font-medium text-neutral-300">{row.area}</TableCell>
                        <TableCell className="text-center">{row.o ? <CheckCircle2 className="h-4 w-4 text-emerald-400 inline" /> : <span className="text-neutral-600">—</span>}</TableCell>
                        <TableCell className="text-center">{row.pm ? <CheckCircle2 className="h-4 w-4 text-emerald-400 inline" /> : <span className="text-neutral-600">—</span>}</TableCell>
                        <TableCell className="text-center">{row.d ? <CheckCircle2 className="h-4 w-4 text-emerald-400 inline" /> : <span className="text-neutral-600">—</span>}</TableCell>
                        <TableCell className="text-center">{row.s ? <CheckCircle2 className="h-4 w-4 text-emerald-400 inline" /> : <span className="text-neutral-600">—</span>}</TableCell>
                        <TableCell className="text-center">{row.c ? <CheckCircle2 className="h-4 w-4 text-emerald-400 inline" /> : <span className="text-neutral-600">—</span>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 6: DEVELOPER API KEYS & WEBHOOKS (ADM-08)                  */}
        {/* ============================================================== */}
        <TabsContent value="developers" className="space-y-6">
          {/* SECTION 1: API KEYS */}
          <Card className="bg-neutral-900/60 border-neutral-800">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
              <div>
                <CardTitle className="text-base text-neutral-200">Developer API Keys</CardTitle>
                <CardDescription className="text-xs text-neutral-400">
                  Secure scoped tokens for automated CI/CD pipelines, custom scripts, and external tool integrations.
                </CardDescription>
              </div>
              <Button
                size="sm"
                className="gap-1.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold"
                onClick={() => {
                  setCreatedKeySecret(null)
                  setIsCreateKeyOpen(true)
                }}
              >
                <Plus className="h-4 w-4" />
                Generate API Key
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-neutral-800 overflow-hidden">
                <Table>
                  <TableHeader className="bg-neutral-950/60">
                    <TableRow className="border-neutral-800">
                      <TableHead className="text-xs font-medium text-neutral-400">Key Name</TableHead>
                      <TableHead className="text-xs font-medium text-neutral-400">Prefix Token</TableHead>
                      <TableHead className="text-xs font-medium text-neutral-400">Created By</TableHead>
                      <TableHead className="text-xs font-medium text-neutral-400">Created Date</TableHead>
                      <TableHead className="text-xs font-medium text-neutral-400">Status</TableHead>
                      <TableHead className="text-xs font-medium text-neutral-400 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keysLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-neutral-500 text-xs">
                          Loading API keys...
                        </TableCell>
                      </TableRow>
                    ) : !apiKeysData?.keys?.length ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-neutral-500 text-xs">
                          No developer API keys created yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      apiKeysData.keys.map((k) => (
                        <TableRow key={k.id} className="border-neutral-850 hover:bg-neutral-800/30">
                          <TableCell className="text-xs font-medium text-neutral-200">{k.name}</TableCell>
                          <TableCell className="text-xs font-mono text-purple-300">{k.keyPrefix}</TableCell>
                          <TableCell className="text-xs text-neutral-400">{k.createdByName}</TableCell>
                          <TableCell className="text-xs text-neutral-400">{new Date(k.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                k.isActive ? "bg-emerald-950/40 text-emerald-400 border-emerald-800" : "bg-neutral-800 text-neutral-500"
                              }`}
                            >
                              {k.isActive ? "Active" : "Disabled"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-xs text-neutral-400 hover:text-white"
                                onClick={() => toggleApiKeyMutation.mutate({ keyId: k.id, isActive: !k.isActive })}
                              >
                                {k.isActive ? "Disable" : "Enable"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-rose-400 hover:text-rose-300"
                                onClick={() => revokeApiKeyMutation.mutate(k.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* SECTION 2: WEBHOOK ENDPOINTS */}
          <Card className="bg-neutral-900/60 border-neutral-800">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
              <div>
                <CardTitle className="text-base text-neutral-200">Outgoing Webhooks</CardTitle>
                <CardDescription className="text-xs text-neutral-400">
                  Receive HTTP POST notifications whenever key events happen in your workspace.
                </CardDescription>
              </div>
              <Button
                size="sm"
                className="gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                onClick={() => setIsCreateWebhookOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Add Webhook
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {webhooksLoading ? (
                  <div className="text-center py-6 text-neutral-500 text-xs">Loading webhooks...</div>
                ) : !webhooksData?.webhooks?.length ? (
                  <div className="text-center py-6 text-neutral-500 text-xs">No webhooks registered yet.</div>
                ) : (
                  webhooksData.webhooks.map((wh) => (
                    <div
                      key={wh.id}
                      className="p-3.5 rounded-lg border border-neutral-800 bg-neutral-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-neutral-200 font-medium truncate">{wh.url}</span>
                          <Badge variant="outline" className="text-[10px] bg-emerald-950/40 text-emerald-400 border-emerald-800">
                            {wh.lastStatus || "Active"}
                          </Badge>
                        </div>
                        {wh.description && <p className="text-xs text-neutral-400">{wh.description}</p>}
                        <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                          <span>Secret: {wh.secret.slice(0, 10)}...</span>
                          <span>•</span>
                          <span>Deliveries: {wh._count?.deliveries || 0}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-neutral-800 text-neutral-300 gap-1 hover:text-white"
                          onClick={() => pingWebhookMutation.mutate(wh.id)}
                        >
                          <Play className="h-3 w-3 text-emerald-400" />
                          Ping Test
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-rose-400 hover:text-rose-300"
                          onClick={() => deleteWebhookMutation.mutate(wh.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 7: DATA EXPORT & BACKUP (ADM-06)                           */}
        {/* ============================================================== */}
        <TabsContent value="export" className="space-y-4">
          <Card className="bg-neutral-900/60 border-neutral-800">
            <CardHeader>
              <CardTitle className="text-base text-neutral-200">Data Export & Backup Manager</CardTitle>
              <CardDescription className="text-xs text-neutral-400">
                Generate immediate compliance CSV exports or complete disaster-recovery JSON snapshots of your team workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-neutral-950 border-neutral-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-400" />
                      Tasks & Issues CSV
                    </CardTitle>
                    <CardDescription className="text-xs text-neutral-400">
                      All backlog items, story points, workflow states, and assignees.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <Button
                      size="sm"
                      className="w-full text-xs gap-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200"
                      onClick={() => window.open(`/api/teams/${teamId}/export?entity=tasks&format=csv`, "_blank")}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download tasks.csv
                    </Button>
                  </CardContent>
                </Card>

                <Card className="bg-neutral-950 border-neutral-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
                      <Layers className="h-4 w-4 text-purple-400" />
                      Projects Register CSV
                    </CardTitle>
                    <CardDescription className="text-xs text-neutral-400">
                      All active project workspaces, members, and deliverable statistics.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <Button
                      size="sm"
                      className="w-full text-xs gap-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200"
                      onClick={() => window.open(`/api/teams/${teamId}/export?entity=projects&format=csv`, "_blank")}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download projects.csv
                    </Button>
                  </CardContent>
                </Card>

                <Card className="bg-neutral-950 border-neutral-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                      Complete Audit Trail CSV
                    </CardTitle>
                    <CardDescription className="text-xs text-neutral-400">
                      Immutable forensic log of all actions, users, and config modifications.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <Button
                      size="sm"
                      className="w-full text-xs gap-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200"
                      onClick={() => window.open(`/api/teams/${teamId}/export?entity=audit_logs&format=csv`, "_blank")}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download audit_logs.csv
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Complete JSON Disaster Backup Card */}
              <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-950/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
                    <Database className="h-4 w-4 text-amber-400" />
                    Full Workspace JSON Disaster Recovery Snapshot
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Exports team metadata, company settings, projects, issues, automations, and recent audit logs into an encrypted structured JSON archive.
                  </p>
                </div>
                <Button
                  className="bg-amber-600 hover:bg-amber-500 text-neutral-950 font-semibold text-xs gap-1.5 whitespace-nowrap self-start sm:self-auto"
                  onClick={() => window.open(`/api/teams/${teamId}/export?entity=all&format=json`, "_blank")}
                >
                  <Download className="h-4 w-4" />
                  Generate JSON Backup
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 8: SYSTEM DIAGNOSTICS & NEON DB (ADM-10)                   */}
        {/* ============================================================== */}
        <TabsContent value="diagnostics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-neutral-400 flex items-center gap-2">
                  <Database className="h-4 w-4 text-emerald-400" />
                  Database Engine
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-xl font-bold text-neutral-100">
                  {healthData?.database?.provider || "Neon PostgreSQL"}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="bg-emerald-950/40 text-emerald-400 border-emerald-800 text-[10px]">
                    {healthData?.database?.status || "OPTIMAL"}
                  </Badge>
                  <span className="text-neutral-400">Latency: {healthData?.database?.latencyMs || 0} ms</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-neutral-400 flex items-center gap-2">
                  <Server className="h-4 w-4 text-blue-400" />
                  Server Runtime
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-xl font-bold text-neutral-100">
                  Node {healthData?.server?.nodeVersion || process.version}
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  <span>Heap: {healthData?.server?.memory?.heapUsedMb || 0} MB</span>
                  <span>•</span>
                  <span>Uptime: {Math.round((healthData?.server?.uptimeSeconds || 0) / 60)} mins</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-neutral-400 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-purple-400" />
                  Workspace Integrity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-xl font-bold text-neutral-100">
                  {healthData?.status === "HEALTHY" ? "Operational" : "Degraded"}
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  <span>{healthData?.workspace?.activeAutomations || 0} Active Automations</span>
                  <span>•</span>
                  <span>{healthData?.workspace?.recordedAuditLogs || 0} Audits</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ============================================================== */}
      {/* MODAL: CREATE AUTOMATION RULE                                  */}
      {/* ============================================================== */}
      <Dialog open={isAddAutoOpen} onOpenChange={setIsAddAutoOpen}>
        <DialogContent className="bg-neutral-950 border-neutral-800 text-neutral-100">
          <DialogHeader>
            <DialogTitle className="text-base">Create Automation Rule</DialogTitle>
            <DialogDescription className="text-xs text-neutral-400">
              Configure trigger condition and automated system action.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateAutomation} className="space-y-3.5 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-neutral-300">Rule Name</Label>
              <Input
                placeholder="e.g. Lead Won -> Auto Provision Project"
                value={newAuto.name}
                onChange={(e) => setNewAuto({ ...newAuto, name: e.target.value })}
                className="bg-neutral-900 border-neutral-800 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-neutral-300">Description (Optional)</Label>
              <Input
                placeholder="Details of workflow..."
                value={newAuto.description}
                onChange={(e) => setNewAuto({ ...newAuto, description: e.target.value })}
                className="bg-neutral-900 border-neutral-800 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-neutral-300">When Event Triggers</Label>
                <Select
                  value={newAuto.triggerType}
                  onValueChange={(val) => setNewAuto({ ...newAuto, triggerType: val })}
                >
                  <SelectTrigger className="bg-neutral-900 border-neutral-800 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-100">
                    <SelectItem value="lead_won">Lead Won (CRM)</SelectItem>
                    <SelectItem value="task_overdue">Task Overdue</SelectItem>
                    <SelectItem value="meeting_completed">Meeting Concluded</SelectItem>
                    <SelectItem value="client_created">New Client Added</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-neutral-300">Then Execute Action</Label>
                <Select
                  value={newAuto.actionType}
                  onValueChange={(val) => setNewAuto({ ...newAuto, actionType: val })}
                >
                  <SelectTrigger className="bg-neutral-900 border-neutral-800 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-100">
                    <SelectItem value="create_project">Create Project</SelectItem>
                    <SelectItem value="escalate_task">Escalate Priority</SelectItem>
                    <SelectItem value="send_notification">Broadcast Alert</SelectItem>
                    <SelectItem value="create_channel">Open Team Channel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="submit"
                disabled={createAutomationMutation.isPending}
                className="bg-amber-600 hover:bg-amber-500 text-neutral-950 font-semibold text-xs"
              >
                {createAutomationMutation.isPending ? "Creating..." : "Save Automation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================== */}
      {/* MODAL: GENERATE DEVELOPER API KEY                              */}
      {/* ============================================================== */}
      <Dialog open={isCreateKeyOpen} onOpenChange={setIsCreateKeyOpen}>
        <DialogContent className="bg-neutral-950 border-neutral-800 text-neutral-100">
          <DialogHeader>
            <DialogTitle className="text-base">Generate Developer API Key</DialogTitle>
            <DialogDescription className="text-xs text-neutral-400">
              Create a cryptographically hashed token for developer tool integrations.
            </DialogDescription>
          </DialogHeader>

          {createdKeySecret ? (
            <div className="space-y-4 pt-2">
              <div className="p-3.5 rounded-lg bg-amber-950/30 border border-amber-800/60 text-xs text-amber-200 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-amber-400" />
                  Save this key now!
                </p>
                <p className="text-[11px] text-amber-300/80">
                  For security reasons, this token will never be displayed again.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-neutral-400">Secret Token</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={createdKeySecret}
                    className="bg-neutral-900 border-neutral-800 font-mono text-xs text-emerald-400"
                  />
                  <Button
                    size="sm"
                    className="gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs"
                    onClick={() => copyToClipboard(createdKeySecret, "API Key")}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
              </div>

              <DialogFooter>
                <Button
                  size="sm"
                  className="bg-neutral-800 hover:bg-neutral-700 text-xs text-white"
                  onClick={() => setIsCreateKeyOpen(false)}
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleCreateApiKey} className="space-y-3.5 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-neutral-300">Key Name</Label>
                <Input
                  placeholder="e.g. GitHub Actions CI Token"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="bg-neutral-900 border-neutral-800 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-neutral-300">Scopes</Label>
                <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-850 text-xs space-y-1.5 text-neutral-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>tasks:read & write</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>projects:read</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>crm:read</span>
                  </div>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="submit"
                  disabled={createApiKeyMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs"
                >
                  {createApiKeyMutation.isPending ? "Generating..." : "Generate Key"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ============================================================== */}
      {/* MODAL: REGISTER WEBHOOK ENDPOINT                               */}
      {/* ============================================================== */}
      <Dialog open={isCreateWebhookOpen} onOpenChange={setIsCreateWebhookOpen}>
        <DialogContent className="bg-neutral-950 border-neutral-800 text-neutral-100">
          <DialogHeader>
            <DialogTitle className="text-base">Register Outgoing Webhook</DialogTitle>
            <DialogDescription className="text-xs text-neutral-400">
              Provide HTTPS URL to receive event payloads when changes occur in this workspace.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateWebhook} className="space-y-3.5 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-neutral-300">Webhook Endpoint URL</Label>
              <Input
                placeholder="https://api.yourdomain.com/webhooks/erpos"
                value={newWebhookUrl}
                onChange={(e) => setNewWebhookUrl(e.target.value)}
                className="bg-neutral-900 border-neutral-800 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-neutral-300">Description (Optional)</Label>
              <Input
                placeholder="e.g. Slack Integration Server"
                value={newWebhookDesc}
                onChange={(e) => setNewWebhookDesc(e.target.value)}
                className="bg-neutral-900 border-neutral-800 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="submit"
                disabled={createWebhookMutation.isPending}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs"
              >
                {createWebhookMutation.isPending ? "Registering..." : "Register Webhook"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================== */}
      {/* MODAL: VIEW AUDIT PAYLOAD DETAILS                              */}
      {/* ============================================================== */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="bg-neutral-950 border-neutral-800 text-neutral-100 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Audit Event Details</DialogTitle>
            <DialogDescription className="text-xs text-neutral-400">
              {selectedLog?.action} on {selectedLog?.entityType} by {selectedLog?.userName || "System"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            <div className="text-xs text-neutral-400">
              Timestamp: {selectedLog ? new Date(selectedLog.createdAt || selectedLog.timestamp || Date.now()).toISOString() : ""}
            </div>
            <pre className="p-3 rounded-lg bg-neutral-900/90 border border-neutral-800 text-xs font-mono text-neutral-300 overflow-x-auto max-h-64">
              {selectedLog ? JSON.stringify(selectedLog.details, null, 2) : ""}
            </pre>
          </div>
          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-neutral-800 text-neutral-300"
              onClick={() => setSelectedLog(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
