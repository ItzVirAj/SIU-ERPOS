"use client";

import { CrmPage } from "@/components/crm/crm-page";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function CrmRoute() {
  return (
    <ErrorBoundary>
      <CrmPage />
    </ErrorBoundary>
  );
}
