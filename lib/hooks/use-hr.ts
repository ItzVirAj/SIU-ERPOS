import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

export interface LeaveBalanceData {
  id: string
  year: number
  casualTotal: number
  casualUsed: number
  sickTotal: number
  sickUsed: number
  paidTotal: number
  paidUsed: number
  unpaidUsed: number
}

export interface LeaveRequestItem {
  id: string
  teamId: string
  employeeId: string
  userId: string
  leaveType: "CASUAL" | "SICK" | "PAID" | "UNPAID"
  startDate: string
  endDate: string
  totalDays: number
  reason: string
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
  approvedBy?: string | null
  approvedAt?: string | null
  rejectionReason?: string | null
  emergencyContact?: string | null
  createdAt: string
  employee?: {
    id: string
    fullName: string
    employeeCode?: string | null
    position?: string | null
    department?: string | null
    user?: { name: string; email: string; image?: string | null }
  }
}

export interface AttendanceRecord {
  id: string
  teamId: string
  employeeId: string
  userId: string
  date: string
  checkInTime: string
  checkOutTime?: string | null
  workMode: "OFFICE" | "WFH" | "CLIENT_SITE" | "HALF_DAY"
  status: "PRESENT" | "HALF_DAY" | "ABSENT"
  totalHours?: number | null
  notes?: string | null
  employee?: {
    id: string
    fullName: string
    employeeCode?: string | null
    position?: string | null
    department?: string | null
    user?: { image?: string | null; email: string }
  }
}

export interface OnboardingChecklistItem {
  id: string
  title: string
  category: string
  isCompleted: boolean
  completedAt?: string | null
  completedBy?: string | null
}

export interface OnboardingChecklistRecord {
  id: string
  teamId: string
  employeeId: string
  type: "ONBOARDING" | "OFFBOARDING"
  title: string
  items: OnboardingChecklistItem[]
  isCompleted: boolean
  completedAt?: string | null
  createdAt: string
  employee?: {
    id: string
    fullName: string
    employeeCode?: string | null
    position?: string | null
    department?: string | null
    user?: { name: string; image?: string | null; email: string }
  }
}

export interface JobOpeningRecord {
  id: string
  title: string
  department: string
  location: string
  type: string
  status: "OPEN" | "PAUSED" | "CLOSED"
  openingsCount: number
  description?: string | null
  createdAt: string
  _count?: { candidates: number }
}

export interface CandidateRecord {
  id: string
  teamId: string
  jobOpeningId?: string | null
  fullName: string
  email: string
  phone?: string | null
  stage: "SOURCED" | "SCREENING" | "TECHNICAL" | "FINAL" | "OFFER" | "HIRED" | "REJECTED"
  resumeUrl?: string | null
  portfolioUrl?: string | null
  experienceYears?: number | null
  currentCtc?: number | null
  expectedCtc?: number | null
  noticePeriodDays?: number | null
  rating?: number | null
  notes?: string | null
  createdAt: string
  updatedAt: string
  jobOpening?: { id: string; title: string; department: string } | null
}

// 1. Leaves Hooks
export function useLeaves(teamId: string) {
  return useQuery<{
    leaveBalance: LeaveBalanceData
    myLeaves: LeaveRequestItem[]
    teamLeaves: LeaveRequestItem[]
    activeLeaves: LeaveRequestItem[]
    isManager: boolean
  }>({
    queryKey: ["hr-leaves", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/hr/leaves`)
      if (!res.ok) throw new Error("Failed to load leave records")
      return res.json()
    },
    enabled: !!teamId,
  })
}

export function useSubmitLeave(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      leaveType: string
      startDate: string
      endDate: string
      totalDays?: number
      reason: string
      emergencyContact?: string
    }) => {
      const res = await fetch(`/api/teams/${teamId}/hr/leaves`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to submit leave request")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Leave request submitted for review!")
      queryClient.invalidateQueries({ queryKey: ["hr-leaves", teamId] })
    },
    onError: (err: any) => toast.error(err.message),
  })
}

export function useReviewLeave(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      leaveId,
      action,
      rejectionReason,
    }: {
      leaveId: string
      action: "APPROVE" | "REJECT"
      rejectionReason?: string
    }) => {
      const res = await fetch(`/api/teams/${teamId}/hr/leaves/${leaveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejectionReason }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to review leave request")
      }
      return res.json()
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.action === "APPROVE"
          ? "Leave request approved & deducted from balance"
          : "Leave request declined"
      )
      queryClient.invalidateQueries({ queryKey: ["hr-leaves", teamId] })
    },
    onError: (err: any) => toast.error(err.message),
  })
}

