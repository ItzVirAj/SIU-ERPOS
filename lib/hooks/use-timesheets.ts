import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

export interface TimeEntryItem {
  id: string
  teamId: string
  userId: string
  timesheetId?: string | null
  date: string
  hours: number
  description: string
  isBillable: boolean
  category: string
  costRate?: number | null
  billingRate?: number | null
  isTimer: boolean
  startedAt?: string | null
  stoppedAt?: string | null
  project?: {
    id: string
    name: string
    key: string
    color: string
  } | null
  issue?: {
    id: string
    title: string
    number: number
    priority?: string
  } | null
  createdAt: string
  updatedAt: string
}

export interface TimesheetRecord {
  id: string
  teamId: string
  userId: string
  weekStartDate: string
  weekEndDate: string
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED"
  totalHours: number
  billableHours: number
  submittedAt?: string | null
  approvedAt?: string | null
  approvedBy?: string | null
  rejectionReason?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
  user?: {
    id: string
    name: string
    email: string
    image?: string | null
    employeeCode?: string | null
    position?: string | null
  }
  entries: TimeEntryItem[]
}

export interface MemberCapacitySummary {
  userId: string
  name: string
  email: string
  employeeCode?: string | null
  position?: string | null
  roleName: string
  standardCapacity: number
  totalAllocated: number
  utilizationRate: number
  isOverAllocated: boolean
  isBench: boolean
  allocations: Array<{
    id: string
    projectId: string
    allocatedHours: number
    role?: string | null
    isContractor: boolean
    contractorRate?: number | null
    project: { id: string; name: string; key: string; color: string }
  }>
}

export interface TimesheetsAnalyticsData {
  period: { startDate: string; endDate: string }
  summary: {
    totalHours: number
    billableHours: number
    nonBillableHours: number
    utilizationRate: number
    entriesCount: number
    contractorTotalCost: number
  }
  categoryBreakdown: Array<{ category: string; hours: number; percentage: number }>
  projectBreakdown: Array<{ name: string; key: string; color: string; hours: number; billableHours: number }>
  memberLeaderboard: Array<{ name: string; hours: number; billableHours: number }>
  estimateAccuracyList: Array<{
    issueId: string
    issueNumber: number
    title: string
    projectName: string
    estimatedHours: number
    actualHours: number
    varianceHours: number
    accuracyPercent: number | null
  }>
  contractorSummary: Array<{
    userName: string
    projectName: string
    allocatedHours: number
    contractorRate: number
    totalCost: number
  }>
}

// 1. Fetch timesheets list
export function useTimesheets(
  teamId: string,
  options?: { scope?: "my" | "team"; status?: string; weekStartDate?: string; userId?: string }
) {
  const queryParams = new URLSearchParams()
  if (options?.scope) queryParams.set("scope", options.scope)
  if (options?.status) queryParams.set("status", options.status)
  if (options?.weekStartDate) queryParams.set("weekStartDate", options.weekStartDate)
  if (options?.userId) queryParams.set("userId", options.userId)

  return useQuery<{ timesheets: TimesheetRecord[]; isManager: boolean }>({
    queryKey: ["timesheets", teamId, options],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/timesheets?${queryParams.toString()}`)
      if (!res.ok) throw new Error("Failed to load timesheets")
      return res.json()
    },
    enabled: !!teamId,
  })
}

// 2. Fetch single timesheet
export function useTimesheet(teamId: string, timesheetId: string) {
  return useQuery<{ timesheet: TimesheetRecord }>({
    queryKey: ["timesheet", teamId, timesheetId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/timesheets/${timesheetId}`)
      if (!res.ok) throw new Error("Failed to load timesheet details")
      return res.json()
    },
    enabled: !!teamId && !!timesheetId,
  })
}

// 3. Create or get weekly timesheet
export function useCreateOrGetTimesheet(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { weekStartDate: string; notes?: string }) => {
      const res = await fetch(`/api/teams/${teamId}/timesheets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to initialize timesheet")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheets", teamId] })
    },
  })
}

// 4. Submit timesheet
export function useSubmitTimesheet(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ timesheetId, notes }: { timesheetId: string; notes?: string }) => {
      const res = await fetch(`/api/teams/${teamId}/timesheets/${timesheetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUBMIT", notes }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to submit timesheet")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Weekly timesheet submitted for approval!")
      queryClient.invalidateQueries({ queryKey: ["timesheets", teamId] })
      queryClient.invalidateQueries({ queryKey: ["timesheet", teamId] })
    },
    onError: (err: any) => toast.error(err.message),
  })
}

