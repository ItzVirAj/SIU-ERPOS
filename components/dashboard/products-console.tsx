"use client"

import React, { useState } from "react"
import { useActiveTeam } from "@/lib/context/team-context"
import {
  useProductsOverview,
  useDomainProducts,
  useCreateDomainProduct,
  useUpdateDomainProduct,
  useDeleteDomainProduct,
  useCreateRoadmapItem,
  useUpdateRoadmapItem,
  useCreateFeatureRequest,
  useVoteFeatureRequest,
  useCreatePilotCustomer,
  useUpdatePilotCustomer,
  useCreateReleaseNote,
  useReusableComponents,
  useCreateReusableComponent,
  DomainProductItem,
} from "@/lib/hooks/use-domain-products"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Package,
  Layers,
  MapPin,
  ThumbsUp,
  Users,
  Code2,
  Plus,
  ExternalLink,
  Github,
  Calendar,
  CheckCircle2,
  Clock,
  Zap,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Filter,
  Copy,
  Trash2,
  BarChart2,
  Shield,
  Lightbulb,
} from "lucide-react"
import { toast } from "sonner"

function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-"
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function ProductsConsole() {
  const { teamId: activeTeamId } = useActiveTeam()
  const teamId = activeTeamId || ""

  // Queries
  const { data: overviewData, isLoading: loadingOverview } = useProductsOverview(teamId)
  const { data: productsData, isLoading: loadingProducts } = useDomainProducts(teamId)
  const { data: componentsData, isLoading: loadingComponents } = useReusableComponents(teamId)

  // Selected Product Filter
  const [selectedProductId, setSelectedProductId] = useState<string>("ALL")

  // Mutations
  const createProductMutation = useCreateDomainProduct(teamId)
  const updateProductMutation = useUpdateDomainProduct(teamId)
  const deleteProductMutation = useDeleteDomainProduct(teamId)
  const createComponentMutation = useCreateReusableComponent(teamId)

  // Modals state
  const [createProductOpen, setCreateProductOpen] = useState(false)
  const [createRoadmapOpen, setCreateRoadmapOpen] = useState(false)
  const [createFeatureOpen, setCreateFeatureOpen] = useState(false)
  const [createPilotOpen, setCreatePilotOpen] = useState(false)
  const [createReleaseOpen, setCreateReleaseOpen] = useState(false)
  const [createComponentOpen, setCreateComponentOpen] = useState(false)

  // Form states: Create Product
  const [prodName, setProdName] = useState("")
  const [prodTagline, setProdTagline] = useState("")
  const [prodDescription, setProdDescription] = useState("")
  const [prodVertical, setProdVertical] = useState("AGRITECH")
  const [prodStatus, setProdStatus] = useState("DEVELOPMENT")
  const [prodOwner, setProdOwner] = useState("")
  const [prodPricing, setProdPricing] = useState("SUBSCRIPTION")
  const [prodQuarter, setProdQuarter] = useState("Q2_2026")
  const [prodWebsite, setProdWebsite] = useState("")
  const [prodRepo, setProdRepo] = useState("")
  const [prodMrr, setProdMrr] = useState<number>(0)

  // Form states: Create Roadmap Item
  const [roadProductId, setRoadProductId] = useState("")
  const [roadTitle, setRoadTitle] = useState("")
  const [roadDescription, setRoadDescription] = useState("")
  const [roadQuarter, setRoadQuarter] = useState("Q2_2026")
  const [roadStage, setRoadStage] = useState("PLANNED")
  const [roadPriority, setRoadPriority] = useState("MEDIUM")
  const [roadEffort, setRoadEffort] = useState("2 Sprints")

  // Form states: Create Feature Request
  const [featProductId, setFeatProductId] = useState("")
  const [featTitle, setFeatTitle] = useState("")
  const [featDescription, setFeatDescription] = useState("")
  const [featCategory, setFeatCategory] = useState("FEATURE")
  const [featSource, setFeatSource] = useState("PILOT_CUSTOMER")
  const [featRequester, setFeatRequester] = useState("")

  // Form states: Create Pilot Customer
  const [pilotProductId, setPilotProductId] = useState("")
  const [pilotCompany, setPilotCompany] = useState("")
  const [pilotContact, setPilotContact] = useState("")
  const [pilotEmail, setPilotEmail] = useState("")
  const [pilotStage, setPilotStage] = useState("PILOT_ACTIVE")
  const [pilotNotes, setPilotNotes] = useState("")

  // Form states: Create Release Note
  const [relProductId, setRelProductId] = useState("")
  const [relVersion, setRelVersion] = useState("v1.0.0")
  const [relTitle, setRelTitle] = useState("")
  const [relFeatures, setRelFeatures] = useState("")
  const [relFixes, setRelFixes] = useState("")

  // Form states: Create Component
  const [compName, setCompName] = useState("")
  const [compCategory, setCompCategory] = useState("BACKEND")
  const [compDescription, setCompDescription] = useState("")
  const [compTech, setCompTech] = useState("TypeScript, Next.js, Prisma")
  const [compHours, setCompHours] = useState(40)
  const [compReused, setCompReused] = useState(1)

  const products = productsData?.products || []
  const activeProduct = selectedProductId === "ALL" ? products[0] : products.find((p) => p.id === selectedProductId)

  // Roadmap mutation dispatcher
  const targetProductForRoadmap = roadProductId || activeProduct?.id || ""
  const createRoadmapMutation = useCreateRoadmapItem(teamId, targetProductForRoadmap)
  const updateRoadmapMutation = useUpdateRoadmapItem(teamId, targetProductForRoadmap)

  // Feature request mutation dispatcher
  const targetProductForFeature = featProductId || activeProduct?.id || ""
  const createFeatureMutation = useCreateFeatureRequest(teamId, targetProductForFeature)
  const voteFeatureMutation = useVoteFeatureRequest(teamId, targetProductForFeature)

  // Pilot mutation dispatcher
  const targetProductForPilot = pilotProductId || activeProduct?.id || ""
  const createPilotMutation = useCreatePilotCustomer(teamId, targetProductForPilot)
  const updatePilotMutation = useUpdatePilotCustomer(teamId, targetProductForPilot)

  // Release note mutation dispatcher
  const targetProductForRelease = relProductId || activeProduct?.id || ""
  const createReleaseMutation = useCreateReleaseNote(teamId, targetProductForRelease)

  // Handlers
  const handleCreateProduct = async () => {
    if (!prodName) {
      toast.error("Product name is required")
      return
    }

    await createProductMutation.mutateAsync({
      name: prodName,
      tagline: prodTagline,
      description: prodDescription,
      vertical: prodVertical,
      status: prodStatus,
      ownerName: prodOwner,
      pricingModel: prodPricing,
      targetQuarter: prodQuarter,
      websiteUrl: prodWebsite,
      repositoryUrl: prodRepo,
      mrr: prodMrr,
    })

    setCreateProductOpen(false)
    setProdName("")
    setProdTagline("")
    setProdDescription("")
  }

  const handleCreateRoadmapItem = async () => {
    if (!roadTitle || !targetProductForRoadmap) {
      toast.error("Title and product are required")
      return
    }

    await createRoadmapMutation.mutateAsync({
      title: roadTitle,
      description: roadDescription,
      quarter: roadQuarter,
      stage: roadStage,
      priority: roadPriority,
      effortEstimate: roadEffort,
    })

    setCreateRoadmapOpen(false)
    setRoadTitle("")
    setRoadDescription("")
  }

  const handleCreateFeatureRequest = async () => {
    if (!featTitle || !targetProductForFeature) {
      toast.error("Title and product are required")
      return
    }

    await createFeatureMutation.mutateAsync({
      title: featTitle,
      description: featDescription,
      category: featCategory,
      source: featSource,
      requesterName: featRequester,
    })

    setCreateFeatureOpen(false)
    setFeatTitle("")
    setFeatDescription("")
    setFeatRequester("")
  }

  const handleCreatePilot = async () => {
    if (!pilotCompany || !targetProductForPilot) {
      toast.error("Company name is required")
      return
    }

    await createPilotMutation.mutateAsync({
      companyName: pilotCompany,
      contactName: pilotContact,
      contactEmail: pilotEmail,
      stage: pilotStage,
      feedbackNotes: pilotNotes,
    })

    setCreatePilotOpen(false)
    setPilotCompany("")
    setPilotContact("")
    setPilotEmail("")
    setPilotNotes("")
  }

  const handleCreateRelease = async () => {
    if (!relVersion || !relTitle || !targetProductForRelease) {
      toast.error("Version and title are required")
      return
    }

    const featuresList = relFeatures.split("\n").filter((l) => l.trim().length > 0)
    const fixesList = relFixes.split("\n").filter((l) => l.trim().length > 0)

    await createReleaseMutation.mutateAsync({
      version: relVersion,
      title: relTitle,
      features: featuresList,
      fixes: fixesList,
    })

    setCreateReleaseOpen(false)
    setRelVersion("v1.0.0")
    setRelTitle("")
    setRelFeatures("")
    setRelFixes("")
  }

  const handleCreateComponent = async () => {
    if (!compName) {
      toast.error("Component name is required")
      return
    }

    await createComponentMutation.mutateAsync({
      name: compName,
      category: compCategory,
      description: compDescription,
      techStack: compTech,
      hoursSavedEstimate: compHours,
      timesReused: compReused,
    })

    setCreateComponentOpen(false)
    setCompName("")
    setCompDescription("")
  }

  const summary = overviewData?.summary

  // Aggregate roadmap items across selected product or all
  const displayedRoadmapItems = (
    selectedProductId === "ALL"
      ? products.flatMap((p) => p.roadmapItems || [])
      : activeProduct?.roadmapItems || []
  )

  // Aggregate feature requests
  const displayedFeatureRequests = (
    selectedProductId === "ALL"
      ? products.flatMap((p) => p.featureRequests || [])
      : activeProduct?.featureRequests || []
  ).sort((a, b) => b.voteCount - a.voteCount)

  // Aggregate pilot customers
  const displayedPilots = (
    selectedProductId === "ALL"
      ? products.flatMap((p) => p.pilotCustomers || [])
      : activeProduct?.pilotCustomers || []
  )

  // Aggregate release notes
  const displayedReleases = (
    selectedProductId === "ALL"
      ? products.flatMap((p) => p.releaseNotes || [])
      : activeProduct?.releaseNotes || []
  )

  return (
    <div className="flex-1 space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Package className="w-6 h-6 text-primary" />
              Own Products & Roadmap
            </h1>
            <Badge variant="outline" className="text-xs bg-indigo-500/10 text-indigo-400 border-indigo-500/30">
              Module 6.14 PROD • SaaS Portfolio
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Incubate proprietary AgriTech & Industrial SaaS products, quarterly roadmap deliverables, pilot cohorts, and shared IP components.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {/* Product Filter Selector */}
          <Select value={selectedProductId} onValueChange={setSelectedProductId}>
            <SelectTrigger className="w-48 h-9 text-xs bg-muted/30 border-border/60">
              <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Filter Product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Portfolio Products</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.name} ({p.vertical})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={() => setCreateProductOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium shadow-sm h-9 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            New SaaS Product
          </Button>
        </div>
      </div>

      {/* KPI Ribbon Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>SaaS Portfolio</span>
              <Package className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="mt-2 text-xl font-bold text-foreground">
              {summary ? `${summary.totalProducts} Products` : "0 Products"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {summary ? `${summary.activeProductsCount} active in development/live` : "0 active"}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Portfolio MRR</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-xl font-bold text-emerald-400">
              {summary ? formatINR(summary.totalMrr) : "₹0"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {summary ? `${summary.totalActiveUsers} total active accounts` : "0 accounts"}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Pilot Customers</span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <div className="mt-2 text-xl font-bold text-blue-400">
              {summary ? `${summary.activePilotsCount} Active Cohorts` : "0"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Early design & alpha partners
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Roadmap Velocity</span>
              <MapPin className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2 text-xl font-bold text-amber-400">
              {summary ? `${summary.inDevelopmentCount} In Dev` : "0 In Dev"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {summary ? `${summary.roadmapItemsCount} total milestones` : "0 milestones"}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Shared IP Assets</span>
              <Code2 className="w-4 h-4 text-purple-400" />
            </div>
            <div className="mt-2 text-xl font-bold text-purple-400">
              {summary ? `${summary.reusableComponentsCount} Modules` : "0"}
            </div>
            <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              {summary ? `~${summary.totalHoursSaved}h dev saved` : "0h saved"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Layout */}
      <Tabs defaultValue="products" className="space-y-6">
        <TabsList className="bg-muted/40 p-1 border border-border/40 grid grid-cols-2 md:grid-cols-5 w-full">
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            SaaS Portfolio
          </TabsTrigger>
          <TabsTrigger value="roadmap" className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Roadmap Board
          </TabsTrigger>
          <TabsTrigger value="features" className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4" />
            Feature Requests
          </TabsTrigger>
          <TabsTrigger value="pilots" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Pilot Customers
          </TabsTrigger>
          <TabsTrigger value="releases-ip" className="flex items-center gap-2">
            <Code2 className="w-4 h-4" />
            Releases & Shared IP
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: SAAS PORTFOLIO OVERVIEW */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-semibold text-foreground">Proprietary Vertical SaaS Products</h2>
              <p className="text-xs text-muted-foreground">
                Domain IP developed by Sketchitup, isolated from client billable time.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setCreateProductOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Register Product
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingProducts ? (
              <div className="col-span-3 text-center py-12 text-xs text-muted-foreground">
                Loading domain SaaS portfolio...
              </div>
            ) : products.length === 0 ? (
              <div className="col-span-3 text-center py-12 text-xs text-muted-foreground">
                No products registered yet. Click "Register Product" above.
              </div>
            ) : (
              products.map((p) => (
                <Card key={p.id} className="bg-card/60 border-border/50 flex flex-col justify-between hover:border-primary/40 transition-colors">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider">
                          {p.vertical}
                        </Badge>
                        <CardTitle className="text-lg font-bold mt-1 text-foreground">
                          {p.name}
                        </CardTitle>
                      </div>
                      <Badge
                        className={`text-[10px] ${
                          p.status === "LIVE"
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            : p.status === "BETA"
                            ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                            : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                        }`}
                      >
                        {p.status}
                      </Badge>
                    </div>
                    {p.tagline && (
                      <CardDescription className="text-xs text-muted-foreground line-clamp-1 mt-1">
                        {p.tagline}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3">
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {p.description || "Proprietary software solution engineered for vertical market workflows."}
                    </p>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-muted/20 p-2.5 rounded border border-border/30">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Monthly Revenue</span>
                        <span className="font-bold text-emerald-400 font-mono">{formatINR(p.mrr)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Active Users</span>
                        <span className="font-bold text-foreground">{p.activeUsers} accounts</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Pricing Model</span>
                        <span className="text-[11px] font-medium text-foreground">{p.pricingModel}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Target Quarter</span>
                        <span className="text-[11px] font-mono text-indigo-400">{p.targetQuarter.replace("_", " ")}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/30">
                      <span>Lead: <strong className="text-foreground">{p.ownerName || "Founder"}</strong></span>
                      <div className="flex items-center gap-1.5">
                        {p.websiteUrl && (
                          <a
                            href={p.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Website URL"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {p.repositoryUrl && (
                          <a
                            href={p.repositoryUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Repository"
                          >
                            <Github className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-400"
                          onClick={() => {
                            if (confirm(`Delete product ${p.name}?`)) {
                              deleteProductMutation.mutate(p.id)
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* TAB 2: VISUAL ROADMAP BOARD */}
        <TabsContent value="roadmap" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Quarterly Product Roadmap
                {activeProduct && <span className="text-primary font-normal ml-1">({activeProduct.name})</span>}
              </h2>
              <p className="text-xs text-muted-foreground">
                Planned releases and engineering milestones mapped across execution quarters.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                if (activeProduct) setRoadProductId(activeProduct.id)
                setCreateRoadmapOpen(true)
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Roadmap Item
            </Button>
          </div>

          {/* Kanban / Stage Column Board */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {(["PLANNED", "IN_DEV", "BETA", "LIVE"] as const).map((stage) => {
              const itemsInStage = displayedRoadmapItems.filter((i) => i.stage === stage)
              const stageLabels: Record<string, { label: string; badge: string }> = {
                PLANNED: { label: "Planned (Backlog)", badge: "border-border text-muted-foreground" },
                IN_DEV: { label: "In Development", badge: "border-blue-500/40 text-blue-400 bg-blue-500/10" },
                BETA: { label: "Beta & Testing", badge: "border-amber-500/40 text-amber-400 bg-amber-500/10" },
                LIVE: { label: "Live in Production", badge: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10" },
              }

              return (
                <div key={stage} className="bg-muted/20 rounded-lg p-3 border border-border/40 flex flex-col">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/30">
                    <span className="text-xs font-semibold text-foreground">{stageLabels[stage].label}</span>
                    <Badge variant="outline" className={`text-[10px] ${stageLabels[stage].badge}`}>
                      {itemsInStage.length}
                    </Badge>
                  </div>

                  <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[500px]">
                    {itemsInStage.length === 0 ? (
                      <div className="text-center py-6 text-[11px] text-muted-foreground">
                        No items in {stage.toLowerCase()}
                      </div>
                    ) : (
                      itemsInStage.map((item) => (
                        <Card key={item.id} className="bg-card/70 border-border/50 p-3 space-y-2">
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-semibold text-xs text-foreground leading-snug">
                              {item.title}
                            </span>
                            <Badge
                              className={`text-[9px] px-1 py-0 ${
                                item.priority === "CRITICAL"
                                  ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                                  : item.priority === "HIGH"
                                  ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {item.priority}
                            </Badge>
                          </div>
                          {item.description && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2">
                              {item.description}
                            </p>
                          )}
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/30">
                            <span className="font-mono text-indigo-400">{item.quarter.replace("_", " ")}</span>
                            {item.effortEstimate && <span>{item.effortEstimate}</span>}
                          </div>
                          {/* 1-Click Stage Transition */}
                          <div className="pt-1 flex items-center justify-between">
                            <Select
                              value={item.stage}
                              onValueChange={(newStage: any) => {
                                updateRoadmapMutation.mutate({
                                  itemId: item.id,
                                  data: { stage: newStage },
                                })
                              }}
                            >
                              <SelectTrigger className="h-6 text-[10px] w-28 bg-muted/30">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PLANNED" className="text-[10px]">Planned</SelectItem>
                                <SelectItem value="IN_DEV" className="text-[10px]">In Dev</SelectItem>
                                <SelectItem value="BETA" className="text-[10px]">Beta</SelectItem>
                                <SelectItem value="LIVE" className="text-[10px]">Live</SelectItem>
                              </SelectContent>
                            </Select>

                            <span className="text-[10px] text-muted-foreground font-mono">{item.progress}%</span>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </TabsContent>

        {/* TAB 3: FEATURE REQUESTS & FEEDBACK INBOX */}
        <TabsContent value="features" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Feature Requests & Customer Feedback
              </h2>
              <p className="text-xs text-muted-foreground">
                Crowdsourced feedback from pilot clients and sales conversations with voting rank.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                if (activeProduct) setFeatProductId(activeProduct.id)
                setCreateFeatureOpen(true)
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Submit Request
            </Button>
          </div>

          <Card className="bg-card/60 border-border/50">
            <CardContent className="p-0">
              <div className="rounded-md border-t border-border/40 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/40 bg-muted/20 text-xs">
                      <TableHead className="w-16 text-center">Votes</TableHead>
                      <TableHead>Feature Title & Scope</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Source & Requester</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedFeatureRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                          No feature requests logged. Click "Submit Request" above.
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayedFeatureRequests.map((req) => (
                        <TableRow key={req.id} className="border-border/30 hover:bg-muted/10 text-xs">
                          <TableCell className="text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-12 flex flex-col items-center justify-center border-border/60 hover:border-primary/50 text-[11px]"
                              onClick={() => {
                                voteFeatureMutation.mutate({
                                  requestId: req.id,
                                  action: "upvote",
                                })
                              }}
                            >
                              <ThumbsUp className="w-3 h-3 text-primary mb-0.5" />
                              <span className="font-bold">{req.voteCount}</span>
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold text-foreground text-xs">{req.title}</div>
                            {req.description && (
                              <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                                {req.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {req.category}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-foreground">{req.requesterName || "Anonymous"}</div>
                            <div className="text-[10px] text-muted-foreground">{req.source.replace("_", " ")}</div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`text-[10px] ${
                                req.status === "IN_ROADMAP"
                                  ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
                                  : req.status === "ACCEPTED"
                                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                  : req.status === "DECLINED"
                                  ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {req.status.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Select
                              value={req.status}
                              onValueChange={(newStatus) => {
                                voteFeatureMutation.mutate({
                                  requestId: req.id,
                                  status: newStatus,
                                })
                              }}
                            >
                              <SelectTrigger className="h-7 text-[10px] w-28 bg-muted/20 ml-auto">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="NEW" className="text-[10px]">New</SelectItem>
                                <SelectItem value="REVIEWED" className="text-[10px]">Reviewed</SelectItem>
                                <SelectItem value="ACCEPTED" className="text-[10px]">Accepted</SelectItem>
                                <SelectItem value="IN_ROADMAP" className="text-[10px]">In Roadmap</SelectItem>
                                <SelectItem value="DECLINED" className="text-[10px]">Declined</SelectItem>
                              </SelectContent>
                            </Select>
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

        {/* TAB 4: PILOT CUSTOMERS */}
        <TabsContent value="pilots" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Pilot Customer & Design Partner Tracker
              </h2>
              <p className="text-xs text-muted-foreground">
                Track onboarding milestones, health scores, and trial feedback for proprietary products.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                if (activeProduct) setPilotProductId(activeProduct.id)
                setCreatePilotOpen(true)
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Enroll Pilot Customer
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedPilots.length === 0 ? (
              <div className="col-span-3 text-center py-10 text-xs text-muted-foreground">
                No pilot cohorts enrolled yet.
              </div>
            ) : (
              displayedPilots.map((pilot) => (
                <Card key={pilot.id} className="bg-card/60 border-border/50 p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-sm text-foreground">{pilot.companyName}</h3>
                      <div className="text-xs text-muted-foreground">{pilot.contactName} • {pilot.contactEmail}</div>
                    </div>
                    <Badge
                      className={`text-[10px] ${
                        pilot.stage === "CONVERTED"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : pilot.stage === "PILOT_ACTIVE"
                          ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                          : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      }`}
                    >
                      {pilot.stage.replace("_", " ")}
                    </Badge>
                  </div>

                  {pilot.feedbackNotes && (
                    <div className="bg-muted/20 p-2.5 rounded border border-border/30 text-xs text-muted-foreground italic">
                      "{pilot.feedbackNotes}"
                    </div>
                  )}

                  <div className="flex justify-between items-center text-xs pt-1 border-t border-border/30">
                    <span className="text-muted-foreground">
                      Health Score: <strong className="text-emerald-400">{pilot.healthScore}/100</strong>
                    </span>
                    <Select
                      value={pilot.stage}
                      onValueChange={(newStage) => {
                        updatePilotMutation.mutate({
                          pilotId: pilot.id,
                          stage: newStage,
                        })
                      }}
                    >
                      <SelectTrigger className="h-6 text-[10px] w-28 bg-muted/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OUTREACH" className="text-[10px]">Outreach</SelectItem>
                        <SelectItem value="ONBOARDING" className="text-[10px]">Onboarding</SelectItem>
                        <SelectItem value="PILOT_ACTIVE" className="text-[10px]">Active Pilot</SelectItem>
                        <SelectItem value="CONVERTED" className="text-[10px]">Converted Paid</SelectItem>
                        <SelectItem value="CHURNED" className="text-[10px]">Churned</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* TAB 5: RELEASES & REUSABLE IP CATALOG */}
        <TabsContent value="releases-ip" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Release Notes / Changelog */}
            <Card className="bg-card/60 border-border/50">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Changelog & Releases</CardTitle>
                  <CardDescription className="text-xs">
                    Semantic versioning and customer-facing release notes.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    if (activeProduct) setRelProductId(activeProduct.id)
                    setCreateReleaseOpen(true)
                  }}
                  className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  New Release
                </Button>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {displayedReleases.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    No release notes published yet.
                  </div>
                ) : (
                  displayedReleases.map((rel) => (
                    <div key={rel.id} className="p-3 bg-muted/20 rounded border border-border/30 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-primary/20 text-primary font-mono text-[11px]">
                            {rel.version}
                          </Badge>
                          <span className="font-bold text-foreground">{rel.title}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{formatDate(rel.releaseDate)}</span>
                      </div>
                      {Array.isArray(rel.features) && rel.features.length > 0 && (
                        <div>
                          <span className="text-[11px] font-semibold text-emerald-400 block mb-0.5">Features:</span>
                          <ul className="list-disc list-inside space-y-0.5 text-muted-foreground text-[11px]">
                            {rel.features.map((f: string, idx: number) => (
                              <li key={idx}>{f}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {Array.isArray(rel.fixes) && rel.fixes.length > 0 && (
                        <div>
                          <span className="text-[11px] font-semibold text-rose-400 block mb-0.5">Fixes:</span>
                          <ul className="list-disc list-inside space-y-0.5 text-muted-foreground text-[11px]">
                            {rel.fixes.map((fx: string, idx: number) => (
                              <li key={idx}>{fx}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Reusable IP Modules Catalog */}
            <Card className="bg-card/60 border-border/50">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Reusable Agency IP Catalog</CardTitle>
                  <CardDescription className="text-xs">
                    Standardized engineering modules leveraged across client deliveries.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => setCreateComponentOpen(true)}
                  className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Register IP
                </Button>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {(componentsData?.components || []).length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    No components in registry.
                  </div>
                ) : (
                  (componentsData?.components || []).map((comp) => (
                    <div key={comp.id} className="p-3 bg-muted/20 rounded border border-border/30 space-y-2 text-xs">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-bold text-foreground text-xs block">{comp.name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{comp.techStack}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] text-purple-400 border-purple-500/30">
                          {comp.timesReused}x Reused
                        </Badge>
                      </div>
                      {comp.description && (
                        <p className="text-[11px] text-muted-foreground">{comp.description}</p>
                      )}
                      <div className="flex justify-between items-center pt-1 border-t border-border/30 text-[10px]">
                        <span className="text-emerald-400 font-medium">
                          Saved ~{comp.hoursSavedEstimate * comp.timesReused} hours agency delivery
                        </span>
                        {comp.repoUrl && (
                          <a
                            href={comp.repoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <Github className="w-3 h-3" /> Repo
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* MODAL 1: REGISTER NEW PRODUCT */}
      <Dialog open={createProductOpen} onOpenChange={setCreateProductOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Register New SaaS Product
            </DialogTitle>
            <DialogDescription className="text-xs">
              Add a domain vertical SaaS asset to the Sketchitup portfolio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs">Product Name *</Label>
              <Input
                placeholder="e.g. ColdChain IoT, AgriTrack Mandi"
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tagline</Label>
              <Input
                placeholder="e.g. Smart IoT cold-storage telemetry for potato farmers"
                value={prodTagline}
                onChange={(e) => setProdTagline(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Industry Vertical</Label>
                <Select value={prodVertical} onValueChange={setProdVertical}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AGRITECH" className="text-xs">AgriTech</SelectItem>
                    <SelectItem value="INDUSTRIAL" className="text-xs">Industrial IoT</SelectItem>
                    <SelectItem value="LOGISTICS" className="text-xs">Logistics</SelectItem>
                    <SelectItem value="SAAS" className="text-xs">Vertical SaaS</SelectItem>
                    <SelectItem value="FINTECH" className="text-xs">Fintech</SelectItem>
                    <SelectItem value="DEVTOOLS" className="text-xs">DevTools</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Lifecycle Status</Label>
                <Select value={prodStatus} onValueChange={setProdStatus}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IDEA" className="text-xs">Idea</SelectItem>
                    <SelectItem value="RESEARCH" className="text-xs">Research</SelectItem>
                    <SelectItem value="DEVELOPMENT" className="text-xs">Development</SelectItem>
                    <SelectItem value="BETA" className="text-xs">Beta</SelectItem>
                    <SelectItem value="LIVE" className="text-xs">Live</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Pricing Model</Label>
                <Select value={prodPricing} onValueChange={setProdPricing}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SUBSCRIPTION" className="text-xs">Subscription</SelectItem>
                    <SelectItem value="USAGE_BASED" className="text-xs">Usage-based</SelectItem>
                    <SelectItem value="FLAT_RETAINER" className="text-xs">Flat Retainer</SelectItem>
                    <SelectItem value="FREEMIUM" className="text-xs">Freemium</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Target Launch Quarter</Label>
                <Select value={prodQuarter} onValueChange={setProdQuarter}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Q1_2026" className="text-xs">Q1 2026</SelectItem>
                    <SelectItem value="Q2_2026" className="text-xs">Q2 2026</SelectItem>
                    <SelectItem value="Q3_2026" className="text-xs">Q3 2026</SelectItem>
                    <SelectItem value="Q4_2026" className="text-xs">Q4 2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Product Lead / Owner</Label>
              <Input
                placeholder="e.g. Founder / Senior Architect"
                value={prodOwner}
                onChange={(e) => setProdOwner(e.target.value)}
                className="text-xs h-9"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateProductOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleCreateProduct}
              disabled={createProductMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
            >
              {createProductMutation.isPending ? "Creating..." : "Register Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: ADD ROADMAP ITEM */}
      <Dialog open={createRoadmapOpen} onOpenChange={setCreateRoadmapOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-400" />
              Add Roadmap Item
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs">Select Product *</Label>
              <Select value={roadProductId || (activeProduct?.id || "")} onValueChange={setRoadProductId}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Choose product..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Milestone Title *</Label>
              <Input
                placeholder="e.g. Mandi Price Alert Webhooks"
                value={roadTitle}
                onChange={(e) => setRoadTitle(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Quarter</Label>
                <Select value={roadQuarter} onValueChange={setRoadQuarter}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Q1_2026" className="text-xs">Q1 2026</SelectItem>
                    <SelectItem value="Q2_2026" className="text-xs">Q2 2026</SelectItem>
                    <SelectItem value="Q3_2026" className="text-xs">Q3 2026</SelectItem>
                    <SelectItem value="Q4_2026" className="text-xs">Q4 2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Priority</Label>
                <Select value={roadPriority} onValueChange={setRoadPriority}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW" className="text-xs">Low</SelectItem>
                    <SelectItem value="MEDIUM" className="text-xs">Medium</SelectItem>
                    <SelectItem value="HIGH" className="text-xs">High</SelectItem>
                    <SelectItem value="CRITICAL" className="text-xs">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Effort Estimate</Label>
              <Input
                placeholder="e.g. 2 Sprints / 10 SP"
                value={roadEffort}
                onChange={(e) => setRoadEffort(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                placeholder="Describe milestone acceptance criteria..."
                value={roadDescription}
                onChange={(e) => setRoadDescription(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateRoadmapOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleCreateRoadmapItem}
              disabled={createRoadmapMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
            >
              {createRoadmapMutation.isPending ? "Adding..." : "Add to Roadmap"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: SUBMIT FEATURE REQUEST */}
      <Dialog open={createFeatureOpen} onOpenChange={setCreateFeatureOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-purple-400" />
              Submit Feature Request
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs">Feature Title *</Label>
              <Input
                placeholder="e.g. Export Gate Pass to PDF in Marathi"
                value={featTitle}
                onChange={(e) => setFeatTitle(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select value={featCategory} onValueChange={setFeatCategory}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FEATURE" className="text-xs">New Feature</SelectItem>
                    <SelectItem value="INTEGRATION" className="text-xs">Integration</SelectItem>
                    <SelectItem value="PERFORMANCE" className="text-xs">Performance</SelectItem>
                    <SelectItem value="UI_UX" className="text-xs">UI / UX</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Request Source</Label>
                <Select value={featSource} onValueChange={setFeatSource}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PILOT_CUSTOMER" className="text-xs">Pilot Client</SelectItem>
                    <SelectItem value="SALES_DEMO" className="text-xs">Sales Demo Objection</SelectItem>
                    <SelectItem value="FOUNDER" className="text-xs">Founder Note</SelectItem>
                    <SelectItem value="INTERNAL_TEAM" className="text-xs">Team Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Requester Name / Company</Label>
              <Input
                placeholder="e.g. Pune Farmer Federation"
                value={featRequester}
                onChange={(e) => setFeatRequester(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Details</Label>
              <Textarea
                placeholder="Specific problem statement and workflow context..."
                value={featDescription}
                onChange={(e) => setFeatDescription(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateFeatureOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleCreateFeatureRequest}
              disabled={createFeatureMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs"
            >
              {createFeatureMutation.isPending ? "Submitting..." : "Submit to Inbox"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: ENROLL PILOT CUSTOMER */}
      <Dialog open={createPilotOpen} onOpenChange={setCreatePilotOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              Enroll Pilot Customer
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs">Company Name *</Label>
              <Input
                placeholder="e.g. Godavari Agro Warehouses Ltd"
                value={pilotCompany}
                onChange={(e) => setPilotCompany(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Contact Person</Label>
                <Input
                  placeholder="e.g. Vikram Deshmukh"
                  value={pilotContact}
                  onChange={(e) => setPilotContact(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Contact Email</Label>
                <Input
                  placeholder="e.g. vikram@godavariagro.in"
                  value={pilotEmail}
                  onChange={(e) => setPilotEmail(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Trial Notes / SLA Agreement</Label>
              <Textarea
                placeholder="Early access conditions, test warehouse sites..."
                value={pilotNotes}
                onChange={(e) => setPilotNotes(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreatePilotOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleCreatePilot}
              disabled={createPilotMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
            >
              {createPilotMutation.isPending ? "Enrolling..." : "Enroll Pilot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 5: NEW RELEASE NOTE */}
      <Dialog open={createReleaseOpen} onOpenChange={setCreateReleaseOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Publish Release Notes
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Version *</Label>
                <Input
                  placeholder="e.g. v1.1.0"
                  value={relVersion}
                  onChange={(e) => setRelVersion(e.target.value)}
                  className="text-xs font-mono h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Release Title *</Label>
                <Input
                  placeholder="e.g. Mandi Price Feeds"
                  value={relTitle}
                  onChange={(e) => setRelTitle(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">New Features (one per line)</Label>
              <Textarea
                placeholder="Direct Agmarknet API sync&#10;Multi-warehouse location toggle"
                value={relFeatures}
                onChange={(e) => setRelFeatures(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Bug Fixes (one per line)</Label>
              <Textarea
                placeholder="Fixed batch expiry timezone issue"
                value={relFixes}
                onChange={(e) => setRelFixes(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateReleaseOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleCreateRelease}
              disabled={createReleaseMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
            >
              {createReleaseMutation.isPending ? "Publishing..." : "Publish Release"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 6: REGISTER REUSABLE COMPONENT */}
      <Dialog open={createComponentOpen} onOpenChange={setCreateComponentOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Code2 className="w-5 h-5 text-purple-400" />
              Register Shared IP Module
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs">Component / Module Name *</Label>
              <Input
                placeholder="e.g. WhatsApp Cloud API Connector"
                value={compName}
                onChange={(e) => setCompName(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select value={compCategory} onValueChange={setCompCategory}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BACKEND" className="text-xs">Backend / Service</SelectItem>
                    <SelectItem value="FRONTEND" className="text-xs">Frontend / UI</SelectItem>
                    <SelectItem value="AI_ML" className="text-xs">AI & LLM Worker</SelectItem>
                    <SelectItem value="DEVOPS" className="text-xs">DevOps & Edge</SelectItem>
                    <SelectItem value="DESIGN_SYSTEM" className="text-xs">Design System</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Hours Saved / Project</Label>
                <Input
                  type="number"
                  placeholder="e.g. 50"
                  value={compHours}
                  onChange={(e) => setCompHours(Number(e.target.value))}
                  className="text-xs font-mono h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tech Stack</Label>
              <Input
                placeholder="e.g. Node.js, Webhooks, Meta Graph API"
                value={compTech}
                onChange={(e) => setCompTech(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                placeholder="What this module solves and how to install it..."
                value={compDescription}
                onChange={(e) => setCompDescription(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateComponentOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleCreateComponent}
              disabled={createComponentMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs"
            >
              {createComponentMutation.isPending ? "Registering..." : "Register in IP Catalog"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