export function useCancelLeave(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (leaveId: string) => {
      const res = await fetch(`/api/teams/${teamId}/hr/leaves/${leaveId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to cancel leave request")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Leave request cancelled")
      queryClient.invalidateQueries({ queryKey: ["hr-leaves", teamId] })
    },
    onError: (err: any) => toast.error(err.message),
  })
}

// 2. Attendance Hooks
export function useAttendance(teamId: string, date?: string) {
  const queryParams = new URLSearchParams()
  if (date) queryParams.set("date", date)

  return useQuery<{
    todayAttendance: AttendanceRecord | null
    teamRegister: AttendanceRecord[]
    targetDate: string
  }>({
    queryKey: ["hr-attendance", teamId, date],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/hr/attendance?${queryParams.toString()}`)
      if (!res.ok) throw new Error("Failed to load attendance")
      return res.json()
    },
    enabled: !!teamId,
  })
}

export function useCheckIn(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { workMode: string; notes?: string }) => {
      const res = await fetch(`/api/teams/${teamId}/hr/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CHECK_IN", ...data }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to check in")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Remote attendance check-in logged!")
      queryClient.invalidateQueries({ queryKey: ["hr-attendance", teamId] })
    },
    onError: (err: any) => toast.error(err.message),
  })
}

export function useCheckOut(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data?: { notes?: string } | void) => {
      const res = await fetch(`/api/teams/${teamId}/hr/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CHECK_OUT", ...(data || {}) }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to check out")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Check-out recorded; day's hours logged!")
      queryClient.invalidateQueries({ queryKey: ["hr-attendance", teamId] })
    },
    onError: (err: any) => toast.error(err.message),
  })
}

// 3. Onboarding Hooks
export function useOnboardingChecklists(teamId: string) {
  return useQuery<{
    checklists: OnboardingChecklistRecord[]
    isManager: boolean
  }>({
    queryKey: ["hr-onboarding", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/hr/onboarding`)
      if (!res.ok) throw new Error("Failed to load onboarding checklists")
      return res.json()
    },
    enabled: !!teamId,
  })
}

export function useCreateChecklist(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { employeeId: string; type?: "ONBOARDING" | "OFFBOARDING"; title?: string }) => {
      const res = await fetch(`/api/teams/${teamId}/hr/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to create checklist")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Checklist initialized!")
      queryClient.invalidateQueries({ queryKey: ["hr-onboarding", teamId] })
    },
    onError: (err: any) => toast.error(err.message),
  })
}

export function useToggleChecklistItem(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { checklistId: string; itemId: string; isCompleted: boolean }) => {
      const res = await fetch(`/api/teams/${teamId}/hr/onboarding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to update item")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-onboarding", teamId] })
    },
    onError: (err: any) => toast.error(err.message),
  })
}

// 4. ATS / Hiring Pipeline Hooks
export function useAtsPipeline(teamId: string) {
  return useQuery<{
    openings: JobOpeningRecord[]
    candidates: CandidateRecord[]
  }>({
    queryKey: ["hr-ats", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/hr/ats`)
      if (!res.ok) throw new Error("Failed to load hiring pipeline")
      return res.json()
    },
    enabled: !!teamId,
  })
}

export function useCreateJobOpening(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      title: string
      department: string
      location?: string
      type?: string
      description?: string
      openingsCount?: number
    }) => {
      const res = await fetch(`/api/teams/${teamId}/hr/ats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CREATE_OPENING", ...data }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to publish job opening")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Job opening published!")
      queryClient.invalidateQueries({ queryKey: ["hr-ats", teamId] })
    },
    onError: (err: any) => toast.error(err.message),
  })
}

export function useAddCandidate(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      jobOpeningId?: string
      fullName: string
      email: string
      phone?: string
      stage?: string
      resumeUrl?: string
      portfolioUrl?: string
      experienceYears?: number
      expectedCtc?: number
      noticePeriodDays?: number
      rating?: number
      notes?: string
    }) => {
      const res = await fetch(`/api/teams/${teamId}/hr/ats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ADD_CANDIDATE", ...data }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to add candidate")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Candidate added to recruitment pipeline!")
      queryClient.invalidateQueries({ queryKey: ["hr-ats", teamId] })
    },
    onError: (err: any) => toast.error(err.message),
  })
}

export function useUpdateCandidateStage(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { candidateId: string; stage?: string; rating?: number; notes?: string }) => {
      const res = await fetch(`/api/teams/${teamId}/hr/ats`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to update candidate")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-ats", teamId] })
    },
    onError: (err: any) => toast.error(err.message),
  })
}
