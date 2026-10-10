"use client"

import React from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useAccess } from "@/lib/hooks/use-access"
import { AppModule, AccessLevel } from "@/lib/prisma-client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmployeesTab } from "./employees-tab"
import { RolesTab } from "./roles-tab"
import { Users, Shield, Lock } from "lucide-react"

interface Props {
  currentUserId: string
}

export function AccessManagementPage({ currentUserId }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const { access, role, can } = useAccess()

  const currentTab = searchParams.get("tab") || "employees"
  const canViewRoles = can(AppModule.ROLES, AccessLevel.VIEW)
  const canProvision = Boolean(role && ["owner", "hr", "cto"].includes(role.key))
  const isViewOnlyActor = access ? access[AppModule.EMPLOYEES] === AccessLevel.VIEW : false

  const handleTabChange = (val: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (val === "employees") {
      params.delete("tab")
    } else {
      params.set("tab", val)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-primary" />
            Access Management
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Provision verified corporate personnel, manage account lifecycle, and view role authorization matrices.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="bg-[#161619] border border-white/[0.08] p-1 h-10 rounded-xl">
          <TabsTrigger
            value="employees"
            className="text-xs data-[state=active]:bg-[#242428] data-[state=active]:text-white rounded-lg px-4 gap-2"
          >
            <Users className="w-3.5 h-3.5" />
            Employees Directory
          </TabsTrigger>

          {canViewRoles && (
            <TabsTrigger
              value="roles"
              className="text-xs data-[state=active]:bg-[#242428] data-[state=active]:text-white rounded-lg px-4 gap-2"
            >
              <Lock className="w-3.5 h-3.5" />
              Role Permissions
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="employees" className="outline-none space-y-4">
          <EmployeesTab
            currentUserId={currentUserId}
            actorRoleKey={role?.key}
            canProvision={canProvision}
            isViewOnlyActor={isViewOnlyActor}
          />
        </TabsContent>

        {canViewRoles && (
          <TabsContent value="roles" className="outline-none space-y-4">
            <RolesTab actorRoleKey={role?.key} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
