"use client";

import { MembersPage } from "@/components/members/members-page";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function PeoplePage() {
  return (
    <ErrorBoundary>
      <MembersPage />
    </ErrorBoundary>
  );
}

