import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface CalendarEventItem {
  id: string;
  isIssue?: boolean;
  issueId?: string;
  title: string;
  description?: string | null;
  type: "meeting" | "standup" | "milestone" | "task_deadline" | "followup" | "leave";
  startTime: string | Date;
  endTime: string | Date;
  allDay: boolean;
  location?: string | null;
  meetUrl?: string | null;
  status: string;
  recurrence?: string | null;
  projectId?: string | null;
  project?: {
    id: string;
    name: string;
    key: string;
    color: string;
  } | null;
  workflowState?: {
    id: string;
    name: string;
    type: string;
    color: string;
  } | null;
  priority?: string;
  assignee?: string | null;
  creator?: string | null;
  attendees?: Array<{
    id: string;
    name: string;
    email: string;
    status: string;
  }>;
  meetingNote?: {
    id: string;
    content?: string | null;
    summary?: string | null;
    decisions?: string | null;
    rawTranscript?: string | null;
    followUpEmailDraft?: string | null;
    actionItems?: Array<{
      id: string;
      title: string;
      assigneeName?: string | null;
      dueDate?: string | Date | null;
      status: string;
      convertedIssueId?: string | null;
    }>;
  } | null;
}

export function useCalendarEvents(
  teamId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    type?: string;
    projectId?: string;
    includeIssues?: boolean;
  }
) {
  const queryParams = new URLSearchParams();
  if (options?.startDate) queryParams.set("startDate", options.startDate);
  if (options?.endDate) queryParams.set("endDate", options.endDate);
  if (options?.type) queryParams.set("type", options.type);
  if (options?.projectId) queryParams.set("projectId", options.projectId);
  if (options?.includeIssues !== undefined) {
    queryParams.set("includeIssues", String(options.includeIssues));
  }

  return useQuery({
    queryKey: ["calendar-events", teamId, queryParams.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/calendar/events?${queryParams.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to fetch calendar events");
      }
      const data = await res.json();
      const combined = [
        ...(data.events || []),
        ...(data.issueEvents || []),
      ];
      return combined as CalendarEventItem[];
    },
    enabled: !!teamId,
  });
}

export function useCreateEvent(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/teams/${teamId}/calendar/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to create event" }));
        throw new Error(err.error || "Failed to create event");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events", teamId] });
    },
  });
}

export function useUpdateEvent(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, data }: { eventId: string; data: any }) => {
      const res = await fetch(`/api/teams/${teamId}/calendar/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to update event" }));
        throw new Error(err.error || "Failed to update event");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events", teamId] });
    },
  });
}

export function useDeleteEvent(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      const res = await fetch(`/api/teams/${teamId}/calendar/events/${eventId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to delete event" }));
        throw new Error(err.error || "Failed to delete event");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events", teamId] });
    },
  });
}

export function useSaveMeetingNotes(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, data }: { eventId: string; data: any }) => {
      const res = await fetch(`/api/teams/${teamId}/calendar/events/${eventId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to save meeting notes" }));
        throw new Error(err.error || "Failed to save meeting notes");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events", teamId] });
    },
  });
}

export function useConvertActionItem(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, actionItemId, projectId }: { eventId: string; actionItemId: string; projectId?: string }) => {
      const res = await fetch(`/api/teams/${teamId}/calendar/events/${eventId}/action-items/${actionItemId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to convert action item" }));
        throw new Error(err.error || "Failed to convert action item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events", teamId] });
      queryClient.invalidateQueries({ queryKey: ["issues", teamId] });
    },
  });
}

export function useSummarizeMeeting(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, transcript, apiKey }: { eventId: string; transcript: string; apiKey?: string }) => {
      const res = await fetch(`/api/teams/${teamId}/calendar/events/${eventId}/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, apiKey }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to summarize meeting" }));
        throw new Error(err.error || "Failed to summarize meeting");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events", teamId] });
    },
  });
}

export function useStandupEntries(teamId: string, date?: string) {
  return useQuery({
    queryKey: ["standup-entries", teamId, date || "today"],
    queryFn: async () => {
      const query = date ? `?date=${date}` : "";
      const res = await fetch(`/api/teams/${teamId}/calendar/standup${query}`);
      if (!res.ok) {
        throw new Error("Failed to fetch standup entries");
      }
      const data = await res.json();
      return data.entries;
    },
    enabled: !!teamId,
  });
}

export function useCreateStandup(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { yesterday: string; today: string; blockers?: string; autoCreateBlockerIssue?: boolean; projectId?: string }) => {
      const res = await fetch(`/api/teams/${teamId}/calendar/standup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to submit standup" }));
        throw new Error(err.error || "Failed to submit standup");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["standup-entries", teamId] });
      queryClient.invalidateQueries({ queryKey: ["issues", teamId] });
    },
  });
}
