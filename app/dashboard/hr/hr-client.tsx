"use client"

import { useActiveTeam } from "@/lib/context/team-context"
import { DashboardLoader } from "@/components/ui/dashboard-loader"
import { HrConsole } from "@/components/dashboard/hr-console"

export function HrClient() {
  const { teamId, loading: teamLoading } = useActiveTeam()

  if (teamLoading || !teamId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <DashboardLoader message="Loading People Operations (HR)" submessage="Syncing staff directory, leaves, attendance & hiring..." />
      </div>
    )
  }

  return <HrConsole />
}
