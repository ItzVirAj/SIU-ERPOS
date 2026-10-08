import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

export interface RoadmapItem {
  id: string
  productId: string
  teamId: string
  title: string
  description?: string | null
  quarter: string
  stage: "IDEA" | "PLANNED" | "IN_DEV" | "BETA" | "LIVE"
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  progress: number
  targetDate?: string | null
  effortEstimate?: string | null
  createdAt: string
  updatedAt: string
}

export interface FeatureRequestItem {
  id: string
  productId: string
  teamId: string
  title: string
  description?: string | null
  category: string
  source: string
  requesterName?: string | null
  voteCount: number
  status: "NEW" | "REVIEWED" | "ACCEPTED" | "IN_ROADMAP" | "DECLINED"
  upvotedBy?: string[] | null
  createdAt: string
  updatedAt: string
}

export interface PilotCustomerItem {
  id: string
  productId: string
  teamId: string
  clientId?: string | null
  companyName: string
  contactName?: string | null
  contactEmail?: string | null
  stage: "OUTREACH" | "ONBOARDING" | "PILOT_ACTIVE" | "CONVERTED" | "CHURNED"
  startDate: string
  endDate?: string | null
  feedbackNotes?: string | null
  healthScore: number
  createdAt: string
  client?: {
    id: string
    name: string
    company?: string | null
  } | null
}

export interface ReleaseNoteItem {
  id: string
  productId: string
  teamId: string
  version: string
  title: string
  releaseDate: string
  isPublished: boolean
  features?: any
  improvements?: any
  fixes?: any
  notes?: string | null
  createdAt: string
}

export interface DomainProductItem {
  id: string
  teamId: string
  name: string
  slug: string
  tagline?: string | null
  description?: string | null
  vertical: string
  status: "IDEA" | "RESEARCH" | "DEVELOPMENT" | "BETA" | "LIVE" | "SUNSET"
  ownerName?: string | null
  pricingModel: string
  targetQuarter: string
  websiteUrl?: string | null
  repositoryUrl?: string | null
  mrr: number
  activeUsers: number
  healthScore: number
  createdAt: string
  updatedAt: string
  roadmapItems?: RoadmapItem[]
  featureRequests?: FeatureRequestItem[]
  pilotCustomers?: PilotCustomerItem[]
  releaseNotes?: ReleaseNoteItem[]
}

export interface ReusableComponentItem {
  id: string
  teamId: string
  name: string
  category: string
  description?: string | null
  techStack: string
  repoUrl?: string | null
  timesReused: number
  hoursSavedEstimate: number
  createdAt: string
}

export interface ProductsOverviewSummary {
  totalProducts: number
  activeProductsCount: number
  totalMrr: number
  totalActiveUsers: number
  roadmapItemsCount: number
  inDevelopmentCount: number
  featureRequestsCount: number
  activePilotsCount: number
  reusableComponentsCount: number
  totalHoursSaved: number
}

export function useProductsOverview(teamId: string) {
  return useQuery<{ summary: ProductsOverviewSummary }>({
    queryKey: ["products-overview", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/products/overview`)
      if (!res.ok) throw new Error("Failed to load products overview")
      return res.json()
    },
    enabled: !!teamId,
  })
}

export function useDomainProducts(teamId: string) {
  return useQuery<{ products: DomainProductItem[] }>({
    queryKey: ["domain-products", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/products`)
      if (!res.ok) throw new Error("Failed to load products")
      return res.json()
    },
    enabled: !!teamId,
  })
}

export function useCreateDomainProduct(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      name: string
      tagline?: string
      description?: string
      vertical?: string
      status?: string
      ownerName?: string
      pricingModel?: string
      targetQuarter?: string
      websiteUrl?: string
      repositoryUrl?: string
      mrr?: number
      activeUsers?: number
    }) => {
      const res = await fetch(`/api/teams/${teamId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to create product")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domain-products", teamId] })
      queryClient.invalidateQueries({ queryKey: ["products-overview", teamId] })
      toast.success("Domain product created successfully")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create product")
    },
  })
}

export function useUpdateDomainProduct(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ productId, data }: { productId: string; data: Partial<DomainProductItem> }) => {
      const res = await fetch(`/api/teams/${teamId}/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to update product")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domain-products", teamId] })
      queryClient.invalidateQueries({ queryKey: ["products-overview", teamId] })
      toast.success("Product updated")
    },
  })
}

