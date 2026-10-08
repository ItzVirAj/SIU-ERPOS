import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface LeadStageItem {
  id: string;
  name: string;
  type: "open" | "won" | "lost" | "hold";
  color: string;
  position: number;
}

export interface LeadPipelineItem {
  id: string;
  name: string;
  isDefault: boolean;
  stages: LeadStageItem[];
}

export interface LeadActivityItem {
  id: string;
  type: "call" | "email" | "whatsapp" | "meeting" | "note";
  content: string;
  performedBy: string;
  performedAt: string;
}

export interface LeadItem {
  id: string;
  title: string;
  companyName?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  industryVertical?: string | null;
  source: string;
  campaign?: string | null;
  estimatedValue?: number | null;
  currency: string;
  expectedCloseDate?: string | null;
  requirementSummary?: string | null;
  temperature: "cold" | "warm" | "hot";
  ownerId?: string | null;
  ownerName?: string | null;
  nextFollowUpDate?: string | null;
  isWon: boolean;
  isLost: boolean;
  lostReason?: string | null;
  lostNotes?: string | null;
  convertedClientId?: string | null;
  convertedProjectId?: string | null;
  createdAt: string;
  updatedAt: string;
  stageId: string;
  stage: LeadStageItem;
  client?: any | null;
  activities?: LeadActivityItem[];
}

export interface ClientItem {
  id: string;
  name: string;
  company?: string | null;
  industry?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  status: string;
  notes?: string | null;
  contacts?: Array<{
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    role: string;
    isPrimary: boolean;
  }>;
  projects?: Array<{
    id: string;
    name: string;
    key: string;
    status: string;
    color: string;
  }>;
  leads?: Array<{
    id: string;
    title: string;
    isWon: boolean;
    estimatedValue?: number | null;
  }>;
}

export function useLeadPipeline(teamId: string) {
  return useQuery({
    queryKey: ["crm-pipeline", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/crm/pipelines`);
      if (!res.ok) throw new Error("Failed to fetch CRM pipeline");
      return (await res.json()) as LeadPipelineItem;
    },
    enabled: !!teamId,
  });
}

export function useLeads(
  teamId: string,
  options?: {
    stageId?: string;
    temperature?: string;
    source?: string;
    overdue?: boolean;
    search?: string;
  }
) {
  const queryParams = new URLSearchParams();
  if (options?.stageId) queryParams.set("stageId", options.stageId);
  if (options?.temperature) queryParams.set("temperature", options.temperature);
  if (options?.source) queryParams.set("source", options.source);
  if (options?.overdue) queryParams.set("overdue", "true");
  if (options?.search) queryParams.set("search", options.search);

  return useQuery({
    queryKey: ["crm-leads", teamId, queryParams.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/crm/leads?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch leads");
      const data = await res.json();
      return (data.leads || []) as LeadItem[];
    },
    enabled: !!teamId,
  });
}

export function useLead(teamId: string, leadId?: string) {
  return useQuery({
    queryKey: ["crm-lead", teamId, leadId],
    queryFn: async () => {
      if (!leadId) return null;
      const res = await fetch(`/api/teams/${teamId}/crm/leads/${leadId}`);
      if (!res.ok) throw new Error("Failed to fetch lead");
      return (await res.json()) as LeadItem;
    },
    enabled: !!teamId && !!leadId,
  });
}

export function useCreateLead(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/teams/${teamId}/crm/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to create lead" }));
        throw new Error(err.error || "Failed to create lead");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-leads", teamId] });
    },
  });
}

export function useUpdateLead(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, data }: { leadId: string; data: any }) => {
      const res = await fetch(`/api/teams/${teamId}/crm/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to update lead" }));
        throw new Error(err.error || "Failed to update lead");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-leads", teamId] });
      queryClient.invalidateQueries({ queryKey: ["crm-lead", teamId] });
    },
  });
}

export function useDeleteLead(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leadId: string) => {
      const res = await fetch(`/api/teams/${teamId}/crm/leads/${leadId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to delete lead" }));
        throw new Error(err.error || "Failed to delete lead");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-leads", teamId] });
    },
  });
}

export function useAddLeadActivity(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, data }: { leadId: string; data: any }) => {
      const res = await fetch(`/api/teams/${teamId}/crm/leads/${leadId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to log activity" }));
        throw new Error(err.error || "Failed to log activity");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-leads", teamId] });
      queryClient.invalidateQueries({ queryKey: ["crm-lead", teamId] });
    },
  });
}

export function useConvertLead(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, options }: { leadId: string; options?: any }) => {
      const res = await fetch(`/api/teams/${teamId}/crm/leads/${leadId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options || {}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to convert lead" }));
        throw new Error(err.error || "Failed to convert lead");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-leads", teamId] });
      queryClient.invalidateQueries({ queryKey: ["crm-lead", teamId] });
      queryClient.invalidateQueries({ queryKey: ["crm-clients", teamId] });
      queryClient.invalidateQueries({ queryKey: ["projects", teamId] });
    },
  });
}

export function useClients(teamId: string) {
  return useQuery({
    queryKey: ["crm-clients", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/crm/clients`);
      if (!res.ok) throw new Error("Failed to fetch clients");
      const data = await res.json();
      return (data.clients || []) as ClientItem[];
    },
    enabled: !!teamId,
  });
}
