"use client";

import { TeamTasksPage } from "@/components/team-tasks/team-tasks-page";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function Page() {
  return (
    <ErrorBoundary>
      <TeamTasksPage />
    </ErrorBoundary>
  );
}
