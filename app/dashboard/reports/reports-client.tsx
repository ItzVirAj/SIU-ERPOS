"use client"

import { useActiveTeam } from "@/lib/context/team-context"
import { DashboardLoader } from "@/components/ui/dashboard-loader"
import { ReportsConsole } from "@/components/dashboard/reports-console"

export function ReportsClient() {
  const { teamId, team, loading: teamLoading } = useActiveTeam()

  if (teamLoading || !teamId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <DashboardLoader message="Loading Analytics" submessage="Computing pipeline metrics..." />
      </div>
    )
  }

  return (
    <ReportsConsole
      teamId={teamId}
      teamName={team?.name || "Workspace"}
    />
  )
}
