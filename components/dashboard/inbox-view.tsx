"use client";

import { useState, useMemo } from "react";
import {
  Inbox,
  CheckCheck,
  Mail,
  MailOpen,
  ArrowLeft,
  ExternalLink,
  MessageSquare,
  AtSign,
  UserCheck,
  RefreshCw,
  Clock,
  AlertTriangle,
  Calendar,
  Send,
  CheckCircle2,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  type: "update" | "mention" | "assign" | "comment";
  titlePrefix?: string;
  titleAction?: string;
  titleTarget?: string;
  snippet: string;
  projectName: string;
  projectColor: string;
  timeAgo: string;
  read: boolean;
  avatarText?: string;
  avatarColor: string;
  avatarIcon?: "clock" | "alert";
  task: {
    id: string;
    key: string;
    title: string;
    status: "Done" | "In Progress" | "Review" | "To Do" | "Backlog";
    assignee: {
      name: string;
      initials: string;
      color: string;
    };
    priority: "Urgent" | "High" | "Medium" | "Low";
    dueDate: string;
    description: string;
    comments: {
      id: string;
      author: string;
      initials: string;
      color: string;
      timeAgo: string;
      text: string;
    }[];
  };
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n10",
    type: "update",
    titlePrefix: "Campaign brief",
    titleAction: "is due today",
    snippet: "Triage beta tester feedback",
    projectName: "Marketing Campaign",
    projectColor: "#C54B78",
    timeAgo: "1h ago",
    read: false,
    avatarColor: "#D97706",
    avatarIcon: "clock",
    task: {
      id: "t28",
      key: "MKT-103",
      title: "Campaign brief",
      status: "Done",
      assignee: {
        name: "Priya Patel",
        initials: "PP",
        color: "#C48A1E",
      },
      priority: "Medium",
      dueDate: "Sep 30",
      description: "Triage beta tester feedback and outline target deliverables for the upcoming Q4 awareness push.",
      comments: [
        {
          id: "c10-1",
          author: "Priya Patel",
          initials: "PP",
          color: "#C48A1E",
          timeAgo: "2h ago",
          text: "Beta feedback triage is mostly done. Need final signoff from @Alex Morgan before publishing the brief.",
        },
      ],
    },
  },
  {
    id: "n5",
    type: "update",
    titlePrefix: "Sarah Chen",
    titleAction: "moved to Review",
    titleTarget: "Create homepage wireframes",
    snippet: "To Do → Review",
    projectName: "Website Redesign",
    projectColor: "#5A67D8",
    timeAgo: "2h ago",
    read: true,
    avatarText: "SC",
    avatarColor: "#C54B78",
    task: {
      id: "t3",
      key: "WEB-103",
      title: "Create homepage wireframes",
      status: "Review",
      assignee: {
        name: "Sarah Chen",
        initials: "SC",
        color: "#C54B78",
      },
      priority: "High",
      dueDate: "Tomorrow",
      description: "Low-fidelity wireframes for the new homepage covering desktop, tablet, and mobile breakpoints.",
      comments: [
        {
          id: "c5-1",
          author: "Sarah Chen",
          initials: "SC",
          color: "#C54B78",
          timeAgo: "3h ago",
          text: "Ready for design review. Please check the hero layout and spacing on tablet screens.",
        },
      ],
    },
  },
  {
    id: "n3",
    type: "comment",
    titlePrefix: "Emma Wilson",
    titleAction: "commented on",
    titleTarget: "Design mobile onboarding",
    snippet: "Permission prompts need legal review — drafting now.",
    projectName: "Website Redesign",
    projectColor: "#5A67D8",
    timeAgo: "2h ago",
    read: false,
    avatarText: "EW",
    avatarColor: "#23918A",
    task: {
      id: "t9",
      key: "WEB-109",
      title: "Design mobile onboarding",
      status: "In Progress",
      assignee: {
        name: "Emma Wilson",
        initials: "EW",
        color: "#23918A",
      },
      priority: "Urgent",
      dueDate: "Yesterday",
      description: "Complete flow for welcome screens, permission modals, and introductory walkthrough.",
      comments: [
        {
          id: "c3-1",
          author: "Emma Wilson",
          initials: "EW",
          color: "#23918A",
          timeAgo: "2h ago",
          text: "Permission prompts need legal review — drafting now. Will ping as soon as copy is locked.",
        },
      ],
    },
  },
  {
    id: "n9",
    type: "update",
    titlePrefix: "John Carter",
    titleAction: "completed",
    titleTarget: "Fix broken anchor links on pricing",
    snippet: "Fix broken anchor links on pricing",
    projectName: "Website Redesign",
    projectColor: "#5A67D8",
    timeAgo: "2h ago",
    read: true,
    avatarText: "JC",
    avatarColor: "#3B82C4",
    task: {
      id: "t18",
      key: "WEB-118",
      title: "Fix broken anchor links on pricing",
      status: "Done",
      assignee: {
        name: "John Carter",
        initials: "JC",
        color: "#3B82C4",
      },
      priority: "Medium",
      dueDate: "Sep 28",
      description: "Anchor hashes #faq and #tiers were jumping to wrong DOM offsets on mobile viewports.",
      comments: [
        {
          id: "c9-1",
          author: "John Carter",
          initials: "JC",
          color: "#3B82C4",
          timeAgo: "2h ago",
          text: "Fixed and deployed to staging. Verified on Safari iOS and Chrome Android.",
        },
      ],
    },
  },
  {
    id: "n4",
    type: "mention",
    titlePrefix: "Lena Fischer",
    titleAction: "mentioned you in",
    titleTarget: "Launch readiness checklist",
    snippet: "Support training moved to Monday. @Alex Morgan please confirm the status page copy.",
    projectName: "Product Launch",
    projectColor: "#C48A1E",
    timeAgo: "4h ago",
    read: false,
    avatarText: "LF",
    avatarColor: "#3D8E5F",
    task: {
      id: "t35",
      key: "LCH-103",
      title: "Launch readiness checklist",
      status: "In Progress",
      assignee: {
        name: "Alex Morgan",
        initials: "AM",
        color: "#5A67D8",
      },
      priority: "Urgent",
      dueDate: "In 3 days",
      description: "Coordination checklist for public release: docs, support training, status page, and rollout plan.",
      comments: [
        {
          id: "c4-1",
          author: "Lena Fischer",
          initials: "LF",
          color: "#3D8E5F",
          timeAgo: "4h ago",
          text: "Support training moved to Monday. @Alex Morgan please confirm the status page copy.",
        },
      ],
    },
  },
  {
    id: "n1",
    type: "mention",
    titlePrefix: "Sarah Chen",
    titleAction: "mentioned you in",
    titleTarget: "Create homepage wireframes",
    snippet: "Updated in v3 — @Alex Morgan can you review before Thursday?",
    projectName: "Website Redesign",
    projectColor: "#5A67D8",
    timeAgo: "4h ago",
    read: false,
    avatarText: "SC",
    avatarColor: "#C54B78",
    task: {
      id: "t1",
      key: "WEB-103",
      title: "Create homepage wireframes",
      status: "Review",
      assignee: {
        name: "Sarah Chen",
        initials: "SC",
        color: "#C54B78",
      },
      priority: "High",
      dueDate: "Tomorrow",
      description: "Figma wireframe explorations for the new homepage and global header.",
      comments: [
        {
          id: "c1-1",
          author: "Sarah Chen",
          initials: "SC",
          color: "#C54B78",
          timeAgo: "4h ago",
          text: "Updated in v3 — @Alex Morgan can you review before Thursday?",
        },
      ],
    },
  },
  {
    id: "n2",
    type: "assign",
    titlePrefix: "John Carter",
    titleAction: "assigned you",
    titleTarget: "Campaign brief",
    snippet: "Due today · Medium priority",
    projectName: "Marketing Campaign",
    projectColor: "#C54B78",
    timeAgo: "6h ago",
    read: false,
    avatarText: "JC",
    avatarColor: "#3B82C4",
    task: {
      id: "t28",
      key: "MKT-103",
      title: "Campaign brief",
      status: "Done",
      assignee: {
        name: "Alex Morgan",
        initials: "AM",
        color: "#5A67D8",
      },
      priority: "Medium",
      dueDate: "Today",
      description: "Finalize messaging architecture and distribution schedule across channels.",
      comments: [],
    },
  },
  {
    id: "n6",
    type: "update",
    titlePrefix: "Product Launch is at risk",
    snippet: "3 tasks due this week are not started",
    projectName: "Product Launch",
    projectColor: "#C48A1E",
    timeAgo: "11h ago",
    read: false,
    avatarColor: "#EF4444",
    avatarIcon: "alert",
    task: {
      id: "t4",
      key: "LCH-100",
      title: "Product Launch Coordination",
      status: "In Progress",
      assignee: {
        name: "Alex Morgan",
        initials: "AM",
        color: "#5A67D8",
      },
      priority: "Urgent",
      dueDate: "Oct 2",
      description: "Automated alert: 3 critical dependencies due before Friday have not been marked in progress.",
      comments: [
        {
          id: "c6-1",
          author: "System Bot",
          initials: "SY",
          color: "#EF4444",
          timeAgo: "11h ago",
          text: "Automated alert triggered: schedule variance detected on Launch Readiness Checklist.",
        },
      ],
    },
  },
  {
    id: "n7",
    type: "comment",
    titlePrefix: "Sarah Chen",
    titleAction: "commented on",
    titleTarget: "Budget approval",
    snippet: "Finance needs the channel split before approving.",
    projectName: "Marketing Campaign",
    projectColor: "#C54B78",
    timeAgo: "1d ago",
    read: true,
    avatarText: "SC",
    avatarColor: "#C54B78",
    task: {
      id: "t34",
      key: "MKT-108",
      title: "Budget approval",
      status: "Review",
      assignee: {
        name: "Sarah Chen",
        initials: "SC",
        color: "#C54B78",
      },
      priority: "Urgent",
      dueDate: "Sep 27",
      description: "Signoff on Q4 paid media allocations and creative production budget.",
      comments: [
        {
          id: "c7-1",
          author: "Sarah Chen",
          initials: "SC",
          color: "#C54B78",
          timeAgo: "1d ago",
          text: "Finance needs the channel split before approving.",
        },
      ],
    },
  },
  {
    id: "n8",
    type: "assign",
    titlePrefix: "Sarah Chen",
    titleAction: "assigned you",
    titleTarget: "Prepare design system tokens",
    snippet: "Due in 6 days",
    projectName: "Website Redesign",
    projectColor: "#5A67D8",
    timeAgo: "2d ago",
    read: true,
    avatarText: "SC",
    avatarColor: "#C54B78",
    task: {
      id: "t6",
      key: "WEB-106",
      title: "Prepare design system tokens",
      status: "To Do",
      assignee: {
        name: "Alex Morgan",
        initials: "AM",
        color: "#5A67D8",
      },
      priority: "Medium",
      dueDate: "Oct 6",
      description: "Export tokens for spacing, typography scale, border radiuses, and semantic colors into JSON format.",
      comments: [],
    },
  },
];

