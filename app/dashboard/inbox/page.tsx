"use client";

import { InboxView } from "@/components/dashboard/inbox-view";
import { useActiveTeam } from "@/lib/context/team-context";
import { DashboardLoader } from "@/components/ui/dashboard-loader";

export default function InboxPage() {
  const { teamId, loading } = useActiveTeam();

  if (loading || !teamId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <DashboardLoader message="Loading Inbox" submessage="Fetching notifications..." />
      </div>
    );
  }

  return <InboxView teamId={teamId} />;
}