export function useDeleteDomainProduct(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (productId: string) => {
      const res = await fetch(`/api/teams/${teamId}/products/${productId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete product")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domain-products", teamId] })
      queryClient.invalidateQueries({ queryKey: ["products-overview", teamId] })
      toast.success("Product deleted")
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete product")
    },
  })
}

export function useCreateRoadmapItem(teamId: string, productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      title: string
      description?: string
      quarter?: string
      stage?: string
      priority?: string
      progress?: number
      effortEstimate?: string
      targetDate?: string
    }) => {
      const res = await fetch(`/api/teams/${teamId}/products/${productId}/roadmap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Failed to create roadmap item")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domain-products", teamId] })
      queryClient.invalidateQueries({ queryKey: ["products-overview", teamId] })
      toast.success("Roadmap item added")
    },
  })
}

export function useUpdateRoadmapItem(teamId: string, productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, data }: { itemId: string; data: Partial<RoadmapItem> }) => {
      const res = await fetch(`/api/teams/${teamId}/products/${productId}/roadmap/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to update roadmap item")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domain-products", teamId] })
      queryClient.invalidateQueries({ queryKey: ["products-overview", teamId] })
      toast.success("Roadmap status updated")
    },
  })
}

export function useCreateFeatureRequest(teamId: string, productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      title: string
      description?: string
      category?: string
      source?: string
      requesterName?: string
    }) => {
      const res = await fetch(`/api/teams/${teamId}/products/${productId}/feature-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Failed to submit feature request")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domain-products", teamId] })
      queryClient.invalidateQueries({ queryKey: ["products-overview", teamId] })
      toast.success("Feature request submitted to inbox")
    },
  })
}

export function useVoteFeatureRequest(teamId: string, productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ requestId, action, status }: { requestId: string; action?: string; status?: string }) => {
      const res = await fetch(`/api/teams/${teamId}/products/${productId}/feature-requests`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action, status }),
      })
      if (!res.ok) throw new Error("Failed to update feature request")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domain-products", teamId] })
    },
  })
}

export function useCreatePilotCustomer(teamId: string, productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      companyName: string
      contactName?: string
      contactEmail?: string
      clientId?: string
      stage?: string
      healthScore?: number
      feedbackNotes?: string
      endDate?: string
    }) => {
      const res = await fetch(`/api/teams/${teamId}/products/${productId}/pilot-customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Failed to add pilot customer")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domain-products", teamId] })
      queryClient.invalidateQueries({ queryKey: ["products-overview", teamId] })
      toast.success("Pilot customer enrolled")
    },
  })
}

export function useUpdatePilotCustomer(teamId: string, productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ pilotId, stage, healthScore, feedbackNotes }: { pilotId: string; stage?: string; healthScore?: number; feedbackNotes?: string }) => {
      const res = await fetch(`/api/teams/${teamId}/products/${productId}/pilot-customers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pilotId, stage, healthScore, feedbackNotes }),
      })
      if (!res.ok) throw new Error("Failed to update pilot customer")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domain-products", teamId] })
      toast.success("Pilot customer updated")
    },
  })
}

export function useCreateReleaseNote(teamId: string, productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      version: string
      title: string
      features?: string[]
      improvements?: string[]
      fixes?: string[]
      notes?: string
    }) => {
      const res = await fetch(`/api/teams/${teamId}/products/${productId}/release-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Failed to publish release note")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domain-products", teamId] })
      toast.success("Release notes published")
    },
  })
}

export function useReusableComponents(teamId: string) {
  return useQuery<{ components: ReusableComponentItem[] }>({
    queryKey: ["reusable-components", teamId],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/products/reusable-components`)
      if (!res.ok) throw new Error("Failed to load reusable components")
      return res.json()
    },
    enabled: !!teamId,
  })
}

export function useCreateReusableComponent(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      name: string
      category: string
      description?: string
      techStack: string
      repoUrl?: string
      timesReused?: number
      hoursSavedEstimate?: number
    }) => {
      const res = await fetch(`/api/teams/${teamId}/products/reusable-components`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Failed to add reusable component")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reusable-components", teamId] })
      queryClient.invalidateQueries({ queryKey: ["products-overview", teamId] })
      toast.success("Shared component registered in IP catalog")
    },
  })
}
