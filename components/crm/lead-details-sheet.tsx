"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useUpdateLead,
  useAddLeadActivity,
  useConvertLead,
  useDeleteLead,
  LeadItem,
  LeadStageItem,
} from "@/lib/hooks/use-crm";
import { toast } from "sonner";
import {
  Flame,
  Sun,
  Snowflake,
  Phone,
  Mail,
  Calendar,
  Clock,
  Building,
  CheckCircle2,
  DollarSign,
  AlertTriangle,
  Send,
  MessageCircle,
  FileText,
  UserCheck,
  ArrowRight,
  Trash2,
  ExternalLink,
} from "lucide-react";

interface LeadDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: LeadItem | null;
  teamId: string;
  stages: LeadStageItem[];
}

export function LeadDetailsSheet({
  open,
  onOpenChange,
  lead,
  teamId,
  stages,
}: LeadDetailsSheetProps) {
  const updateLeadMutation = useUpdateLead(teamId);
  const addActivityMutation = useAddLeadActivity(teamId);
  const convertLeadMutation = useConvertLead(teamId);
  const deleteLeadMutation = useDeleteLead(teamId);

  // Activity Form state
  const [activityType, setActivityType] = useState<"call" | "email" | "whatsapp" | "meeting" | "note">("call");
  const [activityContent, setActivityContent] = useState("");
  const [newFollowUpDate, setNewFollowUpDate] = useState("");

  // Lost Reason Modal State
  const [showLostDialog, setShowLostDialog] = useState(false);
  const [lostReason, setLostReason] = useState("price");
  const [lostNotes, setLostNotes] = useState("");

  if (!lead) return null;

  const isOverdue =
    lead.nextFollowUpDate &&
    new Date(lead.nextFollowUpDate) < new Date() &&
    !lead.isWon &&
    !lead.isLost;

  const handleStageChange = async (newStageId: string) => {
    const targetStage = stages.find((s) => s.id === newStageId);
    if (targetStage?.type === "lost") {
      setShowLostDialog(true);
      return;
    }

    try {
      await updateLeadMutation.mutateAsync({
        leadId: lead.id,
        data: { stageId: newStageId },
      });
      toast.success(`Moved to stage "${targetStage?.name}"`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update stage");
    }
  };

  const handleTemperatureChange = async (temp: "cold" | "warm" | "hot") => {
    try {
      await updateLeadMutation.mutateAsync({
        leadId: lead.id,
        data: { temperature: temp },
      });
      toast.success(`Temperature updated to ${temp.toUpperCase()}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update temperature");
    }
  };

  const handleLogActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityContent.trim()) return;

    try {
      await addActivityMutation.mutateAsync({
        leadId: lead.id,
        data: {
          type: activityType,
          content: activityContent.trim(),
          nextFollowUpDate: newFollowUpDate || undefined,
        },
      });
      toast.success("Activity logged to timeline!");
      setActivityContent("");
      setNewFollowUpDate("");
    } catch (err: any) {
      toast.error(err.message || "Failed to log activity");
    }
  };

  const handleConvertLead = async () => {
    try {
      const res = await convertLeadMutation.mutateAsync({
        leadId: lead.id,
        options: {
          clientName: lead.companyName || lead.contactName || lead.title,
        },
      });
      toast.success(`🎉 Converted to Client "${res.client.name}" & Project "${res.project.name}"!`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to convert lead");
    }
  };

  const handleConfirmLost = async () => {
    const lostStage = stages.find((s) => s.type === "lost");
    try {
      await updateLeadMutation.mutateAsync({
        leadId: lead.id,
        data: {
          stageId: lostStage?.id,
          isLost: true,
          isWon: false,
          lostReason,
          lostNotes: lostNotes.trim() || undefined,
        },
      });
      toast.info("Lead marked as Lost with reason captured (CRM-08)");
      setShowLostDialog(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to record lost reason");
    }
  };

  const handleDeleteLead = async () => {
    if (!confirm("Are you sure you want to permanently delete this lead?")) return;
    try {
      await deleteLeadMutation.mutateAsync(lead.id);
      toast.success("Lead deleted");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete lead");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-[#141518] border-neutral-800 text-neutral-100 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <DialogHeader className="pb-3 border-b border-neutral-800 flex flex-row items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                {lead.source}
              </span>

              {/* Temperature Badge */}
              <div className="flex items-center gap-1">
                {lead.temperature === "hot" && (
                  <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px] gap-1">
                    <Flame className="w-3 h-3 text-rose-400" /> HOT
                  </Badge>
                )}
                {lead.temperature === "warm" && (
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] gap-1">
                    <Sun className="w-3 h-3 text-amber-400" /> WARM
                  </Badge>
                )}
                {lead.temperature === "cold" && (
                  <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/40 text-[10px] gap-1">
                    <Snowflake className="w-3 h-3 text-sky-400" /> COLD
                  </Badge>
                )}
              </div>

              {lead.isWon && (
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> WON & CONVERTED
                </Badge>
              )}
            </div>

            <DialogTitle className="text-lg font-bold text-neutral-100">{lead.title}</DialogTitle>
            {lead.companyName && (
              <p className="text-xs text-neutral-400 flex items-center gap-1">
                <Building className="w-3 h-3 text-neutral-500" />
                {lead.companyName}
              </p>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeleteLead}
            className="text-neutral-500 hover:text-red-400 hover:bg-red-950/20"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </DialogHeader>

        {/* Overdue Alert Banner (CRM-07) */}
        {isOverdue && (
          <div className="p-3 rounded-lg bg-red-950/30 border border-red-900/50 flex items-center justify-between text-xs text-red-300">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>
                <strong>Follow-up Overdue:</strong> Action was due on{" "}
                {new Date(lead.nextFollowUpDate!).toLocaleDateString()}. Please log activity or reschedule.
              </span>
            </div>
          </div>
        )}

        {/* Stage & Deal Value Strip */}
        <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-neutral-900/60 border border-neutral-800">
          <div>
            <Label className="text-[11px] text-neutral-500">Pipeline Stage</Label>
            <Select value={lead.stageId} onValueChange={handleStageChange}>
              <SelectTrigger className="mt-1 h-8 bg-neutral-950 border-neutral-800 text-neutral-200 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#18191c] border-neutral-800 text-neutral-200 text-xs">
                {stages.map((st) => (
                  <SelectItem key={st.id} value={st.id}>
                    {st.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[11px] text-neutral-500">Estimated Value</Label>
            <p className="mt-1.5 text-sm font-semibold font-mono text-emerald-400">
              {lead.estimatedValue ? `₹${lead.estimatedValue.toLocaleString("en-IN")}` : "Not estimated"}
            </p>
          </div>

          <div>
            <Label className="text-[11px] text-neutral-500">Sales Owner</Label>
            <p className="mt-1.5 text-xs text-neutral-300 font-medium">
              {lead.ownerName || "Unassigned"}
            </p>
          </div>
        </div>

        {/* 1-Click Convert to Client & Project CTA (PRD CRM-09) */}
        {!lead.isWon && (
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/40 to-teal-950/30 border border-emerald-800/40 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-emerald-300">Convert Lead to Client + Project (CRM-09)</h4>
              <p className="text-[11px] text-neutral-400">
                Ready to deliver? Creates Client, Primary Contact, and Project draft in 1 action.
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleConvertLead}
              disabled={convertLeadMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-sm shadow-emerald-600/30"
            >
              {convertLeadMutation.isPending ? "Converting..." : "Convert Now 🎉"}
            </Button>
          </div>
        )}

        {/* Contact Information & Requirements */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-neutral-900/40 border border-neutral-800/60 space-y-1.5">
              <span className="text-[11px] text-neutral-500 font-medium block">Contact Details</span>
              <p className="text-neutral-200 font-medium">{lead.contactName || "No contact name"}</p>
              {lead.email && (
                <a href={`mailto:${lead.email}`} className="text-indigo-400 hover:underline flex items-center gap-1">
                  <Mail className="w-3 h-3" /> {lead.email}
                </a>
              )}
              {lead.phone && (
                <a href={`tel:${lead.phone}`} className="text-neutral-300 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {lead.phone}
                </a>
              )}
            </div>

            <div className="p-3 rounded-lg bg-neutral-900/40 border border-neutral-800/60 space-y-1.5">
              <span className="text-[11px] text-neutral-500 font-medium block">Next Action Scheduled</span>
              <p className="text-neutral-200 font-medium flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                {lead.nextFollowUpDate
                  ? new Date(lead.nextFollowUpDate).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })
                  : "None scheduled"}
              </p>
              <span className="text-[11px] text-neutral-500 block">Temperature Tuning:</span>
              <div className="flex gap-1">
                {(["cold", "warm", "hot"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTemperatureChange(t)}
                    className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                      lead.temperature === t
                        ? "bg-indigo-600 text-white border-indigo-500"
                        : "bg-neutral-900 text-neutral-400 border-neutral-800"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Requirements Summary */}
          {lead.requirementSummary && (
            <div className="p-3 rounded-lg bg-neutral-900/40 border border-neutral-800/60 text-xs">
              <span className="text-[11px] text-neutral-500 font-medium block mb-1">Requirement Notes:</span>
              <p className="text-neutral-300 whitespace-pre-wrap leading-relaxed">{lead.requirementSummary}</p>
            </div>
          )}
        </div>

        {/* Log Activity Box (CRM-06) */}
        <div className="p-3.5 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-3">
          <Label className="text-xs text-neutral-300 font-semibold flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5 text-indigo-400" />
            Log Activity & Touchpoint (CRM-06)
          </Label>

          <form onSubmit={handleLogActivity} className="space-y-2.5">
            <div className="flex gap-2">
              <Select value={activityType} onValueChange={(val: any) => setActivityType(val)}>
                <SelectTrigger className="w-32 h-8 text-xs bg-neutral-950 border-neutral-800 text-neutral-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#18191c] border-neutral-800 text-xs text-neutral-200">
                  <SelectItem value="call">📞 Phone Call</SelectItem>
                  <SelectItem value="email">📧 Email Sent</SelectItem>
                  <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                  <SelectItem value="meeting">🤝 Meeting</SelectItem>
                  <SelectItem value="note">📝 Note</SelectItem>
                </SelectContent>
              </Select>

              <Input
                type="date"
                value={newFollowUpDate}
                onChange={(e) => setNewFollowUpDate(e.target.value)}
                placeholder="Next follow-up date"
                className="w-44 h-8 text-xs bg-neutral-950 border-neutral-800 text-neutral-200"
              />
            </div>

            <Textarea
              value={activityContent}
              onChange={(e) => setActivityContent(e.target.value)}
              placeholder="Spoke with client on phone, shared portfolio demo, follow up on Friday..."
              rows={2}
              className="bg-neutral-950 border-neutral-800 text-neutral-200 text-xs"
              required
            />

            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={addActivityMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-7"
              >
                {addActivityMutation.isPending ? "Logging..." : "Log Activity"}
              </Button>
            </div>
          </form>
        </div>

        {/* Activity Timeline */}
        <div className="space-y-2 pt-2">
          <Label className="text-xs text-neutral-400 font-medium">Activity Timeline</Label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {lead.activities?.length === 0 ? (
              <p className="text-xs text-neutral-500 py-3 text-center">No activities logged yet.</p>
            ) : (
              lead.activities?.map((act) => (
                <div
                  key={act.id}
                  className="p-2.5 rounded-lg bg-neutral-900/40 border border-neutral-800/60 text-xs flex items-start gap-2.5"
                >
                  <div className="p-1 rounded bg-neutral-800 text-neutral-300 shrink-0 mt-0.5">
                    {act.type === "call" && <Phone className="w-3 h-3 text-emerald-400" />}
                    {act.type === "email" && <Mail className="w-3 h-3 text-blue-400" />}
                    {act.type === "whatsapp" && <MessageCircle className="w-3 h-3 text-green-400" />}
                    {act.type === "meeting" && <Calendar className="w-3 h-3 text-indigo-400" />}
                    {act.type === "note" && <FileText className="w-3 h-3 text-amber-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-neutral-200 whitespace-pre-wrap leading-relaxed">{act.content}</p>
                    <p className="text-[10px] text-neutral-500 mt-1">
                      By {act.performedBy} • {new Date(act.performedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Lost Reason Dialog (CRM-08) */}
        {showLostDialog && (
          <Dialog open={showLostDialog} onOpenChange={setShowLostDialog}>
            <DialogContent className="max-w-md bg-[#18191c] border-neutral-800 text-neutral-100">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold text-red-400">
                  Record Lost Reason (CRM-08)
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-3 pt-2">
                <div>
                  <Label className="text-xs text-neutral-400">Primary Reason *</Label>
                  <Select value={lostReason} onValueChange={setLostReason}>
                    <SelectTrigger className="mt-1 bg-neutral-900 border-neutral-800 text-neutral-200 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1f2024] border-neutral-800 text-neutral-200 text-xs">
                      <SelectItem value="price">💸 Price / Budget Mismatch</SelectItem>
                      <SelectItem value="timing">⏳ Timing / Postponed</SelectItem>
                      <SelectItem value="competitor">⚔️ Chose Competitor</SelectItem>
                      <SelectItem value="no_response">👻 Client Ghosted / No Response</SelectItem>
                      <SelectItem value="scope_mismatch">🎯 Scope or Tech Stack Mismatch</SelectItem>
                      <SelectItem value="other">📌 Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-neutral-400">Learning Notes</Label>
                  <Textarea
                    value={lostNotes}
                    onChange={(e) => setLostNotes(e.target.value)}
                    placeholder="What can we learn or follow up on next quarter..."
                    rows={2}
                    className="mt-1 bg-neutral-900 border-neutral-800 text-neutral-200 text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowLostDialog(false)}
                    className="border-neutral-800 text-neutral-400 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleConfirmLost}
                    className="bg-red-600 hover:bg-red-500 text-white text-xs"
                  >
                    Confirm Lost
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
