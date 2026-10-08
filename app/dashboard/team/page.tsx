"use client";

import { useActiveTeam } from "@/lib/context/team-context";
import { TeamHubView } from "@/components/team-space/team-hub-view";
import { DashboardLoader } from "@/components/ui/dashboard-loader";

export default function TeamHubPage() {
  const { teamId, loading } = useActiveTeam();

  if (loading || !teamId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <DashboardLoader message="Loading Team Workspace" submessage="Verifying team membership..." />
      </div>
    );
  }

  return <TeamHubView teamId={teamId} />;
}
