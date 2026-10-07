"use client";

import React from "react";
import { HomePage } from "@/components/home/home-page";
import { useActiveTeam } from "@/lib/context/team-context";
import { DashboardLoader } from "@/components/ui/dashboard-loader";

export default function DashboardPage() {
  const { teamId, loading } = useActiveTeam();

  if (loading || !teamId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <DashboardLoader message="Loading SketchItUp" submessage="Connecting to your task suite..." />
      </div>
    );
  }

  return <HomePage teamId={teamId} />;
}

