"use client"

import { useActiveTeam } from "@/lib/context/team-context"
import { DashboardLoader } from "@/components/ui/dashboard-loader"
import { FlowsConsole } from "@/components/dashboard/flows-console"

export default function FlowsPage() {
  const { teamId, team, loading: teamLoading } = useActiveTeam()

  if (teamLoading || !teamId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <DashboardLoader message="Loading Flow Engine" submessage="Initializing cross-module listeners..." />
      </div>
    )
  }

  return (
    <FlowsConsole
      teamId={teamId}
      teamName={team?.name || "Workspace"}
    />
  )
}
