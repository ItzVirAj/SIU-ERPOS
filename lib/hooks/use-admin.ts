import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

export interface AuditLogItem {
  id: string
  action: string
  entityType: string
  entityId?: string | null
  entityTitle?: string | null
  userName?: string | null
  userEmail?: string | null
  details?: any
  createdAt: string
  timestamp?: string
}

export interface CompanySettingData {
  id?: string
  teamId: string
  legalName?: string | null
  gstin?: string | null
  pan?: string | null
  currency: string
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  country: string
  workingDays?: string[]
  holidays?: string[]
  updatedAt?: string
}

export interface AutomationRuleItem {
  id: string
  name: string
  description?: string | null
  triggerType: string
  actionType: string
  triggerConfig?: any
  actionConfig?: any
  isActive: boolean
  executionCount: number
  lastTriggeredAt?: string | null
  createdAt: string
  logs?: Array<{
    id: string
    status: string
    details?: string | null
    executedAt: string
  }>
}

export interface DeveloperApiKeyItem {
  id: string
  name: string
  keyPrefix: string
  scopes?: string[]
  createdByName: string
  lastUsedAt?: string | null
  expiresAt?: string | null
  isActive: boolean
  createdAt: string
}

export interface WebhookEndpointItem {
  id: string
  url: string
  description?: string | null
  secret: string
  events?: string[]
  isActive: boolean
  lastStatus?: string | null
  createdAt: string
  _count?: { deliveries: number }
  deliveries?: Array<{
    id: string
    event: string
    statusCode: number
    deliveredAt: string
    payload?: any
  }>
}

export interface SystemHealthData {
  status: string
  checkedAt: string
  database: {
    provider: string
    status: string
    latencyMs: number
    connection: string
  }
  server: {
    uptimeSeconds: number
    nodeVersion: string
    environment: string
    memory: {
      rssMb: number
      heapUsedMb: number
      heapTotalMb: number
    }
  }
  workspace: {
    teamId: string
    members: number
    projects: number
    tasks: number
    activeAutomations: number
    recordedAuditLogs: number
  }
}

// ======================== AUDIT LOGS ========================
export function useAuditLogs(
  teamId: string,
  filters?: { action?: string; entityType?: string; search?: string },
  options?: { enabled?: boolean }
) {
  return useQuery<{ logs: AuditLogItem[] }>({
    queryKey: ["audit-logs", teamId, filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.action && filters.action !== "all") params.append("action", filters.action)
      if (filters?.entityType && filters.entityType !== "all") params.append("entityType", filters.entityType)
      if (filters?.search) params.append("search", filters.search)

      const res = await fetch(`/api/teams/${teamId}/audit-logs?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to fetch audit logs")
      return res.json()
    },
    enabled: !!teamId && (options?.enabled ?? true),
    refetchInterval: 30000,
  })
}

// ======================== COMPANY SETTINGS ========================
export function useCompanySettings(teamId: string, options?: { enabled?: boolean }) {
  return useQuery<{ settings: CompanySettingData }>({
    queryKey: ["company-settings", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/company-settings`)
      if (!res.ok) throw new Error("Failed to fetch company settings")
      return res.json()
    },
    enabled: !!teamId && (options?.enabled ?? true),
  })
}

export function useUpdateCompanySettings(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<CompanySettingData>) => {
      const res = await fetch(`/api/teams/${teamId}/company-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to update company settings")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings", teamId] })
      queryClient.invalidateQueries({ queryKey: ["audit-logs", teamId] })
      toast.success("Company settings saved")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save settings")
    },
  })
}

// ======================== AUTOMATIONS ========================
export function useAutomations(teamId: string, options?: { enabled?: boolean }) {
  return useQuery<{ rules: AutomationRuleItem[] }>({
    queryKey: ["automations", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/automations`)
      if (!res.ok) throw new Error("Failed to fetch automations")
      return res.json()
    },
    enabled: !!teamId && (options?.enabled ?? true),
  })
}

export function useCreateAutomation(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      name: string
      description?: string
      triggerType: string
      actionType: string
      triggerConfig?: any
      actionConfig?: any
    }) => {
      const res = await fetch(`/api/teams/${teamId}/automations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to create automation")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations", teamId] })
      queryClient.invalidateQueries({ queryKey: ["audit-logs", teamId] })
      toast.success("Automation rule created")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create automation")
    },
  })
}

export function useToggleAutomation(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ ruleId, isActive }: { ruleId: string; isActive: boolean }) => {
      const res = await fetch(`/api/teams/${teamId}/automations/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      })
      if (!res.ok) throw new Error("Failed to update status")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations", teamId] })
      toast.success("Rule status updated")
    },
  })
}

