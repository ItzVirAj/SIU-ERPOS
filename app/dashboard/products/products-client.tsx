"use client"

import { useActiveTeam } from "@/lib/context/team-context"
import { DashboardLoader } from "@/components/ui/dashboard-loader"
import { ProductsConsole } from "@/components/dashboard/products-console"

export function ProductsClient() {
  const { teamId, loading: teamLoading } = useActiveTeam()

  if (teamLoading || !teamId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <DashboardLoader message="Loading SaaS Portfolio" submessage="Syncing domain products, roadmaps & pilot cohorts..." />
      </div>
    )
  }

  return <ProductsConsole />
}
