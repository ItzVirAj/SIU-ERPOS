import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

export interface FlowItem {
  id: string
  name: string
  description?: string | null
  triggerType: string
  actionType: string
  isActive: boolean
  executionCount: number
  lastTriggeredAt?: string | null
  createdAt: string
  logs?: Array<{
    id: string
    status: string
    executedAt: string
  }>
}

export interface FlowHistoryItem {
  id: string
  ruleId: string
  ruleName: string
  triggerType: string
  actionType: string
  status: string
  executedAt: string
  details?: {
    executedActions?: string[]
    createdEntities?: Record<string, any>
    durationMs?: number
  } | null
}

export function useFlows(teamId: string) {
  return useQuery<{ flows: FlowItem[] }>({
    queryKey: ["flows", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/flows`)
      if (!res.ok) throw new Error("Failed to load flows")
      return res.json()
    },
    enabled: !!teamId,
  })
}

export function useCreateFlow(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      name: string
      description?: string
      triggerType: string
      actionType: string
    }) => {
      const res = await fetch(`/api/teams/${teamId}/flows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to create flow")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flows", teamId] })
      toast.success("Cross-Module Flow created")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create flow")
    },
  })
}

export function useToggleFlow(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ flowId, isActive }: { flowId: string; isActive: boolean }) => {
      const res = await fetch(`/api/teams/${teamId}/flows/${flowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      })
      if (!res.ok) throw new Error("Failed to update status")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flows", teamId] })
      toast.success("Flow status updated")
    },
  })
}

export function useDeleteFlow(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (flowId: string) => {
      const res = await fetch(`/api/teams/${teamId}/flows/${flowId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete flow")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flows", teamId] })
      toast.success("Flow deleted")
    },
  })
}

export function useRunFlow(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (flowId: string) => {
      const res = await fetch(`/api/teams/${teamId}/flows/${flowId}/run`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Flow execution failed")
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["flows", teamId] })
      queryClient.invalidateQueries({ queryKey: ["flow-history", teamId] })
      const actionsCount = data?.result?.executedActions?.length || 0
      toast.success(`Workflow executed successfully (${actionsCount} actions completed in ${data?.result?.durationMs}ms)!`)
    },
    onError: (err: any) => {
      toast.error(err.message || "Flow execution failed")
    },
  })
}

export function useFlowHistory(teamId: string) {
  return useQuery<{ history: FlowHistoryItem[] }>({
    queryKey: ["flow-history", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/flows/history`)
      if (!res.ok) throw new Error("Failed to load flow history")
      return res.json()
    },
    enabled: !!teamId,
    refetchInterval: 15000,
  })
}
