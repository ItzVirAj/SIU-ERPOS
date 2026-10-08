"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface TeamChannelData {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  isPrivate: boolean;
  teamId: string;
  projectId?: string | null;
  createdBy: string;
  createdAt: string;
  members: {
    userId: string;
    lastReadAt: string;
  }[];
  _count: {
    messages: number;
  };
}

export interface ChatReaction {
  id: string;
  messageId: string;
  userId: string;
  userName: string;
  emoji: string;
}

export interface ChatMessageData {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  senderAvatar?: string | null;
  content: string;
  attachments?: any;
  mentions?: any;
  referencedTaskId?: string | null;
  referencedTask?: {
    id: string;
    title: string;
    number: number;
    priority: string;
    workflowState?: { name: string; color: string };
    assignee?: string | null;
  } | null;
  isPinned: boolean;
  isHuddle: boolean;
  huddleUrl?: string | null;
  parentId?: string | null;
  createdAt: string;
  reactions: ChatReaction[];
  replies?: ChatMessageData[];
}

export interface TeamAnnouncementData {
  id: string;
  teamId: string;
  title: string;
  content: string;
  priority: string;
  authorId: string;
  authorName: string;
  isPinned: boolean;
  createdAt: string;
  isAcknowledgedByMe: boolean;
  ackCount: number;
  acks: {
    userId: string;
    userName: string;
    acknowledgedAt: string;
  }[];
}

export function useTeamChannels(teamId: string) {
  return useQuery<TeamChannelData[]>({
    queryKey: ["team-channels", teamId],
    queryFn: async () => {
      if (!teamId) return [];
      const res = await fetch(`/api/teams/${teamId}/channels`);
      if (!res.ok) {
        if (res.status === 403) throw new Error("Only team members have access to this team chat");
        throw new Error("Failed to load team channels");
      }
      return res.json();
    },
    enabled: Boolean(teamId),
    refetchInterval: 5000,
  });
}

export function useChannelMessages(teamId: string, channelId: string) {
  return useQuery<ChatMessageData[]>({
    queryKey: ["channel-messages", teamId, channelId],
    queryFn: async () => {
      if (!teamId || !channelId) return [];
      const res = await fetch(`/api/teams/${teamId}/channels/${channelId}/messages`);
      if (!res.ok) throw new Error("Failed to load messages");
      return res.json();
    },
    enabled: Boolean(teamId && channelId),
    refetchInterval: 2500, // Near real-time smart polling
  });
}

export function useSendMessage(teamId: string, channelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      content: string;
      attachments?: any;
      referencedTaskId?: string | null;
      isHuddle?: boolean;
      huddleUrl?: string | null;
      parentId?: string | null;
    }) => {
      const res = await fetch(`/api/teams/${teamId}/channels/${channelId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to post message");
      return res.json();
    },
    onMutate: async (newMsg) => {
      await queryClient.cancelQueries({ queryKey: ["channel-messages", teamId, channelId] });
      const previousMessages = queryClient.getQueryData<ChatMessageData[]>([
        "channel-messages",
        teamId,
        channelId,
      ]);

      // Optimistic message
      const optimisticMsg: ChatMessageData = {
        id: "temp-" + Date.now(),
        channelId,
        senderId: "me",
        senderName: "You",
        senderEmail: "",
        content: newMsg.content,
        attachments: newMsg.attachments,
        referencedTaskId: newMsg.referencedTaskId,
        isPinned: false,
        isHuddle: Boolean(newMsg.isHuddle),
        huddleUrl: newMsg.huddleUrl,
        parentId: newMsg.parentId,
        createdAt: new Date().toISOString(),
        reactions: [],
        replies: [],
      };

      if (previousMessages) {
        queryClient.setQueryData(
          ["channel-messages", teamId, channelId],
          [...previousMessages, optimisticMsg]
        );
      }

      return { previousMessages };
    },
    onError: (err, _, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(
          ["channel-messages", teamId, channelId],
          context.previousMessages
        );
      }
      toast.error("Failed to send message");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["channel-messages", teamId, channelId] });
      queryClient.invalidateQueries({ queryKey: ["team-channels", teamId] });
    },
  });
}

export function useToggleReaction(teamId: string, channelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      const res = await fetch(
        `/api/teams/${teamId}/channels/${channelId}/messages/${messageId}/reactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        }
      );
      if (!res.ok) throw new Error("Failed to toggle reaction");
      return res.json();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["channel-messages", teamId, channelId] });
    },
  });
}

export function useCreateChannel(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { name: string; description?: string; isPrivate?: boolean }) => {
      const res = await fetch(`/api/teams/${teamId}/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create channel");
      }
      return res.json();
    },
    onSuccess: (channel) => {
      toast.success(`Channel #${channel.name} created!`);
      queryClient.invalidateQueries({ queryKey: ["team-channels", teamId] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create channel");
    },
  });
}

export function useTeamAnnouncements(teamId: string) {
  return useQuery<TeamAnnouncementData[]>({
    queryKey: ["team-announcements", teamId],
    queryFn: async () => {
      if (!teamId) return [];
      const res = await fetch(`/api/teams/${teamId}/announcements`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: Boolean(teamId),
    refetchInterval: 10000,
  });
}

export function useAcknowledgeAnnouncement(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (announcementId: string) => {
      const res = await fetch(`/api/teams/${teamId}/announcements/${announcementId}/ack`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to acknowledge announcement");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Announcement acknowledged");
      queryClient.invalidateQueries({ queryKey: ["team-announcements", teamId] });
    },
  });
}

export function useCreateAnnouncement(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      title: string;
      content: string;
      priority?: string;
      isPinned?: boolean;
    }) => {
      const res = await fetch(`/api/teams/${teamId}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to post announcement");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Announcement broadcasted to team");
      queryClient.invalidateQueries({ queryKey: ["team-announcements", teamId] });
    },
  });
}
