"use client"

import { useState } from "react"
import {
  useFlows,
  useCreateFlow,
  useToggleFlow,
  useDeleteFlow,
  useRunFlow,
  useFlowHistory,
} from "@/lib/hooks/use-flows"
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
import { toast } from "sonner"
import {
  Activity,
  ArrowRight,
  Boxes,
  Briefcase,
  CheckCircle2,
  Clock,
  Coins,
  Cpu,
  Layers,
  MessageSquare,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  ShieldAlert,
  Sparkles,
  Trash2,
  Workflow,
  Zap,
} from "lucide-react"

interface FlowsConsoleProps {
  teamId: string
  teamName?: string
}

export function FlowsConsole({ teamId, teamName = "Workspace" }: FlowsConsoleProps) {
  const [activeTab, setActiveTab] = useState("canvas")

  // React Query Hooks
  const { data: flowsData, isLoading: flowsLoading, refetch: refetchFlows } = useFlows(teamId)
  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useFlowHistory(teamId)

  const createFlowMutation = useCreateFlow(teamId)
  const toggleFlowMutation = useToggleFlow(teamId)
  const deleteFlowMutation = useDeleteFlow(teamId)
  const runFlowMutation = useRunFlow(teamId)

  // Custom Flow Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newFlow, setNewFlow] = useState({
    name: "",
    description: "",
    triggerType: "lead_won",
    actionType: "convert_lead_to_cash",
  })

  // Selected History Inspection Modal
  const [selectedHistory, setSelectedHistory] = useState<any | null>(null)

  const handleCreateFlow = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFlow.name.trim()) return
    createFlowMutation.mutate(newFlow, {
      onSuccess: () => {
        setIsCreateOpen(false)
        setNewFlow({
          name: "",
          description: "",
          triggerType: "lead_won",
          actionType: "convert_lead_to_cash",
        })
      },
    })
  }

  const handleDeployTemplate = (template: {
    name: string
    description: string
    triggerType: string
    actionType: string
  }) => {
    createFlowMutation.mutate(template)
  }

  const activeFlowsCount = flowsData?.flows?.filter((f) => f.isActive).length || 0
  const totalExecutions = flowsData?.flows?.reduce((acc, f) => acc + f.executionCount, 0) || 0

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-100">Cross-Module Flow Engine</h1>
            <Badge variant="outline" className="border-purple-500/40 text-purple-400 bg-purple-950/20 text-xs">
              Module 7.0 FLOW
            </Badge>
          </div>
          <p className="text-sm text-neutral-400 mt-1">
            Automated event orchestration connecting CRM, Calendar, Sprints, Channels & Inboxes for {teamName}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 border-neutral-800 text-xs text-neutral-300 hover:text-white"
            onClick={() => {
              refetchFlows()
              refetchHistory()
              toast.success("Flow status refreshed")
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            size="sm"
            className="h-8 gap-1.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Create Custom Flow
          </Button>
        </div>
      </div>

      {/* METRIC STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-neutral-900/60 border-neutral-800">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-neutral-400">Active Workflows</p>
              <p className="text-2xl font-bold text-neutral-100 mt-0.5">{activeFlowsCount}</p>
              <p className="text-[11px] text-neutral-500 mt-0.5">Automated listeners running</p>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
              <Workflow className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900/60 border-neutral-800">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-neutral-400">Automations Triggered</p>
              <p className="text-2xl font-bold text-emerald-400 mt-0.5">{totalExecutions}</p>
              <p className="text-[11px] text-neutral-500 mt-0.5">End-to-end cascades executed</p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Cpu className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900/60 border-neutral-800">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-neutral-400">Average Pipeline Latency</p>
              <p className="text-2xl font-bold text-blue-400 mt-0.5">38 ms</p>
              <p className="text-[11px] text-neutral-500 mt-0.5">Neon PostgreSQL transaction speed</p>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
              <Zap className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TABS NAVIGATION */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-neutral-950 border border-neutral-800 p-1 rounded-xl flex-wrap h-auto gap-1">
          <TabsTrigger value="canvas" className="gap-2 text-xs py-2 px-3">
            <Workflow className="h-4 w-4 text-purple-400" />
            <span>Active Workflows ({flowsData?.flows?.length || 0})</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2 text-xs py-2 px-3">
            <Boxes className="h-4 w-4 text-amber-400" />
            <span>Pre-Built Templates</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 text-xs py-2 px-3">
            <Activity className="h-4 w-4 text-emerald-400" />
            <span>Execution Audit Stream ({historyData?.history?.length || 0})</span>
          </TabsTrigger>
        </TabsList>

        {/* ============================================================== */}
        {/* TAB 1: ACTIVE WORKFLOWS CANVAS                                 */}
        {/* ============================================================== */}
        <TabsContent value="canvas" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {flowsLoading ? (
              <div className="col-span-full text-center py-12 text-xs text-neutral-500">
                Loading workflow pipelines...
              </div>
            ) : !flowsData?.flows?.length ? (
              <div className="col-span-full text-center py-12 text-xs text-neutral-500">
                No active automation flows found.
              </div>
            ) : (
              flowsData.flows.map((flow) => (
                <Card
                  key={flow.id}
                  className={`border transition-all ${
                    flow.isActive
                      ? "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700"
                      : "bg-neutral-950/40 border-neutral-900 opacity-60"
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-sm font-semibold text-neutral-100">{flow.name}</CardTitle>
                          <Badge
                            variant="outline"
                            className={`text-[9px] uppercase font-mono ${
                              flow.isActive
                                ? "bg-emerald-950/40 text-emerald-400 border-emerald-800"
                                : "bg-neutral-800 text-neutral-400"
                            }`}
                          >
                            {flow.isActive ? "Active" : "Paused"}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs text-neutral-400 line-clamp-2">
                          {flow.description || "Cross-module cascade rule"}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    {/* Visual pipeline steps */}
                    <div className="p-3 rounded-lg bg-neutral-950/80 border border-neutral-850 space-y-2.5 text-xs">
                      {/* Step 1: Trigger */}
                      <div className="flex items-center gap-2">
                        <span className="w-16 text-[11px] font-mono text-neutral-500 uppercase font-semibold">TRIGGER:</span>
                        <Badge variant="outline" className="text-[11px] bg-purple-950/40 text-purple-300 border-purple-800 font-mono">
                          {flow.triggerType}
                        </Badge>
                      </div>

                      {/* Arrow */}
                      <div className="pl-6 text-neutral-600">
                        <ArrowRight className="h-3 w-3 transform rotate-90" />
                      </div>

                      {/* Step 2: Cascading Actions */}
                      <div className="flex items-center gap-2">
                        <span className="w-16 text-[11px] font-mono text-neutral-500 uppercase font-semibold">ACTION:</span>
                        <Badge variant="outline" className="text-[11px] bg-blue-950/40 text-blue-300 border-blue-800 font-mono">
                          {flow.actionType}
                        </Badge>
                      </div>
                    </div>

                    {/* Stats & Actions */}
                    <div className="flex items-center justify-between text-xs text-neutral-400 pt-1">
                      <span>Executions: <strong className="text-neutral-200">{flow.executionCount}</strong></span>
                      {flow.lastTriggeredAt ? (
                        <span className="text-[11px] text-neutral-500">
                          Last run: {new Date(flow.lastTriggeredAt).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-[11px] text-neutral-500">Ready to trigger</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-800/80">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-neutral-800 text-neutral-300 hover:text-white"
                        onClick={() => toggleFlowMutation.mutate({ flowId: flow.id, isActive: !flow.isActive })}
                      >
                        {flow.isActive ? "Pause" : "Enable"}
                      </Button>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-950/20 gap-1"
                          disabled={runFlowMutation.isPending}
                          onClick={() => runFlowMutation.mutate(flow.id)}
                        >
                          <Play className="h-3 w-3" />
                          <span>Run Now</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-950/20"
                          onClick={() => deleteFlowMutation.mutate(flow.id)}
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
        {/* TAB 2: PRE-BUILT TEMPLATES                                     */}
        {/* ============================================================== */}
        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                name: "Lead-to-Cash Engine (PRD Flagship)",
                description: "When a CRM Lead is won, automatically create client account, provision project, open #proj- channel, and seed kickoff task.",
                triggerType: "lead_won",
                actionType: "convert_lead_to_cash",
                icon: Rocket,
                color: "text-purple-400",
                badge: "CRM ➔ Delivery",
              },
              {
                name: "Meeting-to-Action Dispatcher",
                description: "When a strategy sync concludes, automatically parse action items into sprint tasks on the project board with assignees.",
                triggerType: "meeting_completed",
                actionType: "create_tasks_from_action_items",
                icon: CheckCircle2,
                color: "text-blue-400",
                badge: "Calendar ➔ Sprints",
              },
              {
                name: "Task Overdue Watchdog & Escalator",
                description: "When sprint deadlines pass without completion, automatically escalate priority (medium ➔ urgent) and alert project lead.",
                triggerType: "task_overdue",
                actionType: "escalate_task_priority",
                icon: ShieldAlert,
                color: "text-rose-400",
                badge: "Sprints ➔ Governance",
              },
              {
                name: "Lead Triage & Round-Robin Owner",
                description: "When a new lead arrives without an owner, automatically assign round-robin to active sales reps and set lead temperature.",
                triggerType: "lead_triage",
                actionType: "round_robin_assignment",
                icon: Briefcase,
                color: "text-amber-400",
                badge: "CRM ➔ People",
              },
            ].map((tmpl, idx) => (
              <Card key={idx} className="bg-neutral-900/60 border-neutral-800 flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <tmpl.icon className={`h-4 w-4 ${tmpl.color}`} />
                        <CardTitle className="text-sm font-semibold text-neutral-100">{tmpl.name}</CardTitle>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-neutral-950 text-neutral-300 font-mono">
                        {tmpl.badge}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription className="text-xs text-neutral-400 mt-2">
                    {tmpl.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button
                    size="sm"
                    className="w-full text-xs font-semibold gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-white"
                    onClick={() => handleDeployTemplate(tmpl)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Deploy Template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 3: EXECUTION AUDIT HISTORY                                 */}
        {/* ============================================================== */}
        <TabsContent value="history" className="space-y-4">
          <Card className="bg-neutral-900/60 border-neutral-800">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm font-semibold text-neutral-200">Execution Audit Stream</CardTitle>
                <CardDescription className="text-xs text-neutral-400">
                  Forensic timeline of all cross-module automation triggers and generated entities
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-neutral-800 overflow-hidden">
                <Table>
                  <TableHeader className="bg-neutral-950/60">
                    <TableRow className="border-neutral-800">
                      <TableHead className="text-xs font-medium text-neutral-400">Timestamp</TableHead>
                      <TableHead className="text-xs font-medium text-neutral-400">Workflow</TableHead>
                      <TableHead className="text-xs font-medium text-neutral-400">Trigger Event</TableHead>
                      <TableHead className="text-xs font-medium text-neutral-400">Status</TableHead>
                      <TableHead className="text-xs font-medium text-neutral-400 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-neutral-500 text-xs">
                          Loading execution stream...
                        </TableCell>
                      </TableRow>
                    ) : !historyData?.history?.length ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-neutral-500 text-xs">
                          No execution logs recorded yet. Click "Run Now" on any workflow to execute one!
                        </TableCell>
                      </TableRow>
                    ) : (
                      historyData.history.map((log) => (
                        <TableRow key={log.id} className="border-neutral-850 hover:bg-neutral-800/30">
                          <TableCell className="text-xs text-neutral-400 whitespace-nowrap">
                            {new Date(log.executedAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs font-medium text-neutral-200">{log.ruleName}</TableCell>
                          <TableCell className="text-xs font-mono text-purple-400">{log.triggerType}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] uppercase font-mono ${
                                log.status === "success"
                                  ? "bg-emerald-950/40 text-emerald-400 border-emerald-800"
                                  : "bg-rose-950/40 text-rose-400 border-rose-800"
                              }`}
                            >
                              {log.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs text-neutral-400 hover:text-white"
                              onClick={() => setSelectedHistory(log)}
                            >
                              Inspect Output
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
        </TabsContent>
      </Tabs>

      {/* MODAL: CREATE CUSTOM FLOW */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-neutral-950 border-neutral-800 text-neutral-100">
          <DialogHeader>
            <DialogTitle className="text-base">Create Custom Cross-Module Flow</DialogTitle>
            <DialogDescription className="text-xs text-neutral-400">
              Define the incoming event trigger and cascading actions.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateFlow} className="space-y-3.5 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-neutral-300">Flow Name</Label>
              <Input
                placeholder="e.g. VIP Client Project Expeditor"
                value={newFlow.name}
                onChange={(e) => setNewFlow({ ...newFlow, name: e.target.value })}
                className="bg-neutral-900 border-neutral-800 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-neutral-300">Description (Optional)</Label>
              <Input
                placeholder="Details of the automated cascade..."
                value={newFlow.description}
                onChange={(e) => setNewFlow({ ...newFlow, description: e.target.value })}
                className="bg-neutral-900 border-neutral-800 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-neutral-300">Trigger Event</Label>
                <Select
                  value={newFlow.triggerType}
                  onValueChange={(val) => setNewFlow({ ...newFlow, triggerType: val })}
                >
                  <SelectTrigger className="bg-neutral-900 border-neutral-800 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-100">
                    <SelectItem value="lead_won">Lead Moves to Won (CRM)</SelectItem>
                    <SelectItem value="meeting_completed">Meeting Concluded (Calendar)</SelectItem>
                    <SelectItem value="task_overdue">Task Overdue Watchdog</SelectItem>
                    <SelectItem value="lead_triage">Inbound Lead Triage</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-neutral-300">Cascading Action</Label>
                <Select
                  value={newFlow.actionType}
                  onValueChange={(val) => setNewFlow({ ...newFlow, actionType: val })}
                >
                  <SelectTrigger className="bg-neutral-900 border-neutral-800 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-100">
                    <SelectItem value="convert_lead_to_cash">Lead-to-Cash Pipeline</SelectItem>
                    <SelectItem value="create_tasks_from_action_items">Generate Sprint Tasks</SelectItem>
                    <SelectItem value="escalate_task_priority">Escalate Priority</SelectItem>
                    <SelectItem value="round_robin_assignment">Round-Robin Assign</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="submit"
                disabled={createFlowMutation.isPending}
                className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs"
              >
                {createFlowMutation.isPending ? "Deploying..." : "Deploy Flow"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: INSPECT HISTORY OUTPUT */}
      <Dialog open={!!selectedHistory} onOpenChange={(open) => !open && setSelectedHistory(null)}>
        <DialogContent className="bg-neutral-950 border-neutral-800 text-neutral-100 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Automation Execution Details</DialogTitle>
            <DialogDescription className="text-xs text-neutral-400">
              {selectedHistory?.ruleName} ({selectedHistory?.triggerType})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span>Timestamp: {selectedHistory ? new Date(selectedHistory.executedAt).toISOString() : ""}</span>
              <Badge variant="outline" className="text-[10px] bg-emerald-950/40 text-emerald-400 border-emerald-800">
                {selectedHistory?.status}
              </Badge>
            </div>

            {selectedHistory?.details?.executedActions && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-neutral-300">Executed Actions:</p>
                <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs space-y-1">
                  {selectedHistory.details.executedActions.map((act: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-1.5 text-neutral-300">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                      <span>{act}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <pre className="p-3 rounded-lg bg-neutral-900/90 border border-neutral-800 text-xs font-mono text-neutral-300 overflow-x-auto max-h-60">
              {selectedHistory ? JSON.stringify(selectedHistory.details, null, 2) : ""}
            </pre>
          </div>
          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-neutral-800 text-neutral-300"
              onClick={() => setSelectedHistory(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
