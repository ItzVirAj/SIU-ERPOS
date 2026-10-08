"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { useCreateLead, useLeadPipeline } from "@/lib/hooks/use-crm";
import { useTeamMembers } from "@/lib/hooks/use-team-data";
import { toast } from "sonner";
import { Flame, Sun, Snowflake, Target, DollarSign, Calendar, User, Building, Mail, Phone } from "lucide-react";

interface LeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  defaultStageId?: string;
}

export function LeadDialog({
  open,
  onOpenChange,
  teamId,
  defaultStageId,
}: LeadDialogProps) {
  const createLeadMutation = useCreateLead(teamId);
  const { data: pipeline } = useLeadPipeline(teamId);
  const { data: members = [] } = useTeamMembers(teamId);

  const [title, setTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [industryVertical, setIndustryVertical] = useState("");
  const [source, setSource] = useState("website");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [temperature, setTemperature] = useState<"cold" | "warm" | "hot">("warm");
  const [ownerId, setOwnerId] = useState("unassigned");
  const [stageId, setStageId] = useState(defaultStageId || "");
  const [nextFollowUpDate, setNextFollowUpDate] = useState(
    new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [requirementSummary, setRequirementSummary] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please provide a lead or deal title");
      return;
    }

    const selectedOwner = members.find((m: any) => m.userId === ownerId);

    try {
      await createLeadMutation.mutateAsync({
        title: title.trim(),
        companyName: companyName.trim() || undefined,
        contactName: contactName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        industryVertical: industryVertical.trim() || undefined,
        source,
        estimatedValue: estimatedValue ? parseFloat(estimatedValue) : undefined,
        temperature,
        ownerId: ownerId === "unassigned" ? undefined : ownerId,
        ownerName: selectedOwner ? selectedOwner.userName : undefined,
        stageId: stageId || defaultStageId || pipeline?.stages[0]?.id,
        nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : undefined,
        requirementSummary: requirementSummary.trim() || undefined,
      });

      toast.success("Lead captured successfully!");
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Failed to create lead");
    }
  };

  const resetForm = () => {
    setTitle("");
    setCompanyName("");
    setContactName("");
    setEmail("");
    setPhone("");
    setIndustryVertical("");
    setSource("website");
    setEstimatedValue("");
    setTemperature("warm");
    setOwnerId("unassigned");
    setRequirementSummary("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-[#141518] border-neutral-800 text-neutral-100 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2 border-b border-neutral-800">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-400" />
            Capture New Sales Lead (CRM-01)
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Title / Deal Name */}
          <div>
            <Label className="text-xs text-neutral-400">Opportunity / Project Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Agri-Export ERP Custom Build / SaaS Subscription"
              className="mt-1 bg-neutral-900 border-neutral-800 text-neutral-100 placeholder:text-neutral-500 text-xs"
              required
            />
          </div>

          {/* Company & Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-neutral-400 flex items-center gap-1">
                <Building className="w-3 h-3" /> Company Name
              </Label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Apex Agri Solutions Pvt Ltd"
                className="mt-1 bg-neutral-900 border-neutral-800 text-neutral-100 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs text-neutral-400 flex items-center gap-1">
                <User className="w-3 h-3" /> Contact Person
              </Label>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="e.g. Ramesh Sharma (Director)"
                className="mt-1 bg-neutral-900 border-neutral-800 text-neutral-100 text-xs"
              />
            </div>
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-neutral-400 flex items-center gap-1">
                <Mail className="w-3 h-3" /> Email Address
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ramesh@apexagri.in"
                className="mt-1 bg-neutral-900 border-neutral-800 text-neutral-100 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs text-neutral-400 flex items-center gap-1">
                <Phone className="w-3 h-3" /> Phone / WhatsApp
              </Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="mt-1 bg-neutral-900 border-neutral-800 text-neutral-100 text-xs"
              />
            </div>
          </div>

          {/* Source & Industry */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-neutral-400">Lead Source (CRM-01)</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="mt-1 bg-neutral-900 border-neutral-800 text-neutral-100 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#18191c] border-neutral-800 text-neutral-100 text-xs">
                  <SelectItem value="website">🌐 Website Inbound</SelectItem>
                  <SelectItem value="fiverr">🟢 Fiverr Gig Order</SelectItem>
                  <SelectItem value="upwork">🟢 Upwork Proposal</SelectItem>
                  <SelectItem value="referral">🤝 Client Referral</SelectItem>
                  <SelectItem value="linkedin">💼 LinkedIn Outreach</SelectItem>
                  <SelectItem value="cold_outreach">📧 Cold Email</SelectItem>
                  <SelectItem value="other">📌 Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-neutral-400">Industry Vertical</Label>
              <Input
                value={industryVertical}
                onChange={(e) => setIndustryVertical(e.target.value)}
                placeholder="e.g. Agribusiness, Manufacturing"
                className="mt-1 bg-neutral-900 border-neutral-800 text-neutral-100 text-xs"
              />
            </div>
          </div>

          {/* Deal Value (INR) & Temperature (Cold/Warm/Hot) - CRM-04 */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-neutral-900/60 border border-neutral-800/80">
            <div>
              <Label className="text-xs text-neutral-400 flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Estimated Value (₹ INR)
              </Label>
              <Input
                type="number"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
                placeholder="250000"
                className="mt-1 bg-neutral-950 border-neutral-800 text-neutral-100 text-xs font-mono"
              />
            </div>

            <div>
              <Label className="text-xs text-neutral-400">Temperature (CRM-04)</Label>
              <div className="flex gap-1.5 mt-1">
                <button
                  type="button"
                  onClick={() => setTemperature("hot")}
                  className={`flex-1 py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1 border transition-all ${
                    temperature === "hot"
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm shadow-rose-500/20"
                      : "bg-neutral-950 text-neutral-500 border-neutral-800 hover:text-neutral-300"
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 text-rose-400" />
                  Hot
                </button>
                <button
                  type="button"
                  onClick={() => setTemperature("warm")}
                  className={`flex-1 py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1 border transition-all ${
                    temperature === "warm"
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/20"
                      : "bg-neutral-950 text-neutral-500 border-neutral-800 hover:text-neutral-300"
                  }`}
                >
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  Warm
                </button>
                <button
                  type="button"
                  onClick={() => setTemperature("cold")}
                  className={`flex-1 py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1 border transition-all ${
                    temperature === "cold"
                      ? "bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-sm shadow-sky-500/20"
                      : "bg-neutral-950 text-neutral-500 border-neutral-800 hover:text-neutral-300"
                  }`}
                >
                  <Snowflake className="w-3.5 h-3.5 text-sky-400" />
                  Cold
                </button>
              </div>
            </div>
          </div>

          {/* Owner & Mandatory Next Follow-Up Date (CRM-07) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-neutral-400">Sales Owner</Label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger className="mt-1 bg-neutral-900 border-neutral-800 text-neutral-100 text-xs">
                  <SelectValue placeholder="Assignee" />
                </SelectTrigger>
                <SelectContent className="bg-[#18191c] border-neutral-800 text-neutral-100 text-xs">
                  <SelectItem value="unassigned">Founder / Unassigned</SelectItem>
                  {members.map((m: any) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.userName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-neutral-400 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-indigo-400" /> Next Follow-Up Date * (CRM-07)
              </Label>
              <Input
                type="date"
                value={nextFollowUpDate}
                onChange={(e) => setNextFollowUpDate(e.target.value)}
                className="mt-1 bg-neutral-900 border-neutral-800 text-neutral-100 text-xs"
                required
              />
            </div>
          </div>

          {/* Requirement Summary */}
          <div>
            <Label className="text-xs text-neutral-400">Client Requirements Summary</Label>
            <Textarea
              value={requirementSummary}
              onChange={(e) => setRequirementSummary(e.target.value)}
              placeholder="Client needs custom ERP module for warehouse tracking, 6 weeks deadline..."
              rows={3}
              className="mt-1 bg-neutral-900 border-neutral-800 text-neutral-100 text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-neutral-800 text-neutral-400"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createLeadMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs"
            >
              {createLeadMutation.isPending ? "Capturing..." : "Add to Pipeline"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
