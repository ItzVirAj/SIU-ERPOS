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
import { useCreateEvent } from "@/lib/hooks/use-calendar";
import { useProjects } from "@/lib/hooks/use-projects";
import { useTeamMembers } from "@/lib/hooks/use-team-data";
import { toast } from "sonner";
import {
  Video,
  Calendar as CalendarIcon,
  Clock,
  Users,
  FolderKanban,
  MapPin,
  Sparkles,
} from "lucide-react";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  defaultDate?: string;
}

export function EventDialog({
  open,
  onOpenChange,
  teamId,
  defaultDate,
}: EventDialogProps) {
  const createEventMutation = useCreateEvent(teamId);
  const { data: projects = [] } = useProjects(teamId);
  const { data: members = [] } = useTeamMembers(teamId);

  const initialDateStr = defaultDate || new Date().toISOString().split("T")[0];
  const [title, setTitle] = useState("");
  const [type, setType] = useState<
    "meeting" | "standup" | "milestone" | "task_deadline" | "followup" | "leave"
  >("meeting");
  const [startDate, setStartDate] = useState(initialDateStr);
  const [startTime, setStartTime] = useState("10:00");
  const [endDate, setEndDate] = useState(initialDateStr);
  const [endTime, setEndTime] = useState("11:00");
  const [projectId, setProjectId] = useState<string>("none");
  const [generateMeet, setGenerateMeet] = useState(true);
  const [customMeetUrl, setCustomMeetUrl] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [externalEmails, setExternalEmails] = useState("");

  const handleMemberToggle = (memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please provide an event title");
      return;
    }

    const startDateTime = new Date(`${startDate}T${startTime}:00`);
    const endDateTime = new Date(`${endDate}T${endTime}:00`);

    if (endDateTime <= startDateTime) {
      toast.error("End time must be after start time");
      return;
    }

    // Build attendees list
    const attendeesList: Array<{ name: string; email: string; userId?: string }> = [];
    selectedMembers.forEach((mId) => {
      const m = members.find((member: any) => member.userId === mId);
      if (m) {
        attendeesList.push({
          userId: m.userId,
          name: m.userName,
          email: m.userEmail,
        });
      }
    });

    if (externalEmails.trim()) {
      const emails = externalEmails.split(",").map((em) => em.trim());
      emails.forEach((em) => {
        if (em.includes("@")) {
          attendeesList.push({
            name: em.split("@")[0],
            email: em,
          });
        }
      });
    }

    try {
      await createEventMutation.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        projectId: projectId === "none" ? undefined : projectId,
        generateMeet,
        meetUrl: !generateMeet && customMeetUrl.trim() ? customMeetUrl.trim() : undefined,
        location: location.trim() || undefined,
        attendees: attendeesList,
      });

      toast.success(
        type === "meeting"
          ? "Meeting scheduled with Google Meet!"
          : `${type.toUpperCase()} scheduled successfully!`
      );
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Failed to schedule event");
    }
  };

  const resetForm = () => {
    setTitle("");
    setType("meeting");
    setDescription("");
    setLocation("");
    setCustomMeetUrl("");
    setSelectedMembers([]);
    setExternalEmails("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-[#141518] border-neutral-800 text-neutral-100 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-indigo-400" />
            Schedule New Event
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Title */}
          <div>
            <Label className="text-xs text-neutral-400">Event Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Discovery Call with Client / Sprint Planning"
              className="mt-1 bg-neutral-900 border-neutral-800 text-neutral-100 placeholder:text-neutral-500"
              required
            />
          </div>

          {/* Event Type & Project */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-neutral-400">Event Type</Label>
              <Select value={type} onValueChange={(val: any) => setType(val)}>
                <SelectTrigger className="mt-1 bg-neutral-900 border-neutral-800 text-neutral-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#18191c] border-neutral-800 text-neutral-100">
                  <SelectItem value="meeting">🤝 Meeting</SelectItem>
                  <SelectItem value="standup">⚡ Daily Stand-up</SelectItem>
                  <SelectItem value="milestone">🏁 Milestone</SelectItem>
                  <SelectItem value="task_deadline">📅 Task Deadline</SelectItem>
                  <SelectItem value="followup">🔔 Lead Follow-up</SelectItem>
                  <SelectItem value="leave">🏖️ Leave / Absence</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-neutral-400">Linked Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="mt-1 bg-neutral-900 border-neutral-800 text-neutral-100">
                  <SelectValue placeholder="General (None)" />
                </SelectTrigger>
                <SelectContent className="bg-[#18191c] border-neutral-800 text-neutral-100">
                  <SelectItem value="none">General (No Project)</SelectItem>
                  {projects.map((proj) => (
                    <SelectItem key={proj.id} value={proj.id}>
                      {proj.name} ({proj.key})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date & Time Pickers */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-neutral-900/60 border border-neutral-800/80">
            <div>
              <Label className="text-xs text-neutral-400">Start Time</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-neutral-950 border-neutral-800 text-neutral-200 text-xs"
                />
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="bg-neutral-950 border-neutral-800 text-neutral-200 text-xs w-28"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-neutral-400">End Time</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-neutral-950 border-neutral-800 text-neutral-200 text-xs"
                />
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="bg-neutral-950 border-neutral-800 text-neutral-200 text-xs w-28"
                />
              </div>
            </div>
          </div>

          {/* Google Meet Toggle (PRD CAL-03) */}
          <div className="p-3 rounded-lg bg-indigo-950/20 border border-indigo-900/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                <Video className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-neutral-200">Google Meet Video Conference</p>
                <p className="text-[11px] text-neutral-400">Auto-generate a secure Meet room for participants</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={generateMeet}
                onChange={(e) => setGenerateMeet(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Attendees */}
          <div>
            <Label className="text-xs text-neutral-400">Team Attendees</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5 max-h-24 overflow-y-auto p-1.5 rounded-lg bg-neutral-900/50 border border-neutral-800/60">
              {members.length === 0 ? (
                <span className="text-xs text-neutral-500">No other team members</span>
              ) : (
                members.map((mem: any) => {
                  const isSelected = selectedMembers.includes(mem.userId);
                  return (
                    <button
                      type="button"
                      key={mem.id}
                      onClick={() => handleMemberToggle(mem.userId)}
                      className={`text-xs px-2.5 py-1 rounded-full transition-all border ${
                        isSelected
                          ? "bg-indigo-600 text-white border-indigo-500 shadow-sm shadow-indigo-600/30"
                          : "bg-neutral-800 text-neutral-400 border-neutral-700/50 hover:bg-neutral-700/60"
                      }`}
                    >
                      {mem.userName}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* External Attendees / Client Emails */}
          <div>
            <Label className="text-xs text-neutral-400">External Client Attendees (Comma separated emails)</Label>
            <Input
              value={externalEmails}
              onChange={(e) => setExternalEmails(e.target.value)}
              placeholder="client@company.com, partner@agri.com"
              className="mt-1 bg-neutral-900 border-neutral-800 text-neutral-100 placeholder:text-neutral-500 text-xs"
            />
          </div>

          {/* Agenda / Description */}
          <div>
            <Label className="text-xs text-neutral-400">Agenda & Notes</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Meeting discussion points, preparation notes..."
              rows={3}
              className="mt-1 bg-neutral-900 border-neutral-800 text-neutral-100 placeholder:text-neutral-500 text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-neutral-800 text-neutral-400 hover:text-neutral-200"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createEventMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
            >
              {createEventMutation.isPending ? "Scheduling..." : "Create Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