export function useDeleteAutomation(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ruleId: string) => {
      const res = await fetch(`/api/teams/${teamId}/automations/${ruleId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete automation")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations", teamId] })
      queryClient.invalidateQueries({ queryKey: ["audit-logs", teamId] })
      toast.success("Automation rule deleted")
    },
  })
}

export function useTestRunAutomation(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ruleId: string) => {
      const res = await fetch(`/api/teams/${teamId}/automations/${ruleId}`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Test execution failed")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations", teamId] })
      toast.success("Test execution succeeded")
    },
    onError: (err: any) => {
      toast.error(err.message || "Test run failed")
    },
  })
}

// ======================== API KEYS ========================
export function useDeveloperApiKeys(teamId: string, options?: { enabled?: boolean }) {
  return useQuery<{ keys: DeveloperApiKeyItem[] }>({
    queryKey: ["developer-api-keys", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/api-keys`)
      if (!res.ok) throw new Error("Failed to fetch API keys")
      return res.json()
    },
    enabled: !!teamId && (options?.enabled ?? true),
  })
}

export function useCreateApiKey(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name: string; scopes: string[]; expiresInDays?: number }) => {
      const res = await fetch(`/api/teams/${teamId}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to create API key")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["developer-api-keys", teamId] })
      queryClient.invalidateQueries({ queryKey: ["audit-logs", teamId] })
    },
  })
}

export function useToggleApiKey(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ keyId, isActive }: { keyId: string; isActive: boolean }) => {
      const res = await fetch(`/api/teams/${teamId}/api-keys/${keyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      })
      if (!res.ok) throw new Error("Failed to toggle API key")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["developer-api-keys", teamId] })
      toast.success("API key status updated")
    },
  })
}

export function useRevokeApiKey(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (keyId: string) => {
      const res = await fetch(`/api/teams/${teamId}/api-keys/${keyId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to revoke API key")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["developer-api-keys", teamId] })
      queryClient.invalidateQueries({ queryKey: ["audit-logs", teamId] })
      toast.success("API key revoked")
    },
  })
}

// ======================== WEBHOOKS ========================
export function useWebhooks(teamId: string, options?: { enabled?: boolean }) {
  return useQuery<{ webhooks: WebhookEndpointItem[] }>({
    queryKey: ["webhooks", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/webhooks`)
      if (!res.ok) throw new Error("Failed to fetch webhooks")
      return res.json()
    },
    enabled: !!teamId && (options?.enabled ?? true),
  })
}

export function useCreateWebhook(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { url: string; description?: string; events: string[] }) => {
      const res = await fetch(`/api/teams/${teamId}/webhooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to create webhook")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks", teamId] })
      queryClient.invalidateQueries({ queryKey: ["audit-logs", teamId] })
      toast.success("Webhook endpoint registered")
    },
  })
}

export function useToggleWebhook(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ webhookId, isActive }: { webhookId: string; isActive: boolean }) => {
      const res = await fetch(`/api/teams/${teamId}/webhooks/${webhookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      })
      if (!res.ok) throw new Error("Failed to update webhook")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks", teamId] })
      toast.success("Webhook status updated")
    },
  })
}

export function useDeleteWebhook(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (webhookId: string) => {
      const res = await fetch(`/api/teams/${teamId}/webhooks/${webhookId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete webhook")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks", teamId] })
      queryClient.invalidateQueries({ queryKey: ["audit-logs", teamId] })
      toast.success("Webhook endpoint removed")
    },
  })
}

export function usePingWebhook(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (webhookId: string) => {
      const res = await fetch(`/api/teams/${teamId}/webhooks/${webhookId}/ping`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Ping failed")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks", teamId] })
      toast.success("Webhook ping dispatched successfully")
    },
  })
}

// ======================== SYSTEM HEALTH ========================
export function useSystemHealth(teamId: string, options?: { enabled?: boolean }) {
  return useQuery<SystemHealthData>({
    queryKey: ["system-health", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/system-health`)
      if (!res.ok) throw new Error("Failed to fetch system diagnostics")
      return res.json()
    },
    enabled: !!teamId && (options?.enabled ?? true),
    refetchInterval: 15000,
  })
}
