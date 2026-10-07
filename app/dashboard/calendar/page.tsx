"use client";

import { CalendarPage } from "@/components/calendar/calendar-page";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function CalendarRoute() {
  return (
    <ErrorBoundary>
      <CalendarPage />
    </ErrorBoundary>
  );
}
