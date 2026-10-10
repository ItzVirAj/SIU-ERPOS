"use client"

import React from "react"
import { useQuery } from "@tanstack/react-query"
import { adminClient } from "@/lib/api/admin-client"
import { RolesListResponse, RoleListItem } from "@/lib/types/admin"
import { AppModule, AccessLevel } from "@/lib/prisma-client"
import { MODULES } from "@/lib/role-definitions"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Shield, Info, HelpCircle } from "lucide-react"

const MODULE_DESCRIPTIONS: Record<AppModule, string> = {
  [AppModule.WORK]: "Projects, issues, sprint tracking & task orchestration",
  [AppModule.COLLAB]: "Calendar, chat channels, team space & inbox announcements",
  [AppModule.CRM]: "Leads, pipeline stages, client accounts & deal tracking",
  [AppModule.FINANCE]: "Billing, expenses, invoices, payroll & cashflow",
  [AppModule.PRODUCTS]: "SaaS products, catalogs, licenses & digital IP",
  [AppModule.REPORTS]: "Enterprise analytics, executive summaries & KPI exports",
  [AppModule.AUTOMATIONS]: "Automated workflow triggers, background jobs & rules",
  [AppModule.EMPLOYEES]: "Directory, personnel provisioning & lifecycle controls",
  [AppModule.ROLES]: "Permission matrices & access level definitions",
  [AppModule.DEV_SETTINGS]: "API keys, webhooks, system monitoring & SDKs",
  [AppModule.COMPANY_SETTINGS]: "Corporate identity, GSTIN, legal profile & workspace",
  [AppModule.AUDIT_LOGS]: "Immutable security audit trail & event records",
}

const MODULE_LABELS: Record<AppModule, string> = {
  [AppModule.WORK]: "Work",
  [AppModule.COLLAB]: "Collab",
  [AppModule.CRM]: "CRM",
  [AppModule.FINANCE]: "Finance",
  [AppModule.PRODUCTS]: "Products",
  [AppModule.REPORTS]: "Reports",
  [AppModule.AUTOMATIONS]: "Automations",
  [AppModule.EMPLOYEES]: "Employees",
  [AppModule.ROLES]: "Roles",
  [AppModule.DEV_SETTINGS]: "Dev",
  [AppModule.COMPANY_SETTINGS]: "Company",
  [AppModule.AUDIT_LOGS]: "Audit",
}

function getAccessBadge(level: AccessLevel) {
  switch (level) {
    case AccessLevel.MANAGE:
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/25">
          MANAGE
        </span>
      )
    case AccessLevel.WRITE:
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/15 text-blue-300 border border-blue-500/25">
          WRITE
        </span>
      )
    case AccessLevel.VIEW:
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
          VIEW
        </span>
      )
    default:
      return <span className="text-neutral-600 text-xs">—</span>
  }
}

interface Props {
  actorRoleKey?: string
}

export function RolesTab({ actorRoleKey }: Props) {
  const { data, isLoading } = useQuery<RolesListResponse>({
    queryKey: ["admin", "roles"],
    queryFn: () => adminClient.listRoles(),
  })

  const roles = data?.roles ? [...data.roles].sort((a, b) => b.level - a.level) : []

  if (isLoading) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-[#141416] p-4 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full bg-white/[0.04] rounded" />
        ))}
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-4">
        {/* Info Banner */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#161619] border border-white/[0.08] text-xs">
          <div className="flex items-center gap-2.5 text-neutral-300">
            <Info className="w-4 h-4 text-primary shrink-0" />
            <span>
              <strong className="text-white">Authoritative Access Policy:</strong> Only{" "}
              <span className="text-primary font-medium">Owner</span>,{" "}
              <span className="text-primary font-medium">HR</span>, and{" "}
              <span className="text-primary font-medium">CTO</span> roles are permitted to provision accounts or assign roles.
            </span>
          </div>

          {/* Legend */}
          <div className="hidden lg:flex items-center gap-3 text-[11px] text-neutral-400">
            <span className="text-neutral-500 font-medium">Legend:</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-400" /> Manage (Admin)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400" /> Write (Edit)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> View (Read)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-neutral-600" /> None
            </span>
          </div>
        </div>

        {/* Roles Access Matrix */}
        <div className="rounded-xl border border-white/[0.08] bg-[#141416] overflow-x-auto">
          <Table className="min-w-[1000px]">
            <TableHeader className="bg-[#18181b]/80 border-b border-white/[0.08]">
              <TableRow className="border-white/[0.08] hover:bg-transparent">
                <TableHead className="text-xs font-semibold text-white w-52 sticky left-0 bg-[#18181b] z-10">
                  Role
                </TableHead>
                {MODULES.map((mod) => (
                  <TableHead
                    key={mod}
                    className="text-xs font-semibold text-neutral-400 text-center px-1"
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help inline-flex items-center gap-1 py-1 px-1 rounded hover:text-white transition-colors">
                          {MODULE_LABELS[mod]}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        <p className="font-semibold text-white">{MODULE_LABELS[mod]}</p>
                        <p className="text-neutral-300 text-[11px]">{MODULE_DESCRIPTIONS[mod]}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => {
                const isActorRole = role.key === actorRoleKey

                return (
                  <TableRow
                    key={role.key}
                    className={`border-white/[0.05] hover:bg-white/[0.02] transition-colors ${
                      isActorRole ? "bg-primary/[0.06] hover:bg-primary/[0.09]" : ""
                    }`}
                  >
                    {/* Role Title & Level */}
                    <TableCell className="py-2.5 sticky left-0 bg-[#141416] z-10 border-r border-white/[0.04]">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-white text-xs">
                            {role.name}
                          </span>
                          {isActorRole && (
                            <Badge className="bg-primary/20 text-primary border-primary/30 text-[9px] px-1 py-0">
                              Your Role
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] text-neutral-400 line-clamp-1">
                          {role.description}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono">
                          Level {role.level}
                        </span>
                      </div>
                    </TableCell>

                    {/* Module Access Cells */}
                    {MODULES.map((mod) => {
                      const level = role.access[mod] || AccessLevel.NONE

                      return (
                        <TableCell key={mod} className="text-center py-2 px-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-block cursor-default">
                                {getAccessBadge(level)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              {role.name} has{" "}
                              <strong className="text-white">{level}</strong> access to{" "}
                              {MODULE_LABELS[mod]}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  )
}