interface InboxViewProps {
  teamId: string;
}

export function InboxView({ teamId }: InboxViewProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [activeCategory, setActiveCategory] = useState<"all" | "mention" | "assign" | "comment" | "update">("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("n10");
  const [replyText, setReplyText] = useState("");

  // Counts calculation
  const counts = useMemo(() => {
    return {
      all: notifications.filter((n) => !n.read).length,
      mention: notifications.filter((n) => n.type === "mention" && !n.read).length,
      assign: notifications.filter((n) => n.type === "assign" && !n.read).length,
      comment: notifications.filter((n) => n.type === "comment" && !n.read).length,
      update: notifications.filter((n) => n.type === "update" && !n.read).length,
    };
  }, [notifications]);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (activeCategory !== "all" && item.type !== activeCategory) {
        return false;
      }
      if (unreadOnly && item.read) {
        return false;
      }
      return true;
    });
  }, [notifications, activeCategory, unreadOnly]);

  const selectedNotification = useMemo(() => {
    return notifications.find((n) => n.id === selectedId) || notifications[0] || null;
  }, [notifications, selectedId]);

  const handleToggleRead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications((prev) =>
      prev.map((n) => {
        if (n.id === id) {
          const nextRead = !n.read;
          toast.success(nextRead ? "Marked as read" : "Marked as unread");
          return { ...n, read: nextRead };
        }
        return n;
      })
    );
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success("All notifications marked as read");
  };

  const handleSendReply = () => {
    if (!replyText.trim() || !selectedNotification) return;

    const newComment = {
      id: `c-new-${Date.now()}`,
      author: "Alex Morgan",
      initials: "AM",
      color: "#5A67D8",
      timeAgo: "Just now",
      text: replyText.trim(),
    };

    setNotifications((prev) =>
      prev.map((n) => {
        if (n.id === selectedNotification.id) {
          return {
            ...n,
            task: {
              ...n.task,
              comments: [...n.task.comments, newComment],
            },
          };
        }
        return n;
      })
    );

    setReplyText("");
    toast.success("Reply posted");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSendReply();
    }
  };

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col h-full overflow-hidden bg-[#0e0f11] text-[#f4f4f5]">
      <div className="grid grid-cols-1 md:grid-cols-[380px_1fr] lg:grid-cols-[400px_1fr] flex-1 min-h-0 h-full divide-x divide-white/[0.08] bg-[#0e0f11]">
        {/* Left column: Notifications list */}
        <div className="flex flex-col min-h-0 h-full bg-[#0e0f11]">
          {/* Header */}
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
              <Inbox className="w-5 h-5 text-neutral-400" />
              Inbox
            </h1>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(e) => setUnreadOnly(e.target.checked)}
                  className="rounded border-white/20 bg-neutral-900 text-primary focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5 accent-[#5A67D8]"
                />
                Unread
              </label>
              <button
                type="button"
                onClick={handleMarkAllRead}
                title="Mark all as read"
                className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="px-2 pb-2 pt-1 border-b border-white/[0.07] flex items-center gap-1 overflow-x-auto no-scrollbar">
            {(
              [
                { id: "all", label: "All", count: counts.all },
                { id: "mention", label: "Mentions", count: counts.mention },
                { id: "assign", label: "Assignments", count: counts.assign },
                { id: "comment", label: "Comments", count: counts.comment },
                { id: "update", label: "Updates", count: counts.update },
              ] as const
            ).map((tab) => {
              const isActive = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id)}
                  className={cn(
                    "px-2.5 py-1 text-xs rounded-md font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap",
                    isActive
                      ? "bg-white/[0.1] text-white shadow-sm"
                      : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]"
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      "text-[10px] px-1 py-0.2 rounded-full",
                      isActive
                        ? "bg-white/20 text-white font-semibold"
                        : "text-neutral-400 bg-white/[0.04]"
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Notifications Scroll List */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center text-neutral-400">
                <CheckCircle2 className="w-8 h-8 mb-2 text-neutral-400" />
                <p className="text-sm font-medium text-neutral-300">All caught up!</p>
                <p className="text-xs text-neutral-400 mt-1">No notifications matching this filter.</p>
              </div>
            ) : (
              filteredNotifications.map((item) => {
                const isSelected = selectedId === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedId(item.id);
                      if (!item.read) {
                        setNotifications((prev) =>
                          prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
                        );
                      }
                    }}
                    className={cn(
                      "group relative flex items-start gap-2.5 px-4 py-3 cursor-pointer transition-colors text-left",
                      isSelected
                        ? "bg-[#181a1d] text-white"
                        : item.read
                        ? "hover:bg-white/[0.03] text-neutral-300"
                        : "bg-white/[0.02] hover:bg-white/[0.04] text-neutral-200"
                    )}
                  >
                    {/* Unread indicator blue dot */}
                    {!item.read && (
                      <span
                        className="absolute left-1.5 top-5 w-1.5 h-1.5 rounded-full bg-[#5A67D8]"
                        title="Unread"
                      />
                    )}

                    {/* Avatar / Icon */}
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 shadow-sm"
                      style={{
                        backgroundColor: item.avatarColor,
                        color: "#ffffff",
                      }}
                    >
                      {item.avatarIcon === "clock" ? (
                        <Clock className="w-3.5 h-3.5" />
                      ) : item.avatarIcon === "alert" ? (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      ) : (
                        item.avatarText
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-5">
                      <div className="text-[13px] leading-snug">
                        {item.titlePrefix && (
                          <span className="font-semibold text-white mr-1">
                            {item.titlePrefix}
                          </span>
                        )}
                        {item.titleAction && (
                          <span className="text-neutral-400 mr-1">{item.titleAction}</span>
                        )}
                        {item.titleTarget && (
                          <span className="font-medium text-neutral-200">
                            {item.titleTarget}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-neutral-400 truncate mt-0.5">
                        {item.snippet}
                      </div>

                      {/* Footer tags */}
                      <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-neutral-400">
                        {item.type === "update" && <RefreshCw className="w-3 h-3 shrink-0" />}
                        {item.type === "comment" && <MessageSquare className="w-3 h-3 shrink-0" />}
                        {item.type === "mention" && <AtSign className="w-3 h-3 shrink-0" />}
                        {item.type === "assign" && <UserCheck className="w-3 h-3 shrink-0" />}
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.projectColor }}
                        />
                        <span className="truncate">{item.projectName}</span>
                        <span>·</span>
                        <span className="shrink-0">{item.timeAgo}</span>
                      </div>
                    </div>

                    {/* Read / Unread toggle icon on hover */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleRead(item.id, e)}
                      title={item.read ? "Mark as unread" : "Mark as read"}
                      className="absolute right-2.5 top-3 p-1 rounded hover:bg-white/[0.08] text-neutral-400 hover:text-white transition-opacity opacity-0 group-hover:opacity-100"
                    >
                      {item.read ? (
                        <Mail className="w-3.5 h-3.5" />
                      ) : (
                        <MailOpen className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right column: Notification detail & conversation */}
        {selectedNotification ? (
          <div className="flex flex-col min-h-0 h-full bg-[#0e0f11] overflow-y-auto">
            {/* Top Bar */}
            <div className="h-11 px-4 border-b border-white/[0.08] flex items-center gap-2 shrink-0 bg-[#0e0f11]">
              <button
                type="button"
                onClick={() => setSelectedId("")}
                className="md:hidden p-1 rounded hover:bg-white/[0.06] text-neutral-400 mr-1"
                title="Back to list"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: selectedNotification.projectColor }}
              />
              <span className="text-xs text-neutral-400 font-medium truncate">
                {selectedNotification.projectName}
              </span>
              <span className="text-[11px] font-mono text-neutral-400 bg-white/[0.05] px-1.5 py-0.5 rounded">
                {selectedNotification.task.key}
              </span>

              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 border-white/10 hover:bg-white/[0.06] bg-transparent text-neutral-300"
                  onClick={() => toast.info(`Viewing task ${selectedNotification.task.key}`)}
                >
                  <ExternalLink className="w-3 h-3" />
                  Open task
                </Button>
              </div>
            </div>

            {/* Task Detail Body */}
            <div className="p-6 max-w-2xl w-full">
              {/* Task Title */}
              <h2 className="text-xl font-semibold tracking-tight text-white mb-3">
                {selectedNotification.task.title}
              </h2>

              {/* Status / Assignee / Priority / Date pills */}
              <div className="flex flex-wrap items-center gap-2 mb-6 text-xs">
                {/* Status */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-neutral-300">
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full",
                      selectedNotification.task.status === "Done"
                        ? "bg-emerald-500"
                        : selectedNotification.task.status === "Review"
                        ? "bg-purple-500"
                        : "bg-blue-500"
                    )}
                  />
                  <span>{selectedNotification.task.status}</span>
                </div>

                {/* Assignee */}
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-neutral-300">
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                    style={{ backgroundColor: selectedNotification.task.assignee.color }}
                  >
                    {selectedNotification.task.assignee.initials}
                  </span>
                  <span>{selectedNotification.task.assignee.name}</span>
                </div>

                {/* Priority */}
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-neutral-300">
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase",
                      selectedNotification.task.priority === "Urgent"
                        ? "text-red-400"
                        : selectedNotification.task.priority === "High"
                        ? "text-amber-400"
                        : "text-neutral-400"
                    )}
                  >
                    ●
                  </span>
                  <span>{selectedNotification.task.priority}</span>
                </div>

                {/* Due Date */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-neutral-400">
                  <Calendar className="w-3 h-3 text-neutral-400" />
                  <span>{selectedNotification.task.dueDate}</span>
                </div>
              </div>

              {/* Description */}
              <div className="mb-6">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block mb-1">
                  Description
                </span>
                <p className="text-sm text-neutral-300 leading-relaxed bg-white/[0.02] p-3 rounded-lg border border-white/[0.04]">
                  {selectedNotification.task.description}
                </p>
              </div>

              {/* Conversation Section */}
              <div className="mb-6">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block mb-3">
                  Conversation
                </span>

                {selectedNotification.task.comments.length === 0 ? (
                  <p className="text-xs text-neutral-400 italic mb-4">No comments yet.</p>
                ) : (
                  <div className="space-y-3 mb-4">
                    {selectedNotification.task.comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="flex items-start gap-2.5 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]"
                      >
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5"
                          style={{ backgroundColor: comment.color }}
                        >
                          {comment.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-neutral-200">
                              {comment.author}
                            </span>
                            <span className="text-[11px] text-neutral-400">
                              {comment.timeAgo}
                            </span>
                          </div>
                          <div className="text-xs text-neutral-300 leading-relaxed">
                            {comment.text.split(/(@\w+\s\w+|@\w+)/g).map((part, idx) => {
                              if (part.startsWith("@")) {
                                return (
                                  <span
                                    key={idx}
                                    className="text-primary font-semibold bg-primary/10 px-1 py-0.2 rounded"
                                  >
                                    {part}
                                  </span>
                                );
                              }
                              return part;
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply Composer */}
                <div className="p-3 rounded-lg bg-[#141518] border border-white/[0.08] focus-within:border-white/20 transition-colors">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Reply… use @ to mention"
                    rows={3}
                    className="w-full bg-transparent text-xs text-white placeholder-neutral-400 focus:outline-none resize-none leading-relaxed"
                  />
                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] mt-2">
                    <span className="text-[11px] text-neutral-400">
                      Ctrl+Enter to send
                    </span>
                    <Button
                      size="sm"
                      onClick={handleSendReply}
                      disabled={!replyText.trim()}
                      className="h-7 px-3 text-xs gap-1.5 bg-[#5A67D8] hover:bg-[#4c57b8] text-white disabled:opacity-50"
                    >
                      <Send className="w-3 h-3" />
                      Reply
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden md:flex flex-col items-center justify-center p-8 text-neutral-400 bg-[#0e0f11] h-full">
            <Inbox className="w-10 h-10 mb-2 text-neutral-400" />
            <p className="text-sm">Select an item from the inbox to preview details</p>
          </div>
        )}
      </div>
    </div>
  );
}
