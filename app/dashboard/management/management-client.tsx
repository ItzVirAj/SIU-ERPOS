"use client"

import { useActiveTeam } from "@/lib/context/team-context"
import { DashboardLoader } from "@/components/ui/dashboard-loader"
import { ManagementConsole } from "@/components/dashboard/management-console"

export function ManagementClient() {
  const { teamId, team, loading: teamLoading } = useActiveTeam()

  if (teamLoading || !teamId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <DashboardLoader message="Loading Administration" submessage="Connecting to workspace..." />
      </div>
    )
  }

  return (
    <ManagementConsole
      teamId={teamId}
      teamName={team?.name || "Workspace"}
    />
  )
}
