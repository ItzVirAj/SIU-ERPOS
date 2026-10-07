"use client";

import { ProjectsPage } from "@/components/projects/projects-page";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function Page() {
  return (
    <ErrorBoundary>
      <ProjectsPage />
    </ErrorBoundary>
  );
}
