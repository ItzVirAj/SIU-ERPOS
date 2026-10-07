"use client";

import { useEffect, useState } from "react";
import { Agentation } from "agentation";

/**
 * Agentation visual feedback toolbar.
 * Strictly active and visible only in development mode,
 * completely omitted from live/production environments.
 */
export function AgentationProvider() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Ensure it is only ever rendered in development mode and never in production/live
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  // Prevent SSR hydration issues by mounting after the client is ready
  if (!mounted) {
    return null;
  }

  return <Agentation />;
}
