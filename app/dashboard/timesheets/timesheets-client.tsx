"use client"

import { useActiveTeam } from "@/lib/context/team-context"
import { DashboardLoader } from "@/components/ui/dashboard-loader"
import { TimesheetsConsole } from "@/components/dashboard/timesheets-console"

export function TimesheetsClient() {
  const { teamId, loading: teamLoading } = useActiveTeam()

  if (teamLoading || !teamId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <DashboardLoader message="Loading Timesheet Console" submessage="Syncing weekly logs, allocations & capacity..." />
      </div>
    )
  }

  return <TimesheetsConsole />
}
