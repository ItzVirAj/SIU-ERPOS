"use client"

import { useActiveTeam } from "@/lib/context/team-context"
import { DashboardLoader } from "@/components/ui/dashboard-loader"
import { FinanceConsole } from "@/components/dashboard/finance-console"

export default function FinancePage() {
  const { teamId, loading: teamLoading } = useActiveTeam()

  if (teamLoading || !teamId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <DashboardLoader message="Loading Finance Ledger" submessage="Syncing Indian GST records & receivables..." />
      </div>
    )
  }

  return <FinanceConsole />
}
