"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  useDeleteEvent,
  useSaveMeetingNotes,
  useConvertActionItem,
  useSummarizeMeeting,
  CalendarEventItem,
} from "@/lib/hooks/use-calendar";
import { toast } from "sonner";
import {
  Video,
  Clock,
  Calendar as CalendarIcon,
  Users,
  FolderKanban,
  Trash2,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Plus,
  Mail,
  Copy,
  Check,
} from "lucide-react";

interface EventDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEventItem | null;
  teamId: string;
}

export function EventDetailsDialog({
  open,
  onOpenChange,
  event,
  teamId,
}: EventDetailsDialogProps) {
  const deleteEventMutation = useDeleteEvent(teamId);
  const saveNotesMutation = useSaveMeetingNotes(teamId);
  const convertActionItemMutation = useConvertActionItem(teamId);
  const summarizeMutation = useSummarizeMeeting(teamId);

  const [activeTab, setActiveTab] = useState<"overview" | "notes" | "ai">("overview");

  // Meeting notes state
  const [notesContent, setNotesContent] = useState("");
  const [decisions, setDecisions] = useState("");
  const [actionItems, setActionItems] = useState<
    Array<{ id?: string; title: string; assigneeName?: string; dueDate?: string; status?: string; convertedIssueId?: string | null }>
  >([]);
  const [newActionItemTitle, setNewActionItemTitle] = useState("");
  const [newActionAssignee, setNewActionAssignee] = useState("");

  // AI State
  const [transcriptInput, setTranscriptInput] = useState("");
  const [summary, setSummary] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [copiedEmail, setCopiedEmail] = useState(false);

  useEffect(() => {
    if (event?.meetingNote) {
      setNotesContent(event.meetingNote.content || "");
      setDecisions(event.meetingNote.decisions || "");
      setSummary(event.meetingNote.summary || "");
      setEmailDraft(event.meetingNote.followUpEmailDraft || "");
      setTranscriptInput(event.meetingNote.rawTranscript || "");
      setActionItems(
        (event.meetingNote.actionItems || []).map((ai) => ({
          id: ai.id,
          title: ai.title,
          assigneeName: ai.assigneeName || undefined,
          dueDate: ai.dueDate ? String(ai.dueDate).split("T")[0] : undefined,
          status: ai.status,
          convertedIssueId: ai.convertedIssueId,
        }))
      );
    } else {
      setNotesContent(event?.description || "");
      setDecisions("");
      setSummary("");
      setEmailDraft("");
      setTranscriptInput(event?.description || "");
      setActionItems([]);
    }
  }, [event]);

  if (!event) return null;

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to cancel and delete this event?")) return;
    try {
      await deleteEventMutation.mutateAsync(event.id);
      toast.success("Event deleted");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete event");
    }
  };

  const handleSaveNotes = async () => {
    try {
      await saveNotesMutation.mutateAsync({
        eventId: event.id,
        data: {
          content: notesContent,
          decisions,
          summary,
          followUpEmailDraft: emailDraft,
          actionItems,
        },
      });
      toast.success("Meeting notes saved!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save notes");
    }
  };

  const handleAddActionItem = () => {
    if (!newActionItemTitle.trim()) return;
    setActionItems((prev) => [
      ...prev,
      {
        title: newActionItemTitle.trim(),
        assigneeName: newActionAssignee.trim() || undefined,
        status: "open",
      },
    ]);
    setNewActionItemTitle("");
    setNewActionAssignee("");
  };

  const handleConvertActionItem = async (actionItemId?: string) => {
    if (!actionItemId) {
      toast.info("Please save notes first to persist this action item before converting");
      return;
    }
    try {
      await convertActionItemMutation.mutateAsync({
        eventId: event.id,
        actionItemId,
        projectId: event.projectId || undefined,
      });
      toast.success("Converted action item into a project task!");
    } catch (err: any) {
      toast.error(err.message || "Failed to convert action item");
    }
  };

  const handleRunAI = async () => {
    const textToAnalyze = transcriptInput.trim() || notesContent.trim();
    if (!textToAnalyze) {
      toast.error("Please enter transcript text or meeting notes to analyze");
      return;
    }

    try {
      const apiKey = localStorage.getItem("groq_api_key") || undefined;
      const res = await summarizeMutation.mutateAsync({
        eventId: event.id,
        transcript: textToAnalyze,
        apiKey,
      });

      if (res?.intelligence) {
        setSummary(res.intelligence.summary || "");
        setDecisions(res.intelligence.decisions || "");
        setEmailDraft(res.intelligence.followUpEmailDraft || "");
        if (Array.isArray(res.intelligence.actionItems)) {
          setActionItems((prev) => [
            ...prev,
            ...res.intelligence.actionItems.map((ai: any) => ({
              title: ai.title,
              assigneeName: ai.assigneeName || undefined,
              dueDate: ai.dueDate ? String(ai.dueDate).split("T")[0] : undefined,
              status: "open",
            })),
          ]);
        }
        toast.success("AI Meeting Intelligence generated successfully!");
      }
    } catch (err: any) {
      toast.error(err.message || "AI summarization failed. Check Groq API key.");
    }
  };

  const copyEmail = () => {
    navigator.clipboard.writeText(emailDraft);
    setCopiedEmail(true);
    toast.success("Follow-up email copied to clipboard!");
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const startTimeStr = new Date(event.startTime).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const endTimeStr = new Date(event.endTime).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const dateStr = new Date(event.startTime).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-[#141518] border-neutral-800 text-neutral-100 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-[10px] uppercase font-mono tracking-wider border-indigo-500/30 text-indigo-400 bg-indigo-500/10"
              >
                {event.type.replace("_", " ")}
              </Badge>
              {event.project && (
                <Badge
                  variant="outline"
                  className="text-[10px] border-neutral-700 text-neutral-300"
                  style={{ borderColor: `${event.project.color}50`, color: event.project.color }}
                >
                  {event.project.name}
                </Badge>
              )}
            </div>
            <DialogTitle className="text-lg font-semibold text-neutral-100 mt-1">
              {event.title}
            </DialogTitle>
          </div>

          {!event.isIssue && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="text-red-400 hover:text-red-300 hover:bg-red-950/20"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Cancel Event
            </Button>
          )}
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="pt-2">
          <TabsList className="bg-neutral-900 border border-neutral-800 text-neutral-400">
            <TabsTrigger value="overview" className="data-[state=active]:bg-neutral-800 data-[state=active]:text-neutral-100 text-xs">
              Overview
            </TabsTrigger>
            <TabsTrigger value="notes" className="data-[state=active]:bg-neutral-800 data-[state=active]:text-neutral-100 text-xs">
              Meeting Notes & Tasks
            </TabsTrigger>
            <TabsTrigger value="ai" className="data-[state=active]:bg-indigo-600/30 data-[state=active]:text-indigo-300 text-xs flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              AI Meeting Intelligence
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: OVERVIEW */}
          <TabsContent value="overview" className="space-y-4 pt-3">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-neutral-900/60 border border-neutral-800/80">
              <div className="flex items-center gap-2 text-xs text-neutral-300">
                <CalendarIcon className="w-4 h-4 text-indigo-400" />
                <span>{dateStr}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-300">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>{startTimeStr} – {endTimeStr}</span>
              </div>
            </div>

            {/* Google Meet Quick Join Card */}
            {event.meetUrl && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/40 to-blue-950/30 border border-indigo-800/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
                    <Video className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-neutral-200">Google Meet Video Call</h4>
                    <p className="text-xs text-neutral-400 font-mono truncate max-w-xs">{event.meetUrl}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  asChild
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                >
                  <a href={event.meetUrl} target="_blank" rel="noopener noreferrer">
                    Join Meeting
                    <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                  </a>
                </Button>
              </div>
            )}

            {/* Attendees */}
            {event.attendees && event.attendees.length > 0 && (
              <div>
                <Label className="text-xs text-neutral-400 flex items-center gap-1.5 mb-2">
                  <Users className="w-3.5 h-3.5" />
                  Participants ({event.attendees.length})
                </Label>
                <div className="flex flex-wrap gap-2">
                  {event.attendees.map((att) => (
                    <div
                      key={att.id}
                      className="px-2.5 py-1 rounded-md bg-neutral-900 border border-neutral-800 flex items-center gap-2 text-xs text-neutral-300"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span>{att.name}</span>
                      <span className="text-[11px] text-neutral-500">({att.email})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {event.description && (
              <div>
                <Label className="text-xs text-neutral-400 mb-1">Agenda / Description</Label>
                <div className="p-3 rounded-lg bg-neutral-900/50 border border-neutral-800 text-xs text-neutral-300 whitespace-pre-wrap leading-relaxed">
                  {event.description}
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB 2: MEETING NOTES & 1-CLICK ACTION ITEMS (CAL-08) */}
          <TabsContent value="notes" className="space-y-4 pt-3">
            <div>
              <Label className="text-xs text-neutral-400">Meeting Notes & Discussion Points</Label>
              <Textarea
                value={notesContent}
                onChange={(e) => setNotesContent(e.target.value)}
                placeholder="Key points discussed during the call..."
                rows={4}
                className="mt-1 bg-neutral-900 border-neutral-800 text-neutral-100 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs text-neutral-400">Decisions Agreed Upon</Label>
              <Textarea
                value={decisions}
                onChange={(e) => setDecisions(e.target.value)}
                placeholder="Agreed scope, technical stack choice, client sign-off..."
                rows={2}
                className="mt-1 bg-neutral-900 border-neutral-800 text-neutral-100 text-xs"
              />
            </div>

            {/* Action Items List with 1-Click Convert (PRD CAL-08) */}
            <div className="pt-2">
              <Label className="text-xs text-neutral-300 font-medium flex items-center justify-between">
                <span>Action Items ({actionItems.length})</span>
                <span className="text-[11px] text-neutral-500 font-normal">Convert into tracked project tasks in 1-click</span>
              </Label>

              <div className="space-y-2 mt-2">
                {actionItems.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="p-2.5 rounded-lg bg-neutral-900/70 border border-neutral-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-neutral-200 font-medium truncate">{item.title}</p>
                      <p className="text-[11px] text-neutral-500">
                        {item.assigneeName ? `Assignee: ${item.assigneeName}` : "Unassigned"}
                        {item.dueDate ? ` • Due: ${item.dueDate}` : ""}
                      </p>
                    </div>

                    {item.status === "converted" || item.convertedIssueId ? (
                      <Badge className="bg-emerald-500/10 border-emerald-500/30 text-emerald-400 text-[10px]">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Converted Task
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleConvertActionItem(item.id)}
                        disabled={convertActionItemMutation.isPending}
                        className="h-7 text-xs bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30"
                      >
                        Create Task
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Action Item Inline */}
              <div className="flex gap-2 mt-2">
                <Input
                  value={newActionItemTitle}
                  onChange={(e) => setNewActionItemTitle(e.target.value)}
                  placeholder="New action item..."
                  className="bg-neutral-900 border-neutral-800 text-neutral-100 text-xs flex-1"
                />
                <Input
                  value={newActionAssignee}
                  onChange={(e) => setNewActionAssignee(e.target.value)}
                  placeholder="Assignee name"
                  className="bg-neutral-900 border-neutral-800 text-neutral-100 text-xs w-32"
                />
                <Button
                  size="sm"
                  type="button"
                  onClick={handleAddActionItem}
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSaveNotes}
                disabled={saveNotesMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
              >
                {saveNotesMutation.isPending ? "Saving..." : "Save Meeting Notes"}
              </Button>
            </div>
          </TabsContent>

          {/* TAB 3: AI MEETING INTELLIGENCE (CAL-09 / CAL-W2) */}
          <TabsContent value="ai" className="space-y-4 pt-3">
            <div className="p-3 rounded-lg bg-indigo-950/20 border border-indigo-900/30 text-xs text-neutral-300 leading-relaxed">
              <div className="flex items-center gap-1.5 font-medium text-indigo-300 mb-1">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                AI Meeting Intelligence Bot (Groq Powered)
              </div>
              Paste Google Meet transcript or raw recording notes below. The AI pipeline will automatically extract a 5-line summary, key decisions, action items, and draft a client follow-up email.
            </div>

            <div>
              <Label className="text-xs text-neutral-400">Transcript / Meeting Recording Text</Label>
              <Textarea
                value={transcriptInput}
                onChange={(e) => setTranscriptInput(e.target.value)}
                placeholder="Paste Google Meet or Zoom transcript text here..."
                rows={4}
                className="mt-1 bg-neutral-900 border-neutral-800 text-neutral-100 text-xs font-mono"
              />
            </div>

            <Button
              onClick={handleRunAI}
              disabled={summarizeMutation.isPending}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-medium py-2 shadow-md shadow-indigo-600/20"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {summarizeMutation.isPending ? "Extracting Intelligence with Groq..." : "Extract Summary, Decisions & Tasks"}
            </Button>

            {/* Generated Summary */}
            {summary && (
              <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 text-xs">
                <h4 className="font-semibold text-neutral-200 mb-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                  Executive Summary (5 Points)
                </h4>
                <div className="text-neutral-300 whitespace-pre-wrap leading-relaxed">{summary}</div>
              </div>
            )}

            {/* Generated Follow-up Email Draft */}
            {emailDraft && (
              <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-neutral-200 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-indigo-400" />
                    Draft Follow-up Email (Ready to Send)
                  </h4>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={copyEmail}
                    className="h-6 text-[11px] text-neutral-400 hover:text-neutral-100"
                  >
                    {copiedEmail ? <Check className="w-3 h-3 text-emerald-400 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    {copiedEmail ? "Copied" : "Copy Email"}
                  </Button>
                </div>
                <div className="p-2.5 rounded bg-neutral-950 border border-neutral-800/80 text-neutral-300 whitespace-pre-wrap font-sans leading-relaxed text-[11px]">
                  {emailDraft}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
