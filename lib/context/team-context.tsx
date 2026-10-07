"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { authClient } from "@/lib/auth-client";

interface TeamContextType {
  teamId: string;
  team: any | null;
  loading: boolean;
  refreshTeam: () => Promise<void>;
}

const TeamContext = createContext<TeamContextType>({
  teamId: "",
  team: null,
  loading: true,
  refreshTeam: async () => {},
});

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const [team, setTeam] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const hasInitialized = useRef(false);

  const fetchOrCreateDefaultTeam = useCallback(async () => {
    try {
      // 1. Fetch user's existing teams
      const response = await fetch("/api/teams");
      if (response.ok) {
        const teams = await response.json();
        if (Array.isArray(teams) && teams.length > 0) {
          setTeam(teams[0]);
          setLoading(false);
          return;
        } else {
          // User has not been added to any teams
          setTeam(null);
          setLoading(false);
          return;
        }
      }
    } catch (error) {
      console.error("Error initializing default team context:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSessionPending) return;
    if (!session) {
      setLoading(false);
      return;
    }

    if (!hasInitialized.current) {
      hasInitialized.current = true;
      fetchOrCreateDefaultTeam();
    }
  }, [session, isSessionPending, fetchOrCreateDefaultTeam]);

  return (
    <TeamContext.Provider
      value={{
        teamId: team?.id || "",
        team,
        loading: isSessionPending || loading,
        refreshTeam: fetchOrCreateDefaultTeam,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}

export function useActiveTeam() {
  return useContext(TeamContext);
}
