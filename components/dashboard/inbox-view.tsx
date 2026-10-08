"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Inbox,
  Mail,
  MailOpen,
  Star,
  Trash2,
  CheckCheck,
  Search,
  Plus,
  Send,
  AtSign,
  ListTodo,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Sparkles,
  ArrowLeft,
  Filter,
  CheckCircle2,
  Clock,
  User,
  MessageSquare,
  RefreshCw,
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
  useInboxMessages,
  useUpdateInboxMessage,
  useSendInboxMessage,
  useDeleteInboxMessage,
  InboxItem,
} from "@/lib/hooks/use-inbox";
import { useTeamMembers, TeamMember } from "@/lib/hooks/use-team-data";

interface InboxViewProps {
  teamId: string;
}

export function InboxView({ teamId }: InboxViewProps) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  // Queries & Mutations
  const { data: messages = [], isLoading, refetch } = useInboxMessages(
    selectedCategory,
    searchQuery
  );
  const updateMessageMutation = useUpdateInboxMessage();
  const sendMessageMutation = useSendInboxMessage();
  const deleteMessageMutation = useDeleteInboxMessage();
  const { data: teamMembers = [] } = useTeamMembers(teamId);

  // Quick reply state
  const [replyText, setReplyText] = useState("");

  // Compose Modal state
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeRecipient, setComposeRecipient] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeContent, setComposeContent] = useState("");
  const [composeCategory, setComposeCategory] = useState("primary");

  // Select first message automatically if none selected
  const activeMessage = useMemo(() => {
    if (!messages.length) return null;
    if (selectedMessageId) {
      return messages.find((m) => m.id === selectedMessageId) || messages[0];
    }
    return messages[0];
  }, [messages, selectedMessageId]);

  const handleSelectMessage = (msg: InboxItem) => {
    setSelectedMessageId(msg.id);
    if (!msg.read) {
      updateMessageMutation.mutate({ id: msg.id, updates: { read: true } });
    }
  };

  const handleToggleStar = (e: React.MouseEvent, msg: InboxItem) => {
    e.stopPropagation();
    updateMessageMutation.mutate({
      id: msg.id,
      updates: { starred: !msg.starred },
    });
  };

  const handleMarkAllRead = () => {
    const unread = messages.filter((m) => !m.read);
    unread.forEach((m) => {
      updateMessageMutation.mutate({ id: m.id, updates: { read: true } });
    });
    toast.success("All messages marked as read");
  };

  const handleDelete = (id: string) => {
    deleteMessageMutation.mutate(id);
    if (selectedMessageId === id) {
      setSelectedMessageId(null);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeMessage) return;

    if (activeMessage.senderId) {
      await sendMessageMutation.mutateAsync({
        recipientId: activeMessage.senderId,
        subject: `Re: ${activeMessage.subject}`,
        content: replyText.trim(),
        category: "primary",
        teamId,
      });
    } else {
      toast.info("Note added to thread");
    }

    setReplyText("");
  };

  const handleComposeSubmit = async () => {
    if (!composeRecipient || !composeSubject.trim() || !composeContent.trim()) {
      toast.error("Please fill all compose fields");
      return;
    }

    await sendMessageMutation.mutateAsync({
      recipientId: composeRecipient,
      subject: composeSubject.trim(),
      content: composeContent.trim(),
      category: composeCategory,
      teamId,
    });

    setComposeOpen(false);
    setComposeRecipient("");
    setComposeSubject("");
    setComposeContent("");
  };

  const unreadCount = messages.filter((m) => !m.read).length;

  return (
    <div className="flex flex-col h-full w-full bg-[#0e0f11] text-neutral-100 overflow-hidden">
      {/* Top Action Bar */}
      <div className="h-14 border-b border-white/[0.08] px-6 flex items-center justify-between bg-[#121316] shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Mail className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-white">Personal Inbox & Alerts</h1>
              {unreadCount > 0 && (
                <Badge className="bg-indigo-600 text-white text-[10px] px-1.5 py-0 h-4 font-mono">
                  {unreadCount} unread
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-neutral-400">
              Personal mail, mentions, task updates and direct alerts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => refetch()}
            className="h-8 w-8 p-0 text-neutral-400 hover:text-white"
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>

          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleMarkAllRead}
              className="h-8 text-xs border-white/[0.1] hover:bg-white/[0.05] text-neutral-300 gap-1.5"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Mark all as read</span>
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => setComposeOpen(true)}
            className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Compose</span>
          </Button>
        </div>
      </div>

      {/* Main Mailbox Two-Pane Interface */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left List Pane */}
        <div className="w-full md:w-[380px] lg:w-[420px] shrink-0 border-r border-white/[0.08] flex flex-col bg-[#0c0d0f]">
          {/* Search & Category Filter Pills */}
          <div className="p-3 border-b border-white/[0.08] space-y-2.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-500" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages, alerts, senders..."
                className="h-8 pl-8 text-xs bg-neutral-900/80 border-white/[0.08] text-neutral-100 placeholder:text-neutral-500"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              {[
                { id: "all", label: "All" },
                { id: "unread", label: "Unread" },
                { id: "mention", label: "@Mentions" },
                { id: "task", label: "Tasks" },
                { id: "alert", label: "Alerts" },
                { id: "starred", label: "Starred" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors",
                    selectedCategory === cat.id
                      ? "bg-white/[0.1] text-white"
                      : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Messages List */}
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-neutral-500">
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div className="p-12 text-center">
                <Mail className="h-8 w-8 text-neutral-600 mx-auto mb-2" />
                <p className="text-xs text-neutral-400 font-medium">No messages in this folder</p>
                <p className="text-[11px] text-neutral-500 mt-1">
                  You're all caught up with your communications!
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {messages.map((msg) => {
                  const isSelected = activeMessage?.id === msg.id;
                  return (
                    <div
                      key={msg.id}
                      onClick={() => handleSelectMessage(msg)}
                      className={cn(
                        "p-3.5 transition-colors cursor-pointer flex gap-3 relative",
                        isSelected
                          ? "bg-indigo-600/15 border-l-2 border-indigo-500"
                          : "hover:bg-white/[0.02]",
                        !msg.read && !isSelected && "bg-white/[0.02]"
                      )}
                    >
                      {/* Unread indicator dot */}
                      {!msg.read && (
                        <span className="absolute top-4 left-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                      )}

                      <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                        <AvatarFallback className="bg-neutral-800 text-neutral-300 text-xs">
                          {msg.senderName
                            ? msg.senderName.slice(0, 2).toUpperCase()
                            : "SYS"}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={cn(
                              "text-xs truncate",
                              !msg.read ? "font-semibold text-white" : "font-medium text-neutral-300"
                            )}
                          >
                            {msg.senderName || "System Notification"}
                          </span>
                          <span className="text-[10px] text-neutral-500 shrink-0">
                            {new Date(msg.createdAt).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>

                        <p
                          className={cn(
                            "text-xs line-clamp-1",
                            !msg.read ? "text-neutral-100 font-medium" : "text-neutral-400"
                          )}
                        >
                          {msg.subject}
                        </p>

                        <p className="text-[11px] text-neutral-500 line-clamp-1">
                          {msg.snippet || msg.content}
                        </p>

                        <div className="flex items-center justify-between pt-1">
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 border-white/[0.08] text-neutral-400"
                          >
                            {msg.category}
                          </Badge>

                          <button
                            onClick={(e) => handleToggleStar(e, msg)}
                            className="text-neutral-500 hover:text-amber-400 transition-colors"
                          >
                            <Star
                              className={cn(
                                "h-3.5 w-3.5",
                                msg.starred && "fill-amber-400 text-amber-400"
                              )}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right Message Reader Pane (Gmail / WhatsApp view) */}
        <div className="hidden md:flex flex-1 flex-col bg-[#0e0f11] overflow-hidden">
          {activeMessage ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Header toolbar */}
              <div className="h-12 border-b border-white/[0.08] px-6 flex items-center justify-between bg-[#121316] shrink-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] border-white/[0.1] text-indigo-300">
                    {activeMessage.category.toUpperCase()}
                  </Badge>
                  {activeMessage.entityUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(activeMessage.entityUrl!)}
                      className="h-7 text-xs text-neutral-400 hover:text-white gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>Open Related Object</span>
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleToggleStar(e, activeMessage)}
                    className="h-8 w-8 p-0 text-neutral-400 hover:text-amber-400"
                  >
                    <Star
                      className={cn(
                        "h-4 w-4",
                        activeMessage.starred && "fill-amber-400 text-amber-400"
                      )}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(activeMessage.id)}
                    className="h-8 w-8 p-0 text-neutral-400 hover:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Message Body Pane */}
              <ScrollArea className="flex-1 p-6">
                <div className="max-w-3xl space-y-6">
                  {/* Subject */}
                  <h2 className="text-lg font-semibold text-white leading-snug">
                    {activeMessage.subject}
                  </h2>

                  {/* Sender details */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/40 border border-white/[0.06]">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-indigo-600/30 text-indigo-300 text-xs">
                          {activeMessage.senderName
                            ? activeMessage.senderName.slice(0, 2).toUpperCase()
                            : "SY"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-xs font-semibold text-white">
                          {activeMessage.senderName || "System"}
                        </p>
                        <p className="text-[11px] text-neutral-400">
                          {activeMessage.senderEmail || "notification@owner-os.internal"}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-neutral-500">
                      {new Date(activeMessage.createdAt).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>

                  {/* Message Content */}
                  <div className="text-xs text-neutral-200 leading-relaxed whitespace-pre-wrap font-sans bg-white/[0.01] p-4 rounded-xl border border-white/[0.04]">
                    {activeMessage.content}
                  </div>

                  {/* If linked to a task or chat, provide direct call to action */}
                  {activeMessage.entityUrl && (
                    <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/30 to-purple-950/20 border border-indigo-500/20 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium text-indigo-200">
                          Interactive Link Attached
                        </p>
                        <p className="text-[11px] text-neutral-400">
                          This alert is tied to a live workspace resource.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => router.push(activeMessage.entityUrl!)}
                        className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5"
                      >
                        <span>View Resource</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Bottom Quick Reply Pane */}
              <div className="p-4 border-t border-white/[0.08] bg-[#121316]">
                <form onSubmit={handleSendReply} className="flex gap-2">
                  <Input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Reply to ${activeMessage.senderName || "update"}...`}
                    className="h-9 text-xs bg-neutral-900 border-white/[0.08] text-white"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!replyText.trim()}
                    className="h-9 px-4 text-xs bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Send</span>
                  </Button>
                </form>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-neutral-500 text-xs">
              Select a message to view details
            </div>
          )}
        </div>
      </div>

      {/* Compose Message Dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-md bg-[#121316] border-white/[0.08] text-white">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Compose Message / Alert</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs text-neutral-400 font-medium">To (Team Member)</label>
              <select
                value={composeRecipient}
                onChange={(e) => setComposeRecipient(e.target.value)}
                className="w-full h-9 mt-1 px-3 rounded-md text-xs bg-neutral-900 border border-white/[0.08] text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Select recipient...</option>
                {teamMembers?.map((m: TeamMember) => (
                  <option key={m.id} value={m.userId}>
                    {m.userName} ({m.userEmail})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-neutral-400 font-medium">Subject</label>
              <Input
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="Message subject"
                className="h-9 mt-1 text-xs bg-neutral-900 border-white/[0.08] text-white"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-400 font-medium">Category</label>
              <div className="flex gap-2 mt-1">
                {["primary", "task", "alert"].map((c) => (
                  <Button
                    key={c}
                    type="button"
                    size="sm"
                    variant={composeCategory === c ? "default" : "outline"}
                    onClick={() => setComposeCategory(c)}
                    className={cn(
                      "h-7 text-xs capitalize",
                      composeCategory === c ? "bg-indigo-600 text-white" : "border-white/[0.1]"
                    )}
                  >
                    {c}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-neutral-400 font-medium">Message Body</label>
              <textarea
                value={composeContent}
                onChange={(e) => setComposeContent(e.target.value)}
                placeholder="Write your message here..."
                rows={4}
                className="w-full mt-1 p-2.5 rounded-md text-xs bg-neutral-900 border border-white/[0.08] text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setComposeOpen(false)}
              className="text-xs border-white/[0.1]"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleComposeSubmit}
              disabled={!composeRecipient || !composeSubject.trim() || !composeContent.trim()}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
