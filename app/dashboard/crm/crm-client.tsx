"use client"

import { CrmPage } from "@/components/crm/crm-page"
import { ErrorBoundary } from "@/components/ui/error-boundary"

export function CrmClient() {
  return (
    <ErrorBoundary>
      <CrmPage />
    </ErrorBoundary>
  )
}
