"use client"

import { useState, useEffect, useMemo } from "react"
import { useActiveTeam } from "@/lib/context/team-context"
import { useProjects } from "@/lib/hooks/use-projects"
import { useIssues } from "@/lib/hooks/use-issues"
import {
  useTimesheets,
  useCreateOrGetTimesheet,
  useSubmitTimesheet,
  useApproveTimesheet,
  useRejectTimesheet,
  useLogTimeEntry,
  useDeleteTimeEntry,
  useResourceAllocations,
  useUpsertAllocation,
  useDeleteAllocation,
  useTimesheetsAnalytics,
  TimeEntryItem,
  TimesheetRecord,
} from "@/lib/hooks/use-timesheets"
function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}
import {
  Clock,
  Play,
  Pause,
  Square,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Send,
  Users,
  BarChart3,
  Layers,
  Sparkles,
  Lock,
  Unlock,
  Briefcase,
  DollarSign,
  Target,
  FileCheck2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function formatDateDisplay(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const CATEGORIES = [
  { value: "DEVELOPMENT", label: "Software Development" },
  { value: "DESIGN", label: "UI / UX Design" },
  { value: "CODE_REVIEW", label: "Code Review & PR" },
  { value: "MEETING", label: "Client & Team Meeting" },
  { value: "BUG_FIX", label: "Bug Investigation & Fix" },
  { value: "DEVOPS", label: "DevOps & Infrastructure" },
  { value: "OTHER", label: "General & Administrative" },
]

export function TimesheetsConsole() {
  const { teamId } = useActiveTeam()
  const [currentWeekDate, setCurrentWeekDate] = useState<Date>(() => getMonday(new Date()))
  const weekStartStr = currentWeekDate.toISOString().split("T")[0]

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(currentWeekDate)
      day.setDate(day.getDate() + i)
      return {
        date: day,
        dateStr: day.toISOString().split("T")[0],
        dayName: day.toLocaleDateString("en-US", { weekday: "short" }),
        formatted: day.toLocaleDateString("en-US", { month: "numeric", day: "numeric" }),
      }
    })
  }, [currentWeekDate])

  const weekEndDisplay = useMemo(() => {
    const end = new Date(currentWeekDate)
    end.setDate(end.getDate() + 6)
    return formatDateDisplay(end)
  }, [currentWeekDate])

  // Queries
  const { data: myTimesheetsData, isLoading: loadingMySheet } = useTimesheets(teamId, {
    scope: "my",
    weekStartDate: weekStartStr,
  })
  const { data: teamTimesheetsData, isLoading: loadingTeamSheets } = useTimesheets(teamId, {
    scope: "team",
    weekStartDate: weekStartStr,
  })
  const { data: allocationsData, isLoading: loadingAllocations } = useResourceAllocations(
    teamId,
    weekStartStr
  )
  const { data: analyticsData } = useTimesheetsAnalytics(teamId)
  const { data: projects = [] } = useProjects(teamId)
  const { data: issues = [] } = useIssues(teamId)

  // Mutations
  const createOrGetSheetMutation = useCreateOrGetTimesheet(teamId)
  const submitSheetMutation = useSubmitTimesheet(teamId)
  const approveSheetMutation = useApproveTimesheet(teamId)
  const rejectSheetMutation = useRejectTimesheet(teamId)
  const logEntryMutation = useLogTimeEntry(teamId)
  const deleteEntryMutation = useDeleteTimeEntry(teamId)
  const upsertAllocationMutation = useUpsertAllocation(teamId)
  const deleteAllocationMutation = useDeleteAllocation(teamId)

  const activeTimesheet: TimesheetRecord | undefined = myTimesheetsData?.timesheets?.[0]
  const isManager = Boolean(myTimesheetsData?.isManager)

  // State: Log Time Modal
  const [logModalOpen, setLogModalOpen] = useState(false)
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().split("T")[0])
  const [entryHours, setEntryHours] = useState("1.0")
  const [entryDesc, setEntryDesc] = useState("")
  const [entryProject, setEntryProject] = useState("")
  const [entryIssue, setEntryIssue] = useState("")
  const [entryCategory, setEntryCategory] = useState("DEVELOPMENT")
  const [entryBillable, setEntryBillable] = useState(true)

  // State: Rejection Dialog
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectTargetId, setRejectTargetId] = useState("")
  const [rejectReason, setRejectReason] = useState("")

  // State: Allocation Modal
  const [allocModalOpen, setAllocModalOpen] = useState(false)
  const [allocUser, setAllocUser] = useState("")
  const [allocProject, setAllocProject] = useState("")
  const [allocHours, setAllocHours] = useState("20")
  const [allocRole, setAllocRole] = useState("")
  const [allocIsContractor, setAllocIsContractor] = useState(false)
  const [allocContractorRate, setAllocContractorRate] = useState("1500")

  // State: Live Stopwatch Timer Widget
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerProject, setTimerProject] = useState("")
  const [timerIssue, setTimerIssue] = useState("")
  const [timerDesc, setTimerDesc] = useState("")

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [timerRunning])

  const formatTimerClock = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  }

  const handleStopAndLogTimer = async () => {
    if (timerSeconds < 60) {
      toast.info("Timer logged under 1 minute; minimum logged increment is 0.1h")
    }
    const computedHours = Math.max(Number((timerSeconds / 3600).toFixed(2)), 0.1)
    const desc = timerDesc.trim() || "Live Stopwatch task timer log"

    try {
      await logEntryMutation.mutateAsync({
        timesheetId: activeTimesheet?.id,
        date: new Date().toISOString().split("T")[0],
        hours: computedHours,
        description: desc,
        projectId: timerProject || null,
        issueId: timerIssue || null,
        isTimer: true,
      })
      setTimerRunning(false)
      setTimerSeconds(0)
      setTimerDesc("")
    } catch {
      // toast handled in mutation
    }
  }

  // Week navigation
  const prevWeek = () => {
    const prev = new Date(currentWeekDate)
    prev.setDate(prev.getDate() - 7)
    setCurrentWeekDate(prev)
  }

  const nextWeek = () => {
    const next = new Date(currentWeekDate)
    next.setDate(next.getDate() + 7)
    setCurrentWeekDate(next)
  }

  const jumpToThisWeek = () => {
    setCurrentWeekDate(getMonday(new Date()))
  }

  const handleLogManualEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!entryDesc.trim()) {
      toast.error("Please provide a description of the work done")
      return
    }
    try {
      await logEntryMutation.mutateAsync({
        timesheetId: activeTimesheet?.id,
        date: entryDate,
        hours: Number(entryHours),
        description: entryDesc.trim(),
        projectId: entryProject || null,
        issueId: entryIssue || null,
        category: entryCategory,
        isBillable: entryBillable,
      })
      setLogModalOpen(false)
      setEntryDesc("")
      setEntryHours("1.0")
    } catch {
      // Error handled
    }
  }

  const handleUpsertAlloc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!allocUser || !allocProject) {
      toast.error("Select both team member and project")
      return
    }
    try {
      await upsertAllocationMutation.mutateAsync({
        userId: allocUser,
        projectId: allocProject,
        weekStartDate: weekStartStr,
        allocatedHours: Number(allocHours),
        role: allocRole || undefined,
        isContractor: allocIsContractor,
        contractorRate: allocIsContractor ? Number(allocContractorRate) : undefined,
      })
      setAllocModalOpen(false)
    } catch {
      // Error handled
    }
  }

  // Calculate daily totals for active timesheet
  const dailyHoursMap = useMemo(() => {
    const map: Record<string, number> = {}
    weekDays.forEach((d) => (map[d.dateStr] = 0))
    if (activeTimesheet?.entries) {
      activeTimesheet.entries.forEach((entry) => {
        const dStr = new Date(entry.date).toISOString().split("T")[0]
        map[dStr] = (map[dStr] || 0) + entry.hours
      })
    }
    return map
  }, [weekDays, activeTimesheet])

  const isSheetLocked = activeTimesheet?.status === "APPROVED"

  return (
    <div className="space-y-6">
      {/* Top Header & Week Navigator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl border border-border/40 bg-card/40 backdrop-blur">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Timesheets & Resource Planning
                <Badge variant="outline" className="text-[10px] font-mono border-indigo-500/30 text-indigo-400">
                  TIME
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Work log timers, weekly manager approvals, developer capacity allocation & estimate accuracy
              </p>
            </div>
          </div>
        </div>

        {/* Week Selector Controls */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0 border-border/40 hover:bg-muted/40"
            onClick={prevWeek}
            title="Previous week"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs font-semibold px-2.5 border border-border/30 hover:bg-muted/40 flex items-center gap-1.5"
            onClick={jumpToThisWeek}
          >
            <CalendarIcon className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              {formatDateDisplay(currentWeekDate)} – {weekEndDisplay}
            </span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0 border-border/40 hover:bg-muted/40"
            onClick={nextWeek}
            title="Next week"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>

          <Button
            size="sm"
            disabled={isSheetLocked}
            className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white ml-2 flex items-center gap-1.5"
            onClick={() => setLogModalOpen(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            Log Work
          </Button>
        </div>
      </div>

      {/* Live Stopwatch Task Timer Bar */}
      <Card className="border-border/40 bg-gradient-to-r from-card/80 to-muted/20">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-lg border ${timerRunning ? "bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse" : "bg-muted/40 border-border/40 text-muted-foreground"}`}>
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Live Stopwatch Task Timer
              </div>
              <div className="text-2xl font-mono font-bold tracking-tight text-foreground">
                {formatTimerClock(timerSeconds)}
              </div>
            </div>
          </div>

          <div className="flex flex-1 max-w-xl items-center gap-2.5">
            <Select value={timerProject} onValueChange={setTimerProject} disabled={timerRunning}>
              <SelectTrigger className="h-8 text-xs w-[140px] bg-background/50 border-border/40">
                <SelectValue placeholder="Project..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={timerDesc}
              onChange={(e) => setTimerDesc(e.target.value)}
              placeholder="What are you currently executing?..."
              className="h-8 text-xs bg-background/50 border-border/40 flex-1"
            />
          </div>

          <div className="flex items-center gap-2">
            {!timerRunning ? (
              <Button
                size="sm"
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5"
                onClick={() => setTimerRunning(true)}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Start Timer
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10 flex items-center gap-1.5"
                  onClick={() => setTimerRunning(false)}
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  Pause
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5"
                  onClick={handleStopAndLogTimer}
                  disabled={logEntryMutation.isPending}
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  Stop & Log
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs Navigation */}
      <Tabs defaultValue="my-sheet" className="space-y-4">
        <TabsList className="bg-muted/30 border border-border/40 p-1">
          <TabsTrigger value="my-sheet" className="text-xs data-[state=active]:bg-card flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            My Weekly Timesheet
          </TabsTrigger>
          <TabsTrigger value="team-reviews" className="text-xs data-[state=active]:bg-card flex items-center gap-1.5">
            <FileCheck2 className="w-3.5 h-3.5" />
            Team Approvals & Reviews
            {teamTimesheetsData?.timesheets?.some((t) => t.status === "SUBMITTED") && (
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block animate-pulse" />
            )}
          </TabsTrigger>
          <TabsTrigger value="capacity-planning" className="text-xs data-[state=active]:bg-card flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            Capacity & Resource Allocation
          </TabsTrigger>
          <TabsTrigger value="utilization-analytics" className="text-xs data-[state=active]:bg-card flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            Utilization & Estimate Accuracy
          </TabsTrigger>
        </TabsList>

        {/* ========================================================================= */}
        {/* TAB 1: MY WEEKLY TIMESHEET */}
        {/* ========================================================================= */}
        <TabsContent value="my-sheet" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Total Hours Card */}
            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Total Hours This Week</div>
                <div className="text-2xl font-bold font-mono text-foreground mt-1">
                  {(activeTimesheet?.totalHours || 0).toFixed(1)} hrs
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Standard target: 40.0 hrs
                </div>
              </CardContent>
            </Card>

            {/* Billable Ratio Card */}
            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Billable Hours</div>
                <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                  {(activeTimesheet?.billableHours || 0).toFixed(1)} hrs
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {activeTimesheet?.totalHours
                    ? `${Math.round(((activeTimesheet.billableHours || 0) / activeTimesheet.totalHours) * 100)}% billable ratio`
                    : "0% billable ratio"}
                </div>
              </CardContent>
            </Card>

            {/* Approval Status Card */}
            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Timesheet Status</div>
                <div className="mt-1 flex items-center gap-2">
                  {activeTimesheet?.status === "APPROVED" ? (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">
                      <Lock className="w-3 h-3" /> Approved & Locked
                    </Badge>
                  ) : activeTimesheet?.status === "SUBMITTED" ? (
                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1">
                      <Send className="w-3 h-3" /> Pending Review
                    </Badge>
                  ) : activeTimesheet?.status === "REJECTED" ? (
                    <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 gap-1">
                      <XCircle className="w-3 h-3" /> Rejected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground border-border/50 gap-1">
                      <Unlock className="w-3 h-3" /> Draft (In Progress)
                    </Badge>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {activeTimesheet?.approvedBy
                    ? `Approved by ${activeTimesheet.approvedBy}`
                    : "Editable by developer"}
                </div>
              </CardContent>
            </Card>

            {/* Action Card: Submit Sheet */}
            <Card className="border-border/40 bg-card/60 flex items-center p-4">
              <div className="w-full space-y-2">
                {activeTimesheet?.status === "DRAFT" || activeTimesheet?.status === "REJECTED" ? (
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5"
                    disabled={submitSheetMutation.isPending || (activeTimesheet?.totalHours || 0) === 0}
                    onClick={() => {
                      if (activeTimesheet) {
                        submitSheetMutation.mutate({ timesheetId: activeTimesheet.id })
                      }
                    }}
                  >
                    <Send className="w-3.5 h-3.5" />
                    Submit for Approval
                  </Button>
                ) : activeTimesheet?.status === "SUBMITTED" ? (
                  <div className="text-xs text-amber-400/90 text-center py-1">
                    Submitted! Waiting for manager review.
                  </div>
                ) : (
                  <div className="text-xs text-emerald-400/90 text-center py-1 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Locked & Certified
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Rejection alert banner if rejected */}
          {activeTimesheet?.status === "REJECTED" && (
            <div className="p-3.5 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <div>
                <span className="font-semibold">Reviewer Rejection Note: </span>
                {activeTimesheet.rejectionReason || "Please adjust hours and resubmit."}
              </div>
            </div>
          )}

          {/* Daily Hours Heat Strip */}
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((d) => {
              const dayTotal = dailyHoursMap[d.dateStr] || 0
              const isToday = new Date().toISOString().split("T")[0] === d.dateStr
              return (
                <div
                  key={d.dateStr}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    isToday
                      ? "border-indigo-500/50 bg-indigo-500/10"
                      : "border-border/30 bg-card/40"
                  }`}
                >
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase">
                    {d.dayName}
                  </div>
                  <div className="text-xs text-muted-foreground/80">{d.formatted}</div>
                  <div
                    className={`mt-1 text-sm font-bold font-mono ${
                      dayTotal >= 8
                        ? "text-emerald-400"
                        : dayTotal > 0
                        ? "text-foreground"
                        : "text-muted-foreground/40"
                    }`}
                  >
                    {dayTotal.toFixed(1)}h
                  </div>
                </div>
              )
            })}
          </div>

          {/* Detailed Entries Table */}
          <Card className="border-border/40 bg-card/60">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Weekly Time Entries</CardTitle>
                <CardDescription className="text-xs">
                  Itemized tasks and timestamps logged against projects & tickets
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={isSheetLocked}
                className="h-7 text-xs border-border/40 hover:bg-muted/30 gap-1"
                onClick={() => setLogModalOpen(true)}
              >
                <Plus className="w-3 h-3" /> Add Entry
              </Button>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              {loadingMySheet ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Loading timesheet records...
                </div>
              ) : !activeTimesheet || activeTimesheet.entries.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground space-y-3">
                  <div className="p-3 w-10 h-10 rounded-full bg-muted/40 text-muted-foreground mx-auto flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>No hours logged for this week yet.</div>
                  <Button
                    size="sm"
                    disabled={isSheetLocked}
                    className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
                    onClick={() => setLogModalOpen(true)}
                  >
                    Log First Time Entry
                  </Button>
                </div>
              ) : (
                <div className="rounded border border-border/30 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/30 bg-muted/20 text-[11px]">
                        <TableHead className="w-[100px]">Date</TableHead>
                        <TableHead>Project / Ticket</TableHead>
                        <TableHead>Activity & Work Description</TableHead>
                        <TableHead className="w-[120px]">Category</TableHead>
                        <TableHead className="w-[80px] text-center">Billable</TableHead>
                        <TableHead className="w-[80px] text-right">Hours</TableHead>
                        <TableHead className="w-[60px] text-center">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeTimesheet.entries.map((entry) => (
                        <TableRow key={entry.id} className="border-border/30 text-xs">
                          <TableCell className="font-mono text-muted-foreground">
                            {new Date(entry.date).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "numeric",
                              day: "numeric",
                            })}
                          </TableCell>
                          <TableCell>
                            {entry.project ? (
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: entry.project.color }}
                                />
                                <span className="font-medium text-foreground">{entry.project.name}</span>
                                {entry.issue && (
                                  <Badge variant="outline" className="text-[10px] font-mono border-border/40">
                                    #{entry.issue.number}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic">General / Internal</span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {entry.description}
                            {entry.isTimer && (
                              <span className="ml-2 text-[10px] text-amber-400 font-mono">
                                [Stopwatch Timer]
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-[11px] text-muted-foreground">
                              {entry.category.replace("_", " ")}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {entry.isBillable ? (
                              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                                Billable
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground text-[10px]">
                                Internal
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-foreground">
                            {entry.hours.toFixed(1)}h
                          </TableCell>
                          <TableCell className="text-center">
                            {!isSheetLocked && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-400"
                                onClick={() => deleteEntryMutation.mutate(entry.id)}
                                title="Delete time entry"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 2: TEAM APPROVALS & REVIEWS */}
        {/* ========================================================================= */}
        <TabsContent value="team-reviews" className="space-y-4">
          <Card className="border-border/40 bg-card/60">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Team Weekly Timesheets</CardTitle>
                <CardDescription className="text-xs">
                  Review and certify submitted developer timesheets for week of {formatDateDisplay(currentWeekDate)}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              {loadingTeamSheets ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Loading team submissions...
                </div>
              ) : !teamTimesheetsData?.timesheets?.length ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No timesheet submissions found for this period.
                </div>
              ) : (
                <div className="rounded border border-border/30 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/30 bg-muted/20 text-[11px]">
                        <TableHead>Contributor</TableHead>
                        <TableHead>Designation</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total Hours</TableHead>
                        <TableHead className="text-right">Billable Hours</TableHead>
                        <TableHead className="text-right">Entries</TableHead>
                        <TableHead className="w-[180px] text-center">Manager Certification</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamTimesheetsData.timesheets.map((sheet) => (
                        <TableRow key={sheet.id} className="border-border/30 text-xs">
                          <TableCell>
                            <div className="font-semibold text-foreground">{sheet.user?.name || "Member"}</div>
                            <div className="text-[10px] text-muted-foreground">{sheet.user?.email}</div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {sheet.user?.position || "Developer"}
                          </TableCell>
                          <TableCell>
                            {sheet.status === "APPROVED" ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Approved
                              </Badge>
                            ) : sheet.status === "SUBMITTED" ? (
                              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] gap-1">
                                <Send className="w-3 h-3" /> Pending Review
                              </Badge>
                            ) : sheet.status === "REJECTED" ? (
                              <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-[10px] gap-1">
                                <XCircle className="w-3 h-3" /> Rejected
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground text-[10px]">
                                Draft
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold">
                            {sheet.totalHours.toFixed(1)}h
                          </TableCell>
                          <TableCell className="text-right font-mono text-emerald-400 font-semibold">
                            {sheet.billableHours.toFixed(1)}h
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {sheet.entries.length}
                          </TableCell>
                          <TableCell className="text-center">
                            {isManager && sheet.status === "SUBMITTED" ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-2.5"
                                  onClick={() => approveSheetMutation.mutate({ timesheetId: sheet.id })}
                                  disabled={approveSheetMutation.isPending}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs border-rose-500/40 text-rose-400 hover:bg-rose-500/10 px-2.5"
                                  onClick={() => {
                                    setRejectTargetId(sheet.id)
                                    setRejectModalOpen(true)
                                  }}
                                >
                                  Reject
                                </Button>
                              </div>
                            ) : sheet.status === "APPROVED" ? (
                              <span className="text-[11px] text-muted-foreground italic">
                                Certified by {sheet.approvedBy || "Manager"}
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">Awaiting submission</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 3: CAPACITY & RESOURCE ALLOCATION (TIME-03, TIME-07) */}
        {/* ========================================================================= */}
        <TabsContent value="capacity-planning" className="space-y-4">
          <Card className="border-border/40 bg-card/60">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Weekly Resource Capacity Allocation</CardTitle>
                <CardDescription className="text-xs">
                  Developer workload distribution per project vs 40-hour standard capacity; over-allocation & bench alerts
                </CardDescription>
              </div>
              {allocationsData?.canManage && (
                <Button
                  size="sm"
                  className="h-7 text-xs bg-indigo-600 hover:bg-indigo-500 text-white gap-1"
                  onClick={() => setAllocModalOpen(true)}
                >
                  <Plus className="w-3 h-3" /> Allocate Resource
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-4 pt-1">
              {loadingAllocations ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Calculating resource capacity...
                </div>
              ) : !allocationsData?.memberCapacity?.length ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No active team members registered for allocation.
                </div>
              ) : (
                <div className="rounded border border-border/30 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/30 bg-muted/20 text-[11px]">
                        <TableHead>Resource / Contributor</TableHead>
                        <TableHead>Role & Position</TableHead>
                        <TableHead>Allocated Projects</TableHead>
                        <TableHead className="text-right">Total Allocated</TableHead>
                        <TableHead className="w-[180px]">Capacity Load</TableHead>
                        <TableHead className="w-[120px] text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allocationsData.memberCapacity.map((item) => (
                        <TableRow key={item.userId} className="border-border/30 text-xs">
                          <TableCell>
                            <div className="font-semibold text-foreground">{item.name}</div>
                            <div className="text-[10px] text-muted-foreground">{item.email}</div>
                          </TableCell>
                          <TableCell>
                            <div>{item.position || "Developer"}</div>
                            <div className="text-[10px] text-muted-foreground">{item.roleName}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1.5">
                              {item.allocations.length === 0 ? (
                                <span className="text-muted-foreground/60 italic text-[11px]">Unassigned</span>
                              ) : (
                                item.allocations.map((a) => (
                                  <Badge
                                    key={a.id}
                                    variant="outline"
                                    className="text-[10px] border-border/40 gap-1 bg-background/40"
                                  >
                                    <span
                                      className="w-1.5 h-1.5 rounded-full"
                                      style={{ backgroundColor: a.project.color }}
                                    />
                                    {a.project.name}: {a.allocatedHours}h
                                    {a.isContractor && (
                                      <span className="text-[9px] text-amber-400 font-mono">[Contractor]</span>
                                    )}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold">
                            {item.totalAllocated.toFixed(1)} / {item.standardCapacity}h
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] font-mono">
                                <span>{item.utilizationRate}%</span>
                                <span>{item.totalAllocated}h / 40h</span>
                              </div>
                              <div className="w-full bg-muted/40 h-2 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all rounded-full ${
                                    item.isOverAllocated
                                      ? "bg-rose-500"
                                      : item.isBench
                                      ? "bg-amber-400"
                                      : "bg-emerald-500"
                                  }`}
                                  style={{ width: `${Math.min(item.utilizationRate, 100)}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {item.isOverAllocated ? (
                              <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-[10px] gap-1">
                                <AlertTriangle className="w-3 h-3" /> Over-Allocated
                              </Badge>
                            ) : item.isBench ? (
                              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                                Bench / Under
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                                Optimal
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 4: UTILIZATION & ESTIMATE ACCURACY (TIME-05, TIME-06) */}
        {/* ========================================================================= */}
        <TabsContent value="utilization-analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Billable Utilization</div>
                <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                  {analyticsData?.summary.utilizationRate || 0}%
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {(analyticsData?.summary.billableHours || 0).toFixed(1)} billable / {(analyticsData?.summary.totalHours || 0).toFixed(1)} total
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Internal Non-Billable</div>
                <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
                  {(analyticsData?.summary.nonBillableHours || 0).toFixed(1)} hrs
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Overheads, meetings, internal tools
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Contractor Weekly Cost</div>
                <div className="text-2xl font-bold font-mono text-indigo-400 mt-1">
                  {formatINR(analyticsData?.summary.contractorTotalCost || 0)}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Freelancers & outsourced talent
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Logged Tasks Count</div>
                <div className="text-2xl font-bold font-mono text-foreground mt-1">
                  {analyticsData?.summary.entriesCount || 0}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Itemized timesheet records this month
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category Breakdown */}
            <Card className="border-border/40 bg-card/60">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold">Activity Category Distribution</CardTitle>
                <CardDescription className="text-xs">
                  Hours logged across development, meetings, reviews, and bugs
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-3">
                {(analyticsData?.categoryBreakdown || []).map((cat) => (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-foreground">{cat.category.replace("_", " ")}</span>
                      <span className="font-mono text-muted-foreground">
                        {cat.hours}h ({cat.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-muted/40 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${cat.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Contributor Leaderboard */}
            <Card className="border-border/40 bg-card/60">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold">Logged Hours Leaderboard</CardTitle>
                <CardDescription className="text-xs">
                  Top team contributors by total logged and billable hours
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="rounded border border-border/30 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/30 bg-muted/20 text-[11px]">
                        <TableHead>Contributor</TableHead>
                        <TableHead className="text-right">Total Hours</TableHead>
                        <TableHead className="text-right">Billable</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(analyticsData?.memberLeaderboard || []).slice(0, 5).map((m) => (
                        <TableRow key={m.name} className="border-border/30 text-xs">
                          <TableCell className="font-medium text-foreground">{m.name}</TableCell>
                          <TableCell className="text-right font-mono font-bold">{m.hours.toFixed(1)}h</TableCell>
                          <TableCell className="text-right font-mono text-emerald-400">
                            {m.billableHours.toFixed(1)}h
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Estimate Accuracy Matrix (TIME-06) */}
          <Card className="border-border/40 bg-card/60">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold">Estimate Accuracy Report (TIME-06)</CardTitle>
              <CardDescription className="text-xs">
                Comparing issue story point/hour estimates against actual time logged by the engineering team
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              {!analyticsData?.estimateAccuracyList?.length ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No issues with estimates logged yet.
                </div>
              ) : (
                <div className="rounded border border-border/30 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/30 bg-muted/20 text-[11px]">
                        <TableHead>Task / Ticket</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead className="text-right">Estimated</TableHead>
                        <TableHead className="text-right">Actual Logged</TableHead>
                        <TableHead className="text-right">Variance</TableHead>
                        <TableHead className="w-[120px] text-center">Accuracy Rating</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analyticsData.estimateAccuracyList.map((item) => (
                        <TableRow key={item.issueId} className="border-border/30 text-xs">
                          <TableCell>
                            <span className="font-mono text-muted-foreground mr-1.5">#{item.issueNumber}</span>
                            <span className="font-medium text-foreground">{item.title}</span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{item.projectName}</TableCell>
                          <TableCell className="text-right font-mono">{item.estimatedHours}h</TableCell>
                          <TableCell className="text-right font-mono font-bold text-foreground">
                            {item.actualHours}h
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono font-semibold ${
                              item.varianceHours > 0 ? "text-rose-400" : "text-emerald-400"
                            }`}
                          >
                            {item.varianceHours > 0 ? `+${item.varianceHours}h` : `${item.varianceHours}h`}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.accuracyPercent !== null ? (
                              <Badge
                                className={`text-[10px] ${
                                  item.accuracyPercent >= 80
                                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                    : item.accuracyPercent >= 50
                                    ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                    : "bg-rose-500/20 text-rose-400 border-rose-500/30"
                                }`}
                              >
                                {item.accuracyPercent}% Accuracy
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-[10px]">Pending</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ========================================================================= */}
      {/* MODAL: Log Time Entry */}
      {/* ========================================================================= */}
      <Dialog open={logModalOpen} onOpenChange={setLogModalOpen}>
        <DialogContent className="max-w-md bg-card border-border/50">
          <form onSubmit={handleLogManualEntry} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Log Work Hours</DialogTitle>
              <DialogDescription className="text-xs">
                Record time spent on project delivery, issue fixing, or team coordination.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Date</Label>
                  <Input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    required
                    className="h-8 text-xs bg-background/50 border-border/40"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hours</Label>
                  <Input
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="24"
                    value={entryHours}
                    onChange={(e) => setEntryHours(e.target.value)}
                    required
                    className="h-8 text-xs bg-background/50 border-border/40"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Project</Label>
                <Select value={entryProject} onValueChange={setEntryProject}>
                  <SelectTrigger className="h-8 text-xs bg-background/50 border-border/40">
                    <SelectValue placeholder="Select target project..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Linked Issue / Ticket (Optional)</Label>
                <Select value={entryIssue} onValueChange={setEntryIssue}>
                  <SelectTrigger className="h-8 text-xs bg-background/50 border-border/40">
                    <SelectValue placeholder="Link task ticket..." />
                  </SelectTrigger>
                  <SelectContent>
                    {issues.slice(0, 30).map((iss) => (
                      <SelectItem key={iss.id} value={iss.id}>
                        #{iss.number} - {iss.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Category</Label>
                  <Select value={entryCategory} onValueChange={setEntryCategory}>
                    <SelectTrigger className="h-8 text-xs bg-background/50 border-border/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Billing Type</Label>
                  <div className="flex items-center h-8 gap-2">
                    <input
                      type="checkbox"
                      id="billableCheck"
                      checked={entryBillable}
                      onChange={(e) => setEntryBillable(e.target.checked)}
                      className="rounded border-border/40"
                    />
                    <label htmlFor="billableCheck" className="text-xs text-foreground cursor-pointer">
                      Billable to Client
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Work Description</Label>
                <Textarea
                  value={entryDesc}
                  onChange={(e) => setEntryDesc(e.target.value)}
                  placeholder="Summarize the core accomplishment or investigation..."
                  required
                  rows={3}
                  className="text-xs bg-background/50 border-border/40"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setLogModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={logEntryMutation.isPending}
                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                Save Entry
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: Reject Timesheet with Feedback */}
      {/* ========================================================================= */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="max-w-md bg-card border-border/50">
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-rose-400">Reject Timesheet</DialogTitle>
              <DialogDescription className="text-xs">
                Provide actionable feedback so the developer can correct their entries.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5 text-xs">
              <Label className="text-xs">Reason for Rejection</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g., Please log client meeting hours under project Alpha and re-verify hours..."
                rows={3}
                className="text-xs bg-background/50 border-border/40"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setRejectModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={rejectSheetMutation.isPending || !rejectReason.trim()}
                className="h-8 text-xs bg-rose-600 hover:bg-rose-500 text-white"
                onClick={async () => {
                  await rejectSheetMutation.mutateAsync({
                    timesheetId: rejectTargetId,
                    rejectionReason: rejectReason.trim(),
                  })
                  setRejectModalOpen(false)
                  setRejectReason("")
                }}
              >
                Confirm Rejection
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: Allocate Resource Capacity */}
      {/* ========================================================================= */}
      <Dialog open={allocModalOpen} onOpenChange={setAllocModalOpen}>
        <DialogContent className="max-w-md bg-card border-border/50">
          <form onSubmit={handleUpsertAlloc} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Allocate Resource Capacity</DialogTitle>
              <DialogDescription className="text-xs">
                Plan weekly hours for an engineer or contractor on a specific project.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <Label className="text-xs">Team Contributor</Label>
                <Select value={allocUser} onValueChange={setAllocUser}>
                  <SelectTrigger className="h-8 text-xs bg-background/50 border-border/40">
                    <SelectValue placeholder="Select team member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allocationsData?.memberCapacity.map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.name} ({m.position || "Developer"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Project</Label>
                <Select value={allocProject} onValueChange={setAllocProject}>
                  <SelectTrigger className="h-8 text-xs bg-background/50 border-border/40">
                    <SelectValue placeholder="Select project..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Allocated Hours / Week</Label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    max="60"
                    value={allocHours}
                    onChange={(e) => setAllocHours(e.target.value)}
                    required
                    className="h-8 text-xs bg-background/50 border-border/40"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Role on Project</Label>
                  <Input
                    value={allocRole}
                    onChange={(e) => setAllocRole(e.target.value)}
                    placeholder="e.g., Tech Lead"
                    className="h-8 text-xs bg-background/50 border-border/40"
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg border border-border/30 bg-muted/20 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="contractorCheck"
                    checked={allocIsContractor}
                    onChange={(e) => setAllocIsContractor(e.target.checked)}
                    className="rounded border-border/40"
                  />
                  <label htmlFor="contractorCheck" className="text-xs font-semibold text-foreground cursor-pointer">
                    External Contractor / Freelancer (TIME-07)
                  </label>
                </div>
                {allocIsContractor && (
                  <div className="space-y-1 pt-1">
                    <Label className="text-xs">Hourly Contractor Rate (INR ₹)</Label>
                    <Input
                      type="number"
                      step="50"
                      min="0"
                      value={allocContractorRate}
                      onChange={(e) => setAllocContractorRate(e.target.value)}
                      className="h-8 text-xs bg-background/50 border-border/40 font-mono"
                    />
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setAllocModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={upsertAllocationMutation.isPending}
                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                Save Allocation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
