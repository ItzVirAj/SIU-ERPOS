"use client";

import { useEffect, useState } from "react";

/**
 * Agentation visual feedback toolbar.
 * Strictly active and visible only in development mode,
 * completely omitted from live/production environments.
 */
export function AgentationProvider() {
  const [AgentationComp, setAgentationComp] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      import("agentation")
        .then((mod) => {
          if (mod?.Agentation) {
            setAgentationComp(() => mod.Agentation);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Ensure it is only ever rendered in development mode and never in production/live
  if (process.env.NODE_ENV !== "development" || !AgentationComp) {
    return null;
  }

  return <AgentationComp />;
}