// 5. Approve timesheet
export function useApproveTimesheet(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ timesheetId }: { timesheetId: string }) => {
      const res = await fetch(`/api/teams/${teamId}/timesheets/${timesheetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to approve timesheet")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Timesheet approved & locked!")
      queryClient.invalidateQueries({ queryKey: ["timesheets", teamId] })
      queryClient.invalidateQueries({ queryKey: ["timesheet", teamId] })
    },
    onError: (err: any) => toast.error(err.message),
  })
}

// 6. Reject timesheet
export function useRejectTimesheet(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ timesheetId, rejectionReason }: { timesheetId: string; rejectionReason: string }) => {
      const res = await fetch(`/api/teams/${teamId}/timesheets/${timesheetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REJECT", rejectionReason }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to reject timesheet")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.info("Timesheet rejected with feedback.")
      queryClient.invalidateQueries({ queryKey: ["timesheets", teamId] })
      queryClient.invalidateQueries({ queryKey: ["timesheet", teamId] })
    },
    onError: (err: any) => toast.error(err.message),
  })
}

// 7. Log time entry
export function useLogTimeEntry(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      timesheetId?: string
      date: string
      hours: number
      description: string
      projectId?: string | null
      issueId?: string | null
      isBillable?: boolean
      category?: string
      isTimer?: boolean
      startedAt?: string | null
      stoppedAt?: string | null
    }) => {
      const res = await fetch(`/api/teams/${teamId}/timesheets/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to log time entry")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Time logged successfully")
      queryClient.invalidateQueries({ queryKey: ["timesheets", teamId] })
      queryClient.invalidateQueries({ queryKey: ["timesheet", teamId] })
      queryClient.invalidateQueries({ queryKey: ["timesheets-analytics", teamId] })
    },
    onError: (err: any) => toast.error(err.message),
  })
}

// 8. Delete time entry
export function useDeleteTimeEntry(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (entryId: string) => {
      const res = await fetch(`/api/teams/${teamId}/timesheets/entries/${entryId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to delete time entry")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Time entry deleted")
      queryClient.invalidateQueries({ queryKey: ["timesheets", teamId] })
      queryClient.invalidateQueries({ queryKey: ["timesheet", teamId] })
      queryClient.invalidateQueries({ queryKey: ["timesheets-analytics", teamId] })
    },
    onError: (err: any) => toast.error(err.message),
  })
}

// 9. Resource capacity allocations
export function useResourceAllocations(teamId: string, weekStartDate?: string) {
  const queryParams = new URLSearchParams()
  if (weekStartDate) queryParams.set("weekStartDate", weekStartDate)

  return useQuery<{
    weekStartDate: string
    allocations: any[]
    memberCapacity: MemberCapacitySummary[]
    projects: Array<{ id: string; name: string; key: string; color: string }>
    canManage: boolean
  }>({
    queryKey: ["resource-allocations", teamId, weekStartDate],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/timesheets/allocations?${queryParams.toString()}`)
      if (!res.ok) throw new Error("Failed to load resource allocations")
      return res.json()
    },
    enabled: !!teamId,
  })
}

// 10. Upsert allocation
export function useUpsertAllocation(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      userId: string
      projectId: string
      weekStartDate: string
      allocatedHours: number
      role?: string
      notes?: string
      isContractor?: boolean
      contractorRate?: number
    }) => {
      const res = await fetch(`/api/teams/${teamId}/timesheets/allocations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to update allocation")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Resource capacity updated")
      queryClient.invalidateQueries({ queryKey: ["resource-allocations", teamId] })
    },
    onError: (err: any) => toast.error(err.message),
  })
}

// 11. Delete allocation
export function useDeleteAllocation(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/teams/${teamId}/timesheets/allocations?id=${id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to remove allocation")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Allocation removed")
      queryClient.invalidateQueries({ queryKey: ["resource-allocations", teamId] })
    },
    onError: (err: any) => toast.error(err.message),
  })
}

// 12. Analytics
export function useTimesheetsAnalytics(teamId: string, startDate?: string, endDate?: string) {
  const queryParams = new URLSearchParams()
  if (startDate) queryParams.set("startDate", startDate)
  if (endDate) queryParams.set("endDate", endDate)

  return useQuery<TimesheetsAnalyticsData>({
    queryKey: ["timesheets-analytics", teamId, startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/timesheets/analytics?${queryParams.toString()}`)
      if (!res.ok) throw new Error("Failed to load timesheet analytics")
      return res.json()
    },
    enabled: !!teamId,
  })
}
