"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface InboxItem {
  id: string;
  userId: string;
  senderId?: string | null;
  senderName?: string | null;
  senderEmail?: string | null;
  senderAvatar?: string | null;
  subject: string;
  snippet: string;
  content: string;
  category: "primary" | "mention" | "task" | "alert" | "approval";
  entityType?: string | null;
  entityId?: string | null;
  entityUrl?: string | null;
  read: boolean;
  starred: boolean;
  archived: boolean;
  teamId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useInboxMessages(category: string = "all", search: string = "") {
  return useQuery<InboxItem[]>({
    queryKey: ["inbox-messages", category, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (search) params.set("search", search);
      const res = await fetch(`/api/inbox?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch inbox messages");
      return res.json();
    },
    refetchInterval: 6000, // Smart polling every 6 seconds
  });
}

export function useInboxUnreadCount() {
  return useQuery<{ count: number }>({
    queryKey: ["inbox-unread-count"],
    queryFn: async () => {
      const res = await fetch("/api/inbox/unread-count");
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    refetchInterval: 10000, // Update badge every 10 seconds
  });
}

export function useUpdateInboxMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: { read?: boolean; starred?: boolean; archived?: boolean };
    }) => {
      const res = await fetch(`/api/inbox/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update message");
      return res.json();
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ["inbox-messages"] });
      // Optimistic update
      queryClient.setQueriesData<InboxItem[]>({ queryKey: ["inbox-messages"] }, (old) => {
        if (!old) return [];
        return old.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg));
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox-messages"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-unread-count"] });
    },
  });
}

export function useSendInboxMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      recipientId: string;
      subject: string;
      content: string;
      category?: string;
      teamId?: string | null;
    }) => {
      const res = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Message dispatched");
      queryClient.invalidateQueries({ queryKey: ["inbox-messages"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-unread-count"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to send message");
    },
  });
}

export function useDeleteInboxMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/inbox/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete message");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Message removed");
      queryClient.invalidateQueries({ queryKey: ["inbox-messages"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-unread-count"] });
    },
  });
}
