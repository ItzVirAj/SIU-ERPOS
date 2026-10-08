"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  MessageSquare,
  Users,
  Radio,
  Plus,
  Send,
  Hash,
  Video,
  Pin,
  CheckCircle,
  Bell,
  Sparkles,
  Smile,
  Paperclip,
  Check,
  ExternalLink,
  ChevronRight,
  FolderKanban,
  ListTodo,
  Layers,
  Search,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useTeamChannels,
  useChannelMessages,
  useSendMessage,
  useToggleReaction,
  useCreateChannel,
  useTeamAnnouncements,
  useAcknowledgeAnnouncement,
  useCreateAnnouncement,
  ChatMessageData,
} from "@/lib/hooks/use-team-chat";
import { useTeamMembers, useTeamStats } from "@/lib/hooks/use-team-data";
import { useProjects } from "@/lib/hooks/use-projects";
import { useIssues } from "@/lib/hooks/use-issues";

interface TeamHubViewProps {
  teamId: string;
  initialTab?: "overview" | "chat";
}

const QUICK_EMOJIS = ["👍", "❤️", "🚀", "🔥", "👀", "🎉"];

export function TeamHubView({ teamId, initialTab = "overview" }: TeamHubViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as "overview" | "chat" | null;
  const channelParam = searchParams.get("channel");

  const [activeTab, setActiveTab] = useState<"overview" | "chat">(
    tabParam || initialTab
  );

  // Queries
  const { data: channels = [], isLoading: channelsLoading } = useTeamChannels(teamId);
  const { data: members = [] } = useTeamMembers(teamId);
  const { data: stats } = useTeamStats(teamId);
  const { data: projects = [] } = useProjects(teamId);
  const { data: issues = [] } = useIssues(teamId);
  const { data: announcements = [] } = useTeamAnnouncements(teamId);

  // Active channel selection
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  useEffect(() => {
    if (channelParam && channels.some((c) => c.id === channelParam)) {
      setSelectedChannelId(channelParam);
      setActiveTab("chat");
    } else if (channels.length > 0 && !selectedChannelId) {
      setSelectedChannelId(channels[0].id);
    }
  }, [channelParam, channels, selectedChannelId]);

  const activeChannel = useMemo(() => {
    return channels.find((c) => c.id === selectedChannelId) || channels[0] || null;
  }, [channels, selectedChannelId]);

  // Messages Query & Mutations
  const { data: messages = [], isLoading: messagesLoading } = useChannelMessages(
    teamId,
    activeChannel?.id || ""
  );
  const sendMessageMutation = useSendMessage(teamId, activeChannel?.id || "");
  const toggleReactionMutation = useToggleReaction(teamId, activeChannel?.id || "");
  const createChannelMutation = useCreateChannel(teamId);
  const ackAnnouncementMutation = useAcknowledgeAnnouncement(teamId);
  const createAnnouncementMutation = useCreateAnnouncement(teamId);

  // Local Chat state
  const [messageText, setMessageText] = useState("");
  const [selectedTaskToAttach, setSelectedTaskToAttach] = useState<string | null>(null);
  const [showTaskSelector, setShowTaskSelector] = useState(false);
  const [activeThreadMessage, setActiveThreadMessage] = useState<ChatMessageData | null>(null);
  const [threadReplyText, setThreadReplyText] = useState("");
  const [channelSearch, setChannelSearch] = useState("");

  // Dialogs
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");

  const [createAnnounceOpen, setCreateAnnounceOpen] = useState(false);
  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceContent, setAnnounceContent] = useState("");
  const [announcePriority, setAnnouncePriority] = useState("normal");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  // Handlers
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageText.trim() && !selectedTaskToAttach) return;

    await sendMessageMutation.mutateAsync({
      content: messageText.trim(),
      referencedTaskId: selectedTaskToAttach,
    });

    setMessageText("");
    setSelectedTaskToAttach(null);
  };

  const handleSendThreadReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!threadReplyText.trim() || !activeThreadMessage) return;

    await sendMessageMutation.mutateAsync({
      content: threadReplyText.trim(),
      parentId: activeThreadMessage.id,
    });

    setThreadReplyText("");
  };

  // Google Meet Quick Huddle (COMM-10)
  const handleLaunchHuddle = async () => {
    const meetId = `siu-${Math.random().toString(36).substring(2, 7)}-${Math.random().toString(36).substring(2, 6)}`;
    const meetUrl = `https://meet.google.com/${meetId}`;

    if (activeChannel) {
      await sendMessageMutation.mutateAsync({
        content: `🔴 **Quick Team Huddle Started**\nJoin now: ${meetUrl}`,
        isHuddle: true,
        huddleUrl: meetUrl,
      });
    }

    window.open(meetUrl, "_blank");
    toast.success("Huddle meeting opened in new tab and shared to channel!");
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;
    await createChannelMutation.mutateAsync({
      name: newChannelName.trim(),
      description: newChannelDesc.trim() || undefined,
    });
    setCreateChannelOpen(false);
    setNewChannelName("");
    setNewChannelDesc("");
  };

  const handleCreateAnnouncement = async () => {
    if (!announceTitle.trim() || !announceContent.trim()) return;
    await createAnnouncementMutation.mutateAsync({
      title: announceTitle.trim(),
      content: announceContent.trim(),
      priority: announcePriority,
    });
    setCreateAnnounceOpen(false);
    setAnnounceTitle("");
    setAnnounceContent("");
  };

  // Filtered channels
  const filteredChannels = useMemo(() => {
    return channels.filter((c) =>
      c.name.toLowerCase().includes(channelSearch.toLowerCase())
    );
  }, [channels, channelSearch]);

  const generalChannels = filteredChannels.filter((c) => c.type === "channel");
  const projectChannels = filteredChannels.filter((c) => c.type === "project");

  return (
    <div className="flex flex-col h-full w-full bg-[#0e0f11] text-neutral-100 overflow-hidden">
      {/* Top Team Header Bar */}
      <div className="shrink-0 flex items-center justify-between border-b border-white/[0.08] px-6 py-3 bg-[#121316]">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-400">
            {teamId ? teamId.slice(0, 2).toUpperCase() : "TM"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold tracking-tight text-white">
                Team Workspace
              </h1>
              <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                Active Member Space
              </Badge>
            </div>
            <p className="text-xs text-neutral-400">
              Scoped exclusively to assigned team members
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 bg-neutral-900/80 p-1 rounded-lg border border-white/[0.08]">
          <button
            onClick={() => setActiveTab("overview")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              activeTab === "overview"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-neutral-400 hover:text-neutral-200"
            )}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Mini-Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              activeTab === "chat"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-neutral-400 hover:text-neutral-200"
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Team Chatspace</span>
          </button>
        </div>

        {/* Quick Huddle button in header */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleLaunchHuddle}
            className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
          >
            <Video className="h-3.5 w-3.5" />
            <span>Start Quick Huddle</span>
          </Button>
        </div>
      </div>

      {/* Main Body: Tab 1 (Mini-Dashboard) or Tab 2 (Chatspace) */}
      {activeTab === "overview" ? (
        <ScrollArea className="flex-1 p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-400 font-medium">Team Members</p>
                  <p className="text-2xl font-bold text-white mt-1">{members.length}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Users className="h-5 w-5" />
                </div>
              </div>

              <div className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-400 font-medium">Active Projects</p>
                  <p className="text-2xl font-bold text-white mt-1">{projects.length}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <FolderKanban className="h-5 w-5" />
                </div>
              </div>

              <div className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-400 font-medium">Open Tasks</p>
                  <p className="text-2xl font-bold text-white mt-1">{issues.length}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <ListTodo className="h-5 w-5" />
                </div>
              </div>

              <div className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-400 font-medium">Team Channels</p>
                  <p className="text-2xl font-bold text-white mt-1">{channels.length}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <MessageSquare className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Announcements Card (COMM-05) */}
            <div className="p-5 rounded-xl border border-white/[0.08] bg-white/[0.02] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Pin className="h-4 w-4 text-amber-400" />
                  <h2 className="text-sm font-semibold text-white">Team Announcements & Acknowledgements</h2>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCreateAnnounceOpen(true)}
                  className="h-7 text-xs border-white/[0.1] hover:bg-white/[0.05]"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  New Announcement
                </Button>
              </div>

              {announcements.length === 0 ? (
                <div className="text-center py-6 text-neutral-500 text-xs">
                  No announcements yet. Leaders can post broadcast updates here.
                </div>
              ) : (
                <div className="space-y-3">
                  {announcements.map((ann) => (
                    <div
                      key={ann.id}
                      className={cn(
                        "p-4 rounded-lg border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4",
                        ann.priority === "urgent"
                          ? "bg-rose-500/5 border-rose-500/30"
                          : "bg-neutral-900/60 border-white/[0.06]"
                      )}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {ann.priority === "urgent" && (
                            <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-[10px]">
                              URGENT
                            </Badge>
                          )}
                          <h3 className="text-sm font-semibold text-neutral-100">{ann.title}</h3>
                          <span className="text-[11px] text-neutral-500">by {ann.authorName}</span>
                        </div>
                        <p className="text-xs text-neutral-300 leading-relaxed">{ann.content}</p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] text-neutral-400">
                          {ann.ackCount} {ann.ackCount === 1 ? "ack" : "acks"}
                        </span>
                        {ann.isAcknowledgedByMe ? (
                          <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 gap-1 text-xs">
                            <CheckCircle className="h-3 w-3" /> Acknowledged
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => ackAnnouncementMutation.mutate(ann.id)}
                            className="h-7 text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
                          >
                            <Check className="h-3 w-3 mr-1" /> Acknowledge
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Two Column Layout: Team Roster & Quick Action */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Member Roster (COMM-09 Presence) */}
              <div className="p-5 rounded-xl border border-white/[0.08] bg-white/[0.02] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-indigo-400" />
                    <h2 className="text-sm font-semibold text-white">Assigned Team Members</h2>
                  </div>
                  <span className="text-xs text-neutral-400">{members.length} members</span>
                </div>

                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-900/40 border border-white/[0.04]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-indigo-600/30 text-indigo-300 text-xs">
                              {member.userName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-[#0e0f11]" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-white">{member.userName}</p>
                          <p className="text-[11px] text-neutral-400">{member.userEmail}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] text-neutral-400 border-white/[0.1]">
                        {member.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Jump to Chat Card */}
              <div className="p-5 rounded-xl border border-white/[0.08] bg-gradient-to-br from-indigo-950/20 to-neutral-900/40 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-400" />
                    <h2 className="text-sm font-semibold text-white">Live Team Communication</h2>
                  </div>
                  <p className="text-xs text-neutral-300 leading-relaxed">
                    Collaborate with your team in dedicated channels, share task cards, and hop on instant Google Meet huddles without leaving the platform.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <Button
                    onClick={() => setActiveTab("chat")}
                    className="w-full h-9 text-xs bg-indigo-600 hover:bg-indigo-500 text-white gap-2"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Open Team Chatspace</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleLaunchHuddle}
                    className="w-full h-9 text-xs border-white/[0.1] hover:bg-white/[0.05] gap-2"
                  >
                    <Video className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Launch Google Meet Room</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      ) : (
        /* Tab 2: Full Team Chatspace */
        <div className="flex-1 flex overflow-hidden">
          {/* Left Channel Sidebar */}
          <div className="w-64 shrink-0 border-r border-white/[0.08] bg-[#0c0d0f] flex flex-col">
            {/* Search channels */}
            <div className="p-3 border-b border-white/[0.08]">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-500" />
                <Input
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  placeholder="Search channels..."
                  className="h-8 pl-8 text-xs bg-neutral-900/60 border-white/[0.08] text-neutral-200 placeholder:text-neutral-500"
                />
              </div>
            </div>

            <ScrollArea className="flex-1 p-3">
              <div className="space-y-4">
                {/* General Channels */}
                <div>
                  <div className="flex items-center justify-between px-2 mb-1.5">
                    <span className="text-[11px] font-semibold tracking-wider uppercase text-neutral-400">
                      Channels
                    </span>
                    <button
                      onClick={() => setCreateChannelOpen(true)}
                      className="text-neutral-400 hover:text-white"
                      title="Create Channel"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="space-y-0.5">
                    {generalChannels.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedChannelId(c.id)}
                        className={cn(
                          "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors",
                          activeChannel?.id === c.id
                            ? "bg-indigo-600/20 text-indigo-300 font-medium"
                            : "text-neutral-300 hover:bg-white/[0.04]"
                        )}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Hash className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                          <span className="truncate">{c.name}</span>
                        </div>
                        {c._count.messages > 0 && (
                          <span className="text-[10px] text-neutral-500 font-mono">
                            {c._count.messages}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Project Auto Channels */}
                {projectChannels.length > 0 && (
                  <div>
                    <div className="px-2 mb-1.5">
                      <span className="text-[11px] font-semibold tracking-wider uppercase text-neutral-400">
                        Project Channels
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {projectChannels.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setSelectedChannelId(c.id)}
                          className={cn(
                            "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors",
                            activeChannel?.id === c.id
                              ? "bg-indigo-600/20 text-indigo-300 font-medium"
                              : "text-neutral-300 hover:bg-white/[0.04]"
                          )}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FolderKanban className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                            <span className="truncate">{c.name}</span>
                          </div>
                          {c._count.messages > 0 && (
                            <span className="text-[10px] text-neutral-500 font-mono">
                              {c._count.messages}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Team Direct Messages */}
                <div>
                  <div className="px-2 mb-1.5">
                    <span className="text-[11px] font-semibold tracking-wider uppercase text-neutral-400">
                      Team Members (DMs)
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {members.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          // Open general channel with pre-filled mention
                          setMessageText(`@${m.userName} `);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-neutral-300 hover:bg-white/[0.04] transition-colors"
                      >
                        <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                        <span className="truncate">{m.userName}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* Center Chat Feed Pane */}
          <div className="flex-1 flex flex-col bg-[#0e0f11] overflow-hidden">
            {/* Channel Header */}
            <div className="h-12 border-b border-white/[0.08] px-4 flex items-center justify-between bg-[#121316] shrink-0">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-indigo-400" />
                <span className="text-sm font-semibold text-white">
                  {activeChannel ? activeChannel.name : "Select Channel"}
                </span>
                {activeChannel?.description && (
                  <span className="text-xs text-neutral-400 hidden sm:inline-block border-l border-white/[0.1] pl-2 ml-1">
                    {activeChannel.description}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleLaunchHuddle}
                  className="h-7 text-xs border-white/[0.1] hover:bg-white/[0.05] text-emerald-400 gap-1.5"
                >
                  <Video className="h-3.5 w-3.5" />
                  <span>Huddle</span>
                </Button>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <div className="py-20 text-center">
                    <MessageCircle className="h-8 w-8 text-neutral-600 mx-auto mb-2" />
                    <p className="text-sm text-neutral-400 font-medium">No messages in #{activeChannel?.name} yet</p>
                    <p className="text-xs text-neutral-500 mt-1">Send a message to kick off the team conversation!</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className="group flex gap-3 p-2 rounded-lg hover:bg-white/[0.02] transition-colors"
                    >
                      <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                        <AvatarFallback className="bg-indigo-600/30 text-indigo-300 text-xs">
                          {msg.senderName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-semibold text-white">
                            {msg.senderName}
                          </span>
                          <span className="text-[10px] text-neutral-500">
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        {/* Huddle Card Banner (COMM-10) */}
                        {msg.isHuddle && msg.huddleUrl && (
                          <div className="p-3 my-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                <Video className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-xs font-medium text-emerald-200">Google Meet Quick Huddle</p>
                                <p className="text-[11px] text-emerald-400/80">Room link active</p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => window.open(msg.huddleUrl!, "_blank")}
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                            >
                              Join Meeting
                            </Button>
                          </div>
                        )}

                        {/* Regular Text Content */}
                        <div className="text-xs text-neutral-200 leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </div>

                        {/* Referenced Task Card (COMM-03) */}
                        {msg.referencedTask && (
                          <div className="mt-2 p-3 rounded-lg bg-neutral-900/60 border border-white/[0.08] flex items-center justify-between max-w-md">
                            <div className="flex items-center gap-2.5">
                              <Badge variant="outline" className="text-[10px] font-mono border-white/[0.1] text-indigo-300">
                                #{msg.referencedTask.number}
                              </Badge>
                              <div>
                                <p className="text-xs font-medium text-white line-clamp-1">
                                  {msg.referencedTask.title}
                                </p>
                                <p className="text-[10px] text-neutral-400">
                                  Priority: {msg.referencedTask.priority}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/dashboard/issues`)}
                              className="h-6 px-2 text-[11px] text-neutral-400 hover:text-white"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                        )}

                        {/* Emoji Reactions & Thread Reply Buttons */}
                        <div className="flex items-center gap-2 pt-1">
                          {msg.reactions.length > 0 && (
                            <div className="flex items-center gap-1">
                              {Array.from(new Set(msg.reactions.map((r) => r.emoji))).map((emoji) => {
                                const count = msg.reactions.filter((r) => r.emoji === emoji).length;
                                return (
                                  <button
                                    key={emoji}
                                    onClick={() => toggleReactionMutation.mutate({ messageId: msg.id, emoji })}
                                    className="px-2 py-0.5 rounded-full text-xs bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-neutral-300 flex items-center gap-1"
                                  >
                                    <span>{emoji}</span>
                                    <span className="text-[10px] text-neutral-400">{count}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Quick Emoji Reaction Buttons on Hover */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            {QUICK_EMOJIS.slice(0, 3).map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => toggleReactionMutation.mutate({ messageId: msg.id, emoji })}
                                className="h-6 w-6 rounded hover:bg-white/[0.08] text-xs flex items-center justify-center text-neutral-400 hover:text-white"
                              >
                                {emoji}
                              </button>
                            ))}
                            <button
                              onClick={() => setActiveThreadMessage(msg)}
                              className="h-6 px-1.5 rounded hover:bg-white/[0.08] text-[11px] text-neutral-400 hover:text-white flex items-center gap-1"
                            >
                              <MessageSquare className="h-3 w-3" />
                              <span>{msg.replies?.length ? `${msg.replies.length} replies` : "Reply"}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Task Attachment Pill preview */}
            {selectedTaskToAttach && (
              <div className="px-4 py-1.5 bg-neutral-900 border-t border-white/[0.08] flex items-center justify-between text-xs text-indigo-400">
                <span className="flex items-center gap-2">
                  <ListTodo className="h-3.5 w-3.5" />
                  Attached Task: {issues.find((i) => i.id === selectedTaskToAttach)?.title || selectedTaskToAttach}
                </span>
                <button
                  onClick={() => setSelectedTaskToAttach(null)}
                  className="text-neutral-500 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Input Bar */}
            <div className="p-3 border-t border-white/[0.08] bg-[#121316]">
              <form onSubmit={handleSendMessage} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={`Message #${activeChannel?.name || "channel"}... (type @ to mention, click Task to link)`}
                    className="h-10 text-xs bg-neutral-900/80 border-white/[0.08] text-neutral-100 placeholder:text-neutral-500"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!messageText.trim() && !selectedTaskToAttach}
                    className="h-10 px-4 bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="flex items-center justify-between px-1 text-[11px] text-neutral-500">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTaskSelector(true)}
                      className="hover:text-neutral-300 flex items-center gap-1"
                    >
                      <ListTodo className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Link Task Card</span>
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={handleLaunchHuddle}
                      className="hover:text-neutral-300 flex items-center gap-1"
                    >
                      <Video className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Quick Huddle</span>
                    </button>
                  </div>
                  <span>Press Enter to send</span>
                </div>
              </form>
            </div>
          </div>

          {/* Right Slide-out Thread Drawer */}
          {activeThreadMessage && (
            <div className="w-80 border-l border-white/[0.08] bg-[#0c0d0f] flex flex-col shrink-0">
              <div className="h-12 border-b border-white/[0.08] px-4 flex items-center justify-between bg-[#121316]">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-indigo-400" />
                  <span className="text-xs font-semibold text-white">Thread</span>
                </div>
                <button
                  onClick={() => setActiveThreadMessage(null)}
                  className="text-neutral-500 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>

              {/* Original Message */}
              <div className="p-3 border-b border-white/[0.06] bg-neutral-900/30">
                <p className="text-[11px] font-semibold text-neutral-300">
                  {activeThreadMessage.senderName}
                </p>
                <p className="text-xs text-neutral-200 mt-1">
                  {activeThreadMessage.content}
                </p>
              </div>

              {/* Thread Replies */}
              <ScrollArea className="flex-1 p-3">
                <div className="space-y-3">
                  {activeThreadMessage.replies?.map((rep) => (
                    <div key={rep.id} className="text-xs space-y-0.5">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-white text-[11px]">
                          {rep.senderName}
                        </span>
                        <span className="text-[10px] text-neutral-500">
                          {new Date(rep.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-neutral-300">{rep.content}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Reply Input */}
              <div className="p-3 border-t border-white/[0.08] bg-[#121316]">
                <form onSubmit={handleSendThreadReply} className="flex gap-2">
                  <Input
                    value={threadReplyText}
                    onChange={(e) => setThreadReplyText(e.target.value)}
                    placeholder="Reply to thread..."
                    className="h-8 text-xs bg-neutral-900 border-white/[0.08] text-white"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!threadReplyText.trim()}
                    className="h-8 px-3 bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    <Send className="h-3 w-3" />
                  </Button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Task Linker Dialog */}
      <Dialog open={showTaskSelector} onOpenChange={setShowTaskSelector}>
        <DialogContent className="sm:max-w-md bg-[#121316] border-white/[0.08] text-white">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Attach Task Card to Message</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-60 space-y-1">
            {issues.map((task) => (
              <button
                key={task.id}
                onClick={() => {
                  setSelectedTaskToAttach(task.id);
                  setShowTaskSelector(false);
                }}
                className="w-full text-left p-2.5 rounded-lg hover:bg-white/[0.05] flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-mono text-indigo-400 mr-2">#{task.number}</span>
                  <span className="text-neutral-200">{task.title}</span>
                </div>
                <Badge variant="outline" className="text-[10px] border-white/[0.1]">
                  {task.priority}
                </Badge>
              </button>
            ))}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Create Channel Dialog */}
      <Dialog open={createChannelOpen} onOpenChange={setCreateChannelOpen}>
        <DialogContent className="sm:max-w-md bg-[#121316] border-white/[0.08] text-white">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Create Team Channel</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs text-neutral-400 font-medium">Channel Name</label>
              <Input
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="e.g. frontend, marketing, design"
                className="h-9 mt-1 text-xs bg-neutral-900 border-white/[0.08] text-white"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 font-medium">Description (Optional)</label>
              <Input
                value={newChannelDesc}
                onChange={(e) => setNewChannelDesc(e.target.value)}
                placeholder="What is this channel about?"
                className="h-9 mt-1 text-xs bg-neutral-900 border-white/[0.08] text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateChannelOpen(false)}
              className="text-xs border-white/[0.1]"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateChannel}
              disabled={!newChannelName.trim()}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Create Channel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Announcement Dialog */}
      <Dialog open={createAnnounceOpen} onOpenChange={setCreateAnnounceOpen}>
        <DialogContent className="sm:max-w-md bg-[#121316] border-white/[0.08] text-white">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Broadcast Team Announcement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs text-neutral-400 font-medium">Title</label>
              <Input
                value={announceTitle}
                onChange={(e) => setAnnounceTitle(e.target.value)}
                placeholder="Announcement headline"
                className="h-9 mt-1 text-xs bg-neutral-900 border-white/[0.08] text-white"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 font-medium">Content</label>
              <Input
                value={announceContent}
                onChange={(e) => setAnnounceContent(e.target.value)}
                placeholder="Details of the announcement"
                className="h-9 mt-1 text-xs bg-neutral-900 border-white/[0.08] text-white"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 font-medium">Priority</label>
              <div className="flex gap-2 mt-1">
                <Button
                  type="button"
                  size="sm"
                  variant={announcePriority === "normal" ? "default" : "outline"}
                  onClick={() => setAnnouncePriority("normal")}
                  className={cn("h-7 text-xs", announcePriority === "normal" ? "bg-indigo-600 text-white" : "border-white/[0.1]")}
                >
                  Normal
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={announcePriority === "urgent" ? "default" : "outline"}
                  onClick={() => setAnnouncePriority("urgent")}
                  className={cn("h-7 text-xs", announcePriority === "urgent" ? "bg-rose-600 text-white" : "border-white/[0.1]")}
                >
                  Urgent
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateAnnounceOpen(false)}
              className="text-xs border-white/[0.1]"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateAnnouncement}
              disabled={!announceTitle.trim() || !announceContent.trim()}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Broadcast
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
