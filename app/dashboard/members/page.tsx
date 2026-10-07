"use client";

import { MembersPage } from "@/components/members/members-page";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function Page() {
  return (
    <ErrorBoundary>
      <MembersPage />
    </ErrorBoundary>
  );
}

