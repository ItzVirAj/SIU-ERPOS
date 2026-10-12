"use client"

import React, { useState, useMemo } from "react"
import { useActiveTeam } from "@/lib/context/team-context"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { adminClient } from "@/lib/api/admin-client"
import { AddEmployeeDialog } from "@/components/access-management/add-employee-dialog"
import {
  useLeaves,
  useSubmitLeave,
  useReviewLeave,
  useCancelLeave,
  useAttendance,
  useCheckIn,
  useCheckOut,
  useOnboardingChecklists,
  useCreateChecklist,
  useToggleChecklistItem,
  useAtsPipeline,
  useCreateJobOpening,
  useAddCandidate,
  useUpdateCandidateStage,
  LeaveRequestItem,
  CandidateRecord,
} from "@/lib/hooks/use-hr"
import {
  Users,
  UserPlus,
  Calendar,
  CalendarCheck2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  Briefcase,
  Search,
  Plus,
  Send,
  Laptop,
  CheckSquare,
  Shield,
  FileText,
  Star,
  ExternalLink,
  ChevronRight,
  UserCheck,
  TrendingUp,
  MapPin,
  Mail,
  Phone,
  Trash2,
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

const ATS_STAGES = [
  { key: "SOURCED", label: "Sourced", color: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  { key: "SCREENING", label: "Screening", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { key: "TECHNICAL", label: "Technical Round", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  { key: "FINAL", label: "Culture & Final", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { key: "OFFER", label: "Offer Extended", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  { key: "HIRED", label: "Hired", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
]

export function HrConsole() {
  const { teamId } = useActiveTeam()
  const queryClient = useQueryClient()

  // 1. Roles & Employees Query
  const { data: rolesData } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: () => adminClient.listRoles(),
  })
  const { data: employeesData, isLoading: loadingEmployees } = useQuery({
    queryKey: ["admin-employees"],
    queryFn: () => adminClient.listEmployees({ pageSize: 50 }),
  })

  // 2. HR Queries
  const { data: leavesData, isLoading: loadingLeaves } = useLeaves(teamId)
  const { data: attendanceData, isLoading: loadingAttendance } = useAttendance(teamId)
  const { data: onboardingData, isLoading: loadingOnboarding } = useOnboardingChecklists(teamId)
  const { data: atsData, isLoading: loadingAts } = useAtsPipeline(teamId)

  const assignableRoles = useMemo(() => {
    return (rolesData?.roles || []).filter((r) => r.assignable)
  }, [rolesData?.roles])

  // 3. HR Mutations
  const submitLeaveMutation = useSubmitLeave(teamId)
  const reviewLeaveMutation = useReviewLeave(teamId)
  const cancelLeaveMutation = useCancelLeave(teamId)
  const checkInMutation = useCheckIn(teamId)
  const checkOutMutation = useCheckOut(teamId)
  const createChecklistMutation = useCreateChecklist(teamId)
  const toggleItemMutation = useToggleChecklistItem(teamId)
  const createOpeningMutation = useCreateJobOpening(teamId)
  const addCandidateMutation = useAddCandidate(teamId)
  const updateCandidateMutation = useUpdateCandidateStage(teamId)

  // Modals state
  const [addEmpModalOpen, setAddEmpModalOpen] = useState(false)
  const [applyLeaveModalOpen, setApplyLeaveModalOpen] = useState(false)
  const [leaveType, setLeaveType] = useState("CASUAL")
  const [leaveStart, setLeaveStart] = useState(() => new Date().toISOString().split("T")[0])
  const [leaveEnd, setLeaveEnd] = useState(() => new Date().toISOString().split("T")[0])
  const [leaveDays, setLeaveDays] = useState("1")
  const [leaveReason, setLeaveReason] = useState("")
  const [leaveEmergency, setLeaveEmergency] = useState("")

  // Attendance checkin notes
  const [attWorkMode, setAttWorkMode] = useState("WFH")
  const [attNotes, setAttNotes] = useState("")

  // Onboarding modal
  const [initChecklistModalOpen, setInitChecklistModalOpen] = useState(false)
  const [selectedEmpForChecklist, setSelectedEmpForChecklist] = useState("")
  const [checklistType, setChecklistType] = useState<"ONBOARDING" | "OFFBOARDING">("ONBOARDING")

  // ATS modals
  const [openingModalOpen, setOpeningModalOpen] = useState(false)
  const [opTitle, setOpTitle] = useState("")
  const [opDept, setOpDept] = useState("Engineering")
  const [opLoc, setOpLoc] = useState("Remote (India)")
  const [opDesc, setOpDesc] = useState("")

  const [candModalOpen, setCandModalOpen] = useState(false)
  const [candName, setCandName] = useState("")
  const [candEmail, setCandEmail] = useState("")
  const [candPhone, setCandPhone] = useState("")
  const [candOpening, setCandOpening] = useState("")
  const [candExp, setCandExp] = useState("3")
  const [candCtc, setCandCtc] = useState("1500000")
  const [candResume, setCandResume] = useState("")
  const [candNotes, setCandNotes] = useState("")

  // Directory search filter
  const [empSearch, setEmpSearch] = useState("")
  const [deptFilter, setDeptFilter] = useState("ALL")

  const filteredEmployees = useMemo(() => {
    return (employeesData?.employees || []).filter((e) => {
      const matchSearch =
        e.fullName.toLowerCase().includes(empSearch.toLowerCase()) ||
        e.email.toLowerCase().includes(empSearch.toLowerCase()) ||
        (e.employeeCode && e.employeeCode.toLowerCase().includes(empSearch.toLowerCase()))
      const matchDept = deptFilter === "ALL" || e.department === deptFilter
      return matchSearch && matchDept
    })
  }, [employeesData?.employees, empSearch, deptFilter])

  const departmentsList = useMemo(() => {
    const set = new Set<string>()
    ;(employeesData?.employees || []).forEach((e) => {
      if (e.department) set.add(e.department)
    })
    return Array.from(set)
  }, [employeesData?.employees])

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!leaveReason.trim()) {
      toast.error("Please enter a reason for the leave")
      return
    }
    try {
      await submitLeaveMutation.mutateAsync({
        leaveType,
        startDate: leaveStart,
        endDate: leaveEnd,
        totalDays: Number(leaveDays),
        reason: leaveReason.trim(),
        emergencyContact: leaveEmergency.trim() || undefined,
      })
      setApplyLeaveModalOpen(false)
      setLeaveReason("")
    } catch {
      // toast in mutation
    }
  }

  const handleCreateOpening = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!opTitle.trim() || !opDept.trim()) return
    try {
      await createOpeningMutation.mutateAsync({
        title: opTitle.trim(),
        department: opDept.trim(),
        location: opLoc.trim(),
        description: opDesc.trim() || undefined,
      })
      setOpeningModalOpen(false)
      setOpTitle("")
      setOpDesc("")
    } catch {
      // Error
    }
  }

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!candName.trim() || !candEmail.trim()) return
    try {
      await addCandidateMutation.mutateAsync({
        fullName: candName.trim(),
        email: candEmail.trim(),
        phone: candPhone.trim() || undefined,
        jobOpeningId: candOpening || undefined,
        experienceYears: Number(candExp),
        expectedCtc: Number(candCtc),
        resumeUrl: candResume.trim() || undefined,
        notes: candNotes.trim() || undefined,
      })
      setCandModalOpen(false)
      setCandName("")
      setCandEmail("")
      setCandPhone("")
    } catch {
      // Error
    }
  }

  const isCheckedIn = Boolean(attendanceData?.todayAttendance)
  const isCheckedOut = Boolean(attendanceData?.todayAttendance?.checkOutTime)

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl border border-border/40 bg-card/40 backdrop-blur">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                People Operations (HR Lite)
                <Badge variant="outline" className="text-[10px] font-mono border-teal-500/30 text-teal-400">
                  HR-01 - HR-05
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Staff directory, leave balances, remote attendance check-in, onboarding checklists & hiring pipeline
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="h-8 text-xs bg-teal-600 hover:bg-teal-500 text-white flex items-center gap-1.5"
            onClick={() => setAddEmpModalOpen(true)}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add Employee / Member
          </Button>
        </div>
      </div>

      {/* Overview Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/40 bg-card/60">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Active Staff Members</div>
            <div className="text-2xl font-bold font-mono text-foreground mt-1">
              {employeesData?.total || 0}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Across {departmentsList.length || 1} departments
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/60">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Present Today</div>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
              {attendanceData?.teamRegister?.length || 0}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Remote & in-office check-ins
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/60">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">On Approved Leave</div>
            <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
              {leavesData?.activeLeaves?.length || 0}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Team calendar absence
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/60">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Open Job Postings</div>
            <div className="text-2xl font-bold font-mono text-indigo-400 mt-1">
              {atsData?.openings?.length || 0}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {atsData?.candidates?.length || 0} candidates in pipeline
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Submodules Tabs */}
      <Tabs defaultValue="directory" className="space-y-4">
        <TabsList className="bg-muted/30 border border-border/40 p-1 flex-wrap h-auto">
          <TabsTrigger value="directory" className="text-xs data-[state=active]:bg-card flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            1. Staff Directory & Provisioning
          </TabsTrigger>
          <TabsTrigger value="leaves" className="text-xs data-[state=active]:bg-card flex items-center gap-1.5">
            <CalendarCheck2 className="w-3.5 h-3.5" />
            2. Leave Balances & Approvals
            {leavesData?.teamLeaves?.some((l) => l.status === "PENDING") && (
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block animate-pulse" />
            )}
          </TabsTrigger>
          <TabsTrigger value="attendance" className="text-xs data-[state=active]:bg-card flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            3. Daily Attendance & Check-In
          </TabsTrigger>
          <TabsTrigger value="onboarding" className="text-xs data-[state=active]:bg-card flex items-center gap-1.5">
            <CheckSquare className="w-3.5 h-3.5" />
            4. Onboarding & Checklists
          </TabsTrigger>
          <TabsTrigger value="ats" className="text-xs data-[state=active]:bg-card flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            5. Hiring Pipeline (ATS Lite)
          </TabsTrigger>
        </TabsList>

        {/* ========================================================================= */}
        {/* SUBMODULE 1: STAFF DIRECTORY & PROVISIONING */}
        {/* ========================================================================= */}
        <TabsContent value="directory" className="space-y-4">
          <Card className="border-border/40 bg-card/60">
            <CardHeader className="p-4 pb-2 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold">Employee Roster & Directory (HR-01)</CardTitle>
                <CardDescription className="text-xs">
                  Active team members, departmental positions, employee codes, and lifecycle statuses
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-48">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Search employee..."
                    value={empSearch}
                    onChange={(e) => setEmpSearch(e.target.value)}
                    className="h-8 pl-8 text-xs bg-background/50 border-border/40"
                  />
                </div>

                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger className="h-8 text-xs w-36 bg-background/50 border-border/40">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Departments</SelectItem>
                    {departmentsList.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  size="sm"
                  className="h-8 text-xs bg-teal-600 hover:bg-teal-500 text-white gap-1"
                  onClick={() => setAddEmpModalOpen(true)}
                >
                  <UserPlus className="w-3 h-3" /> Add Employee
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              {loadingEmployees ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Loading employee directory...
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No employee records matching filters.
                </div>
              ) : (
                <div className="rounded border border-border/30 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/30 bg-muted/20 text-[11px]">
                        <TableHead>Employee Name & Email</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Position & Department</TableHead>
                        <TableHead>Role Tier</TableHead>
                        <TableHead>Joining Date</TableHead>
                        <TableHead className="w-[100px] text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmployees.map((emp) => (
                        <TableRow key={emp.id} className="border-border/30 text-xs">
                          <TableCell>
                            <div className="font-semibold text-foreground">{emp.fullName}</div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Mail className="w-2.5 h-2.5" /> {emp.email}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            {emp.employeeCode || "—"}
                          </TableCell>
                          <TableCell>
                            <div className="text-foreground">{emp.position || "Staff"}</div>
                            <div className="text-[10px] text-muted-foreground">{emp.department || "General"}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] border-border/40 font-mono">
                              {emp.role.name}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground font-mono text-[11px]">
                            {emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            {emp.status === "ACTIVE" ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                                Active
                              </Badge>
                            ) : emp.status === "SUSPENDED" ? (
                              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                                Suspended
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-[10px]">
                                Terminated
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
        {/* SUBMODULE 2: LEAVE BALANCES & APPROVALS (HR-02) */}
        {/* ========================================================================= */}
        <TabsContent value="leaves" className="space-y-4">
          {/* Leave Balances Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Casual Leave (CL)</div>
                <div className="text-xl font-bold font-mono text-foreground mt-1">
                  {(leavesData?.leaveBalance.casualTotal || 12) - (leavesData?.leaveBalance.casualUsed || 0)} days left
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Used: {leavesData?.leaveBalance.casualUsed || 0} / {leavesData?.leaveBalance.casualTotal || 12}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Sick Leave (SL)</div>
                <div className="text-xl font-bold font-mono text-teal-400 mt-1">
                  {(leavesData?.leaveBalance.sickTotal || 10) - (leavesData?.leaveBalance.sickUsed || 0)} days left
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Used: {leavesData?.leaveBalance.sickUsed || 0} / {leavesData?.leaveBalance.sickTotal || 10}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Paid / Earned Leave (PL)</div>
                <div className="text-xl font-bold font-mono text-indigo-400 mt-1">
                  {(leavesData?.leaveBalance.paidTotal || 15) - (leavesData?.leaveBalance.paidUsed || 0)} days left
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Used: {leavesData?.leaveBalance.paidUsed || 0} / {leavesData?.leaveBalance.paidTotal || 15}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-card/60 flex items-center p-4">
              <div className="w-full">
                <Button
                  size="sm"
                  className="w-full h-8 text-xs bg-teal-600 hover:bg-teal-500 text-white gap-1.5"
                  onClick={() => setApplyLeaveModalOpen(true)}
                >
                  <CalendarCheck2 className="w-3.5 h-3.5" />
                  Request Leave
                </Button>
                <div className="text-[10px] text-muted-foreground text-center mt-1.5">
                  Unpaid leaves logged: {leavesData?.leaveBalance.unpaidUsed || 0} days
                </div>
              </div>
            </Card>
          </div>

          {/* Pending Approvals (Manager View) */}
          {leavesData?.isManager && leavesData?.teamLeaves?.length > 0 && (
            <Card className="border-border/40 bg-card/60">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  Manager Approvals Queue
                  {leavesData.teamLeaves.filter((l) => l.status === "PENDING").length > 0 && (
                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                      {leavesData.teamLeaves.filter((l) => l.status === "PENDING").length} Action Required
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  Review submitted employee time-off requests with automatic balance deductions
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="rounded border border-border/30 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/30 bg-muted/20 text-[11px]">
                        <TableHead>Employee</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Dates</TableHead>
                        <TableHead className="text-right">Days</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="w-[160px] text-center">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leavesData.teamLeaves.slice(0, 10).map((l) => (
                        <TableRow key={l.id} className="border-border/30 text-xs">
                          <TableCell>
                            <div className="font-semibold text-foreground">{l.employee?.fullName || "Staff"}</div>
                            <div className="text-[10px] text-muted-foreground">{l.employee?.position || "Developer"}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {l.leaveType}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-[11px] text-muted-foreground">
                            {new Date(l.startDate).toLocaleDateString()} – {new Date(l.endDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold">{l.totalDays}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{l.reason}</TableCell>
                          <TableCell className="text-center">
                            {l.status === "PENDING" ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  size="sm"
                                  className="h-6 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white px-2"
                                  onClick={() => reviewLeaveMutation.mutate({ leaveId: l.id, action: "APPROVE" })}
                                  disabled={reviewLeaveMutation.isPending}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[11px] border-rose-500/40 text-rose-400 hover:bg-rose-500/10 px-2"
                                  onClick={() => reviewLeaveMutation.mutate({ leaveId: l.id, action: "REJECT" })}
                                  disabled={reviewLeaveMutation.isPending}
                                >
                                  Decline
                                </Button>
                              </div>
                            ) : l.status === "APPROVED" ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                                Approved
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-[10px]">
                                Rejected
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* My Leave Applications Table */}
          <Card className="border-border/40 bg-card/60">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold">My Leave History</CardTitle>
              <CardDescription className="text-xs">
                Your past and upcoming leave requests and approval status
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              {!leavesData?.myLeaves?.length ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  You have not submitted any leave requests yet.
                </div>
              ) : (
                <div className="rounded border border-border/30 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/30 bg-muted/20 text-[11px]">
                        <TableHead>Type</TableHead>
                        <TableHead>Date Range</TableHead>
                        <TableHead className="text-right">Total Days</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="w-[120px] text-center">Status</TableHead>
                        <TableHead className="w-[60px] text-center">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leavesData.myLeaves.map((l) => (
                        <TableRow key={l.id} className="border-border/30 text-xs">
                          <TableCell className="font-semibold">{l.leaveType}</TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            {new Date(l.startDate).toLocaleDateString()} – {new Date(l.endDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold">{l.totalDays}</TableCell>
                          <TableCell className="max-w-xs truncate">{l.reason}</TableCell>
                          <TableCell className="text-center">
                            {l.status === "APPROVED" ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                                Approved
                              </Badge>
                            ) : l.status === "PENDING" ? (
                              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                                Pending
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-[10px]">
                                Rejected
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {l.status === "PENDING" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-rose-400"
                                onClick={() => cancelLeaveMutation.mutate(l.id)}
                                title="Cancel leave"
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
        {/* SUBMODULE 3: DAILY ATTENDANCE & REMOTE CHECK-IN (HR-03) */}
        {/* ========================================================================= */}
        <TabsContent value="attendance" className="space-y-4">
          <Card className="border-border/40 bg-gradient-to-r from-card/80 to-muted/20">
            <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <div
                  className={`p-3 rounded-xl border ${
                    isCheckedIn && !isCheckedOut
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-muted/40 border-border/40 text-muted-foreground"
                  }`}
                >
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Today&apos;s Remote Check-In (HR-03)
                  </div>
                  <div className="text-lg font-bold text-foreground mt-0.5">
                    {isCheckedOut ? (
                      <span className="text-muted-foreground">
                        Checked Out ({attendanceData?.todayAttendance?.totalHours || 0} hrs logged)
                      </span>
                    ) : isCheckedIn ? (
                      <span className="text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> Present (Checked in at{" "}
                        {new Date(attendanceData!.todayAttendance!.checkInTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        )
                      </span>
                    ) : (
                      "Not Checked In Today"
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {!isCheckedIn ? (
                  <>
                    <Select value={attWorkMode} onValueChange={setAttWorkMode}>
                      <SelectTrigger className="h-8 text-xs w-36 bg-background/50 border-border/40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WFH">Work From Home</SelectItem>
                        <SelectItem value="OFFICE">In-Office</SelectItem>
                        <SelectItem value="CLIENT_SITE">Client Site</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
                      onClick={() => checkInMutation.mutate({ workMode: attWorkMode, notes: attNotes })}
                      disabled={checkInMutation.isPending}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Check In Now
                    </Button>
                  </>
                ) : !isCheckedOut ? (
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-rose-600 hover:bg-rose-500 text-white gap-1.5"
                    onClick={() => checkOutMutation.mutate(undefined)}
                    disabled={checkOutMutation.isPending}
                  >
                    Check Out & Wrap Day
                  </Button>
                ) : (
                  <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-xs py-1">
                    Day Completed
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Daily Team Attendance Register */}
          <Card className="border-border/40 bg-card/60">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold">Today&apos;s Team Attendance Register</CardTitle>
              <CardDescription className="text-xs">
                Real-time check-in log and work mode status across engineering & operations
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              {!attendanceData?.teamRegister?.length ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No attendance records logged for today yet.
                </div>
              ) : (
                <div className="rounded border border-border/30 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/30 bg-muted/20 text-[11px]">
                        <TableHead>Staff Member</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Work Mode</TableHead>
                        <TableHead>Check-In Time</TableHead>
                        <TableHead>Check-Out Time</TableHead>
                        <TableHead className="text-right">Total Hours</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceData.teamRegister.map((rec) => (
                        <TableRow key={rec.id} className="border-border/30 text-xs">
                          <TableCell className="font-medium text-foreground">
                            {rec.employee?.fullName || "Staff"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {rec.employee?.department || "General"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] border-border/40 font-mono">
                              {rec.workMode === "WFH" ? "🏠 Work From Home" : rec.workMode === "OFFICE" ? "🏢 In Office" : "🚗 Client Site"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            {new Date(rec.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            {rec.checkOutTime ? new Date(rec.checkOutTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Active"}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold">
                            {rec.totalHours ? `${rec.totalHours}h` : "—"}
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
        {/* SUBMODULE 4: ONBOARDING & CHECKLISTS (HR-04) */}
        {/* ========================================================================= */}
        <TabsContent value="onboarding" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Employee Onboarding & Offboarding (HR-04)</h2>
              <p className="text-xs text-muted-foreground">
                Automated checklist templates for developer accounts, equipment provisioning, and security handovers
              </p>
            </div>
            {onboardingData?.isManager && (
              <Button
                size="sm"
                className="h-8 text-xs bg-teal-600 hover:bg-teal-500 text-white gap-1"
                onClick={() => setInitChecklistModalOpen(true)}
              >
                <Plus className="w-3 h-3" /> Initialize Checklist
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!onboardingData?.checklists?.length ? (
              <div className="col-span-2 py-12 text-center text-xs text-muted-foreground">
                No active onboarding or offboarding checklists found.
              </div>
            ) : (
              onboardingData.checklists.map((cl) => {
                const totalItems = cl.items.length
                const completedItems = cl.items.filter((it) => it.isCompleted).length
                const percent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

                return (
                  <Card key={cl.id} className="border-border/40 bg-card/60 space-y-3">
                    <CardHeader className="p-4 pb-0">
                      <div className="flex items-center justify-between">
                        <Badge
                          className={`text-[10px] ${
                            cl.type === "ONBOARDING"
                              ? "bg-teal-500/20 text-teal-400 border-teal-500/30"
                              : "bg-rose-500/20 text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {cl.type}
                        </Badge>
                        <span className="text-xs font-mono font-bold text-foreground">{percent}% Completed</span>
                      </div>
                      <CardTitle className="text-sm font-semibold mt-1">{cl.title}</CardTitle>
                      <CardDescription className="text-xs">
                        Assignee: {cl.employee?.fullName} ({cl.employee?.position || "Developer"})
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-1 space-y-2.5">
                      <div className="w-full bg-muted/40 h-1.5 rounded-full overflow-hidden">
                        <div className="h-full bg-teal-500 rounded-full" style={{ width: `${percent}%` }} />
                      </div>

                      <div className="space-y-1.5 pt-2">
                        {cl.items.map((it) => (
                          <div
                            key={it.id}
                            className="flex items-center justify-between p-2 rounded bg-muted/20 border border-border/20 text-xs"
                          >
                            <label className="flex items-center gap-2 cursor-pointer flex-1">
                              <input
                                type="checkbox"
                                checked={it.isCompleted}
                                onChange={(e) =>
                                  toggleItemMutation.mutate({
                                    checklistId: cl.id,
                                    itemId: it.id,
                                    isCompleted: e.target.checked,
                                  })
                                }
                                className="rounded border-border/40"
                              />
                              <span className={it.isCompleted ? "line-through text-muted-foreground" : "text-foreground"}>
                                {it.title}
                              </span>
                            </label>
                            <Badge variant="outline" className="text-[9px] border-border/30 font-mono">
                              {it.category}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </TabsContent>

        {/* ========================================================================= */}
        {/* SUBMODULE 5: HIRING PIPELINE & ATS LITE (HR-05) */}
        {/* ========================================================================= */}
        <TabsContent value="ats" className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Hiring Pipeline & Candidate Tracking (HR-05)</h2>
              <p className="text-xs text-muted-foreground">
                Manage open engineering positions, recruitment Kanban stages, resume evaluations, and candidate scorecards
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-border/40 gap-1"
                onClick={() => setOpeningModalOpen(true)}
              >
                <Briefcase className="w-3.5 h-3.5" /> + New Job Opening
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white gap-1"
                onClick={() => setCandModalOpen(true)}
              >
                <Plus className="w-3.5 h-3.5" /> Add Candidate
              </Button>
            </div>
          </div>

          {/* Job Openings Strip */}
          {atsData?.openings && atsData.openings.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {atsData.openings.map((op) => (
                <div key={op.id} className="p-3.5 rounded-lg border border-border/30 bg-card/40 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm text-foreground">{op.title}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>{op.department}</span> • <span>{op.location}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[11px] font-mono border-indigo-500/30 text-indigo-400">
                    {op._count?.candidates || 0} Applicants
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* Kanban Board */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 overflow-x-auto pb-4">
            {ATS_STAGES.map((col) => {
              const stageCandidates = (atsData?.candidates || []).filter((c) => c.stage === col.key)
              return (
                <div key={col.key} className="p-3 rounded-lg border border-border/30 bg-card/30 min-w-[200px] flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">{col.label}</span>
                    <Badge className={`text-[10px] ${col.color}`}>{stageCandidates.length}</Badge>
                  </div>

                  <div className="space-y-2 flex-1">
                    {stageCandidates.map((cand) => (
                      <Card key={cand.id} className="border-border/40 bg-card/80 p-3 space-y-2 shadow-sm">
                        <div>
                          <div className="font-semibold text-xs text-foreground">{cand.fullName}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{cand.jobOpening?.title || "General"}</div>
                        </div>

                        <div className="text-[10px] text-muted-foreground font-mono space-y-0.5">
                          {cand.experienceYears && <div>Exp: {cand.experienceYears} yrs</div>}
                          {cand.expectedCtc && <div>Exp CTC: ₹{(cand.expectedCtc / 100000).toFixed(1)}L</div>}
                        </div>

                        {cand.resumeUrl && (
                          <a
                            href={cand.resumeUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1"
                          >
                            <FileText className="w-2.5 h-2.5" /> Resume Link
                          </a>
                        )}

                        {/* Move stage control */}
                        <div className="pt-1 flex justify-between items-center">
                          <Select
                            value={cand.stage}
                            onValueChange={(val) => updateCandidateMutation.mutate({ candidateId: cand.id, stage: val })}
                          >
                            <SelectTrigger className="h-6 text-[10px] bg-background/50 border-border/40 w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ATS_STAGES.map((st) => (
                                <SelectItem key={st.key} value={st.key} className="text-xs">
                                  {st.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* ========================================================================= */}
      {/* MODAL: Apply for Leave */}
      {/* ========================================================================= */}
      <Dialog open={applyLeaveModalOpen} onOpenChange={setApplyLeaveModalOpen}>
        <DialogContent className="max-w-md bg-card border-border/50">
          <form onSubmit={handleApplyLeave} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Request Leave (HR-02)</DialogTitle>
              <DialogDescription className="text-xs">
                Submit planned time-off for managerial certification and balance deduction.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <Label className="text-xs">Leave Type</Label>
                <Select value={leaveType} onValueChange={setLeaveType}>
                  <SelectTrigger className="h-8 text-xs bg-background/50 border-border/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASUAL">Casual Leave (CL)</SelectItem>
                    <SelectItem value="SICK">Sick Leave (SL)</SelectItem>
                    <SelectItem value="PAID">Paid / Annual Leave (PL)</SelectItem>
                    <SelectItem value="UNPAID">Unpaid Leave (LWP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Start Date</Label>
                  <Input
                    type="date"
                    value={leaveStart}
                    onChange={(e) => setLeaveStart(e.target.value)}
                    required
                    className="h-8 text-xs bg-background/50 border-border/40"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">End Date</Label>
                  <Input
                    type="date"
                    value={leaveEnd}
                    onChange={(e) => setLeaveEnd(e.target.value)}
                    required
                    className="h-8 text-xs bg-background/50 border-border/40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Total Days</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={leaveDays}
                    onChange={(e) => setLeaveDays(e.target.value)}
                    required
                    className="h-8 text-xs bg-background/50 border-border/40 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Emergency Phone</Label>
                  <Input
                    value={leaveEmergency}
                    onChange={(e) => setLeaveEmergency(e.target.value)}
                    placeholder="+91..."
                    className="h-8 text-xs bg-background/50 border-border/40"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Reason for Absence</Label>
                <Textarea
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="State the reason for time-off..."
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
                onClick={() => setApplyLeaveModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitLeaveMutation.isPending}
                className="h-8 text-xs bg-teal-600 hover:bg-teal-500 text-white"
              >
                Submit Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: Initialize Checklist */}
      {/* ========================================================================= */}
      <Dialog open={initChecklistModalOpen} onOpenChange={setInitChecklistModalOpen}>
        <DialogContent className="max-w-md bg-card border-border/50">
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Initialize Checklist (HR-04)</DialogTitle>
              <DialogDescription className="text-xs">
                Generate automated onboarding or offboarding task list for an employee.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <Label className="text-xs">Target Employee</Label>
                <Select value={selectedEmpForChecklist} onValueChange={setSelectedEmpForChecklist}>
                  <SelectTrigger className="h-8 text-xs bg-background/50 border-border/40">
                    <SelectValue placeholder="Select team member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(employeesData?.employees || []).map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.fullName} ({e.position || "Developer"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Checklist Type</Label>
                <Select value={checklistType} onValueChange={(val: any) => setChecklistType(val)}>
                  <SelectTrigger className="h-8 text-xs bg-background/50 border-border/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ONBOARDING">New Developer Onboarding</SelectItem>
                    <SelectItem value="OFFBOARDING">Employee Offboarding & Asset Retrieval</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setInitChecklistModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={createChecklistMutation.isPending || !selectedEmpForChecklist}
                className="h-8 text-xs bg-teal-600 hover:bg-teal-500 text-white"
                onClick={async () => {
                  await createChecklistMutation.mutateAsync({
                    employeeId: selectedEmpForChecklist,
                    type: checklistType,
                  })
                  setInitChecklistModalOpen(false)
                }}
              >
                Create Checklist
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: New Job Opening */}
      {/* ========================================================================= */}
      <Dialog open={openingModalOpen} onOpenChange={setOpeningModalOpen}>
        <DialogContent className="max-w-md bg-card border-border/50">
          <form onSubmit={handleCreateOpening} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Publish Job Opening</DialogTitle>
              <DialogDescription className="text-xs">
                Add an open position to the internal recruitment pipeline.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <Label className="text-xs">Job Title</Label>
                <Input
                  value={opTitle}
                  onChange={(e) => setOpTitle(e.target.value)}
                  placeholder="e.g. Senior Full-Stack Engineer"
                  required
                  className="h-8 text-xs bg-background/50 border-border/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Department</Label>
                  <Input
                    value={opDept}
                    onChange={(e) => setOpDept(e.target.value)}
                    placeholder="Engineering"
                    required
                    className="h-8 text-xs bg-background/50 border-border/40"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Location</Label>
                  <Input
                    value={opLoc}
                    onChange={(e) => setOpLoc(e.target.value)}
                    placeholder="Remote (India)"
                    className="h-8 text-xs bg-background/50 border-border/40"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Job Description / Requirements</Label>
                <Textarea
                  value={opDesc}
                  onChange={(e) => setOpDesc(e.target.value)}
                  placeholder="Responsibilities, tech stack, and experience..."
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
                onClick={() => setOpeningModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createOpeningMutation.isPending}
                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                Publish Opening
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: Add Candidate */}
      {/* ========================================================================= */}
      <Dialog open={candModalOpen} onOpenChange={setCandModalOpen}>
        <DialogContent className="max-w-md bg-card border-border/50">
          <form onSubmit={handleAddCandidate} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Add Candidate to Pipeline</DialogTitle>
              <DialogDescription className="text-xs">
                Log candidate details for screening and technical interviews.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <Label className="text-xs">Full Name</Label>
                <Input
                  value={candName}
                  onChange={(e) => setCandName(e.target.value)}
                  placeholder="Candidate name..."
                  required
                  className="h-8 text-xs bg-background/50 border-border/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input
                    type="email"
                    value={candEmail}
                    onChange={(e) => setCandEmail(e.target.value)}
                    required
                    className="h-8 text-xs bg-background/50 border-border/40"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <Input
                    value={candPhone}
                    onChange={(e) => setCandPhone(e.target.value)}
                    placeholder="+91..."
                    className="h-8 text-xs bg-background/50 border-border/40"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Target Job Opening</Label>
                <Select value={candOpening} onValueChange={setCandOpening}>
                  <SelectTrigger className="h-8 text-xs bg-background/50 border-border/40">
                    <SelectValue placeholder="Select opening..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(atsData?.openings || []).map((op) => (
                      <SelectItem key={op.id} value={op.id}>
                        {op.title} ({op.department})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Experience (Years)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={candExp}
                    onChange={(e) => setCandExp(e.target.value)}
                    className="h-8 text-xs bg-background/50 border-border/40"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Expected CTC (INR ₹)</Label>
                  <Input
                    type="number"
                    step="50000"
                    value={candCtc}
                    onChange={(e) => setCandCtc(e.target.value)}
                    className="h-8 text-xs bg-background/50 border-border/40 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Resume Link / Portfolio</Label>
                <Input
                  value={candResume}
                  onChange={(e) => setCandResume(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="h-8 text-xs bg-background/50 border-border/40"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setCandModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={addCandidateMutation.isPending}
                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                Add Candidate
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Embedded Add Employee Dialog from Access Management */}
      <AddEmployeeDialog
        open={addEmpModalOpen}
        onOpenChange={setAddEmpModalOpen}
        assignableRoles={assignableRoles}
      />
    </div>
  )
}
