"use client";

import { MyTasksPage } from "@/components/my-tasks/my-tasks-page";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function Page() {
  return (
    <ErrorBoundary>
      <MyTasksPage />
    </ErrorBoundary>
  );
}
