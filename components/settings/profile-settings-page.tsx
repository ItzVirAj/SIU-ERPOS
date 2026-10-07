"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { DashboardLoader } from "@/components/ui/dashboard-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  ShieldCheck,
  CheckCircle2,
  Key,
  Laptop,
  Smartphone,
  Monitor,
  Trash2,
  Search,
  Plus,
  Copy,
  Calendar,
  Building2,
  Briefcase,
  Mail,
  Phone,
  MapPin,
  User,
  Lock,
  X,
  RotateCcw,
  Check,
  Loader2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Shield,
  CreditCard,
  Bell,
  Layers,
  Palette,
  Gift,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Custom device / browser icons
function BrowserIcon({ icon }: { icon: string }) {
  if (icon === "brave") {
    return (
      <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L3 8.5v7L12 22l9-6.5v-7L12 2zm0 2.5l6.5 4.7v5L12 19.1l-6.5-4.9v-5L12 4.5z" />
        </svg>
      </div>
    );
  }
  if (icon === "apple") {
    return (
      <div className="w-8 h-8 rounded-lg bg-neutral-800 border border-white/10 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.38c.62-.75 1.04-1.8 0.93-2.85-.9.04-1.99.6-2.64 1.35-.57.65-1.06 1.72-.93 2.74 1.01.08 2.02-.49 2.64-1.24z" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
      <Monitor className="w-4 h-4 text-blue-400" />
    </div>
  );
}

export default function ProfileSettingsPage() {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();

  // Tabs state matching screenshot
  const [activeTab, setActiveTab] = useState<string>("security");
  const [securityBannerDismissed, setSecurityBannerDismissed] = useState(false);

  // Password dialog
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Profile edit form state
  const [profileForm, setProfileForm] = useState({
    name: "",
    username: "",
    dateOfBirth: "",
    joiningDate: "",
    position: "",
    department: "",
    phone: "",
    location: "",
    bio: "",
  });

  // Fetch real-time profile data
  const {
    data: profile,
    isLoading: profileLoading,
  } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await fetch("/api/user/profile");
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
  });

  // Fetch active sessions / devices
  const {
    data: sessions = [],
    isLoading: sessionsLoading,
  } = useQuery({
    queryKey: ["user-sessions"],
    queryFn: async () => {
      const res = await fetch("/api/user/sessions");
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return res.json();
    },
  });

  // Initialize form when profile loads
  useEffect(() => {
    if (profile) {
      setProfileForm({
        name: profile.name || "",
        username: profile.username || "",
        dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : "",
        joiningDate: profile.joiningDate ? profile.joiningDate.slice(0, 10) : "",
        position: profile.position || "",
        department: profile.department || "",
        phone: profile.phone || "",
        location: profile.location || "",
        bio: profile.bio || "",
      });
    }
  }, [profile]);

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (updatedData: any) => {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update profile");
      }
      return res.json();
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["user-profile"], updated);
      toast.success("Profile information updated successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update profile");
    },
  });

  // Revoke device session mutation
  const revokeSessionMutation = useMutation({
    mutationFn: async ({ id, deviceName }: { id: string; deviceName: string }) => {
      const res = await fetch(`/api/user/sessions?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove device");
      return { id, deviceName };
    },
    onSuccess: ({ id, deviceName }) => {
      queryClient.setQueryData(
        ["user-sessions"],
        (old: any[] = []) => old.filter((s) => s.id !== id)
      );
      toast.success(`"${deviceName}" removed`, {
        action: {
          label: "Undo",
          onClick: () => {
            queryClient.invalidateQueries({ queryKey: ["user-sessions"] });
            toast.info(`Restored "${deviceName}" session`);
          },
        },
      });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to remove device");
    },
  });

  // Handle password submit
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to change password");
      }
      toast.success("Password changed successfully!");
      setPasswordDialogOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleCopyCode = () => {
    if (profile?.employeeCode) {
      navigator.clipboard.writeText(profile.employeeCode);
      toast.success(`Copied employee code: ${profile.employeeCode}`);
    }
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <DashboardLoader message="Loading Profile Settings" submessage="Fetching real-time account data..." />
      </div>
    );
  }

  const displayName = profile?.name || session?.user?.name || "Olive Nacelle";

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Top Header matching reference screenshot */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{displayName}</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Manage your details and personal preferences here.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <Input
              placeholder="Search"
              className="h-9 pl-9 text-xs bg-[#17181c] border-white/[0.08] text-white rounded-lg"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs bg-[#17181c] border-white/[0.08] text-neutral-300 hover:text-white"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            <span>Invite</span>
          </Button>
          <Button
            size="sm"
            className="h-9 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
          >
            <span>Upgrade</span>
          </Button>
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-full bg-neutral-800 border border-white/10 flex items-center justify-center font-bold text-xs text-white overflow-hidden">
              {profile?.image ? (
                <img src={profile.image} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <span>{displayName.slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-[#0e0f11] flex items-center justify-center">
              <Check className="w-2 h-2 text-white stroke-[3]" />
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs matching screenshot */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-white/[0.08] pb-2 text-sm">
        {[
          { id: "general", label: "General" },
          { id: "security", label: "Security" },
          { id: "billing", label: "Billing" },
          { id: "notifications", label: "Notifications" },
          { id: "apps", label: "Apps" },
          { id: "branding", label: "Branding" },
          { id: "refer", label: "Refer a friend" },
          { id: "sharing", label: "Sharing" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-3.5 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap",
              activeTab === tab.id
                ? "bg-white/[0.08] text-white shadow-xs"
                : "text-neutral-400 hover:text-white hover:bg-white/[0.03]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SECURITY TAB (Active in screenshot) */}
      {activeTab === "security" && (
        <div className="space-y-8">
          {/* Account Security Progress Banner matching screenshot */}
          {!securityBannerDismissed && (
            <div className="bg-[#14151a] border border-white/[0.08] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* 90% circular progress meter */}
                <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle
                      cx="18"
                      cy="18"
                      r="15"
                      fill="none"
                      className="stroke-neutral-800"
                      strokeWidth="3"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="15"
                      fill="none"
                      className="stroke-blue-500"
                      strokeWidth="3"
                      strokeDasharray="94.2"
                      strokeDashoffset="9.42"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Your account security is 90%
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Please review your account security settings regularly and update your password.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSecurityBannerDismissed(true)}
                  className="h-8 text-xs bg-[#17181c] border-white/[0.08] text-neutral-300 hover:text-white"
                >
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  onClick={() => setPasswordDialogOpen(true)}
                  className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
                >
                  Review security
                </Button>
              </div>
            </div>
          )}

          {/* Basics: Password Change */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
              Basics
            </h2>
            <div className="bg-[#121316] border border-white/[0.08] rounded-2xl divide-y divide-white/[0.06]">
              {/* Password Row matching screenshot */}
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-white">Password</div>
                  <div className="text-xs text-neutral-400">
                    Set a password to protect your account.
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="tracking-widest text-neutral-400 text-sm font-mono select-none">
                      ••••••••••••••••
                    </span>
                    <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Very secure</span>
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPasswordDialogOpen(true)}
                    className="h-8 text-xs bg-[#17181c] border-white/[0.08] text-neutral-200 hover:text-white"
                  >
                    Edit
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Browsers and Devices matching reference screenshot */}
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Browsers and devices</h2>
              <p className="text-xs text-neutral-400 mt-1">
                These browsers and devices are currently signed in to your account. Remove any
                unauthorized devices.
              </p>
            </div>

            <div className="bg-[#121316] border border-white/[0.08] rounded-2xl divide-y divide-white/[0.06] overflow-hidden">
              {sessionsLoading ? (
                <div className="p-8 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  <span>Loading active sessions...</span>
                </div>
              ) : sessions.length === 0 ? (
                <div className="p-6 text-center text-xs text-neutral-400">
                  No other active devices detected.
                </div>
              ) : (
                sessions.map((device: any) => (
                  <div
                    key={device.id}
                    className="p-4 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Device Icon + Name */}
                    <div className="flex items-center gap-3 min-w-0">
                      <BrowserIcon icon={device.icon} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {device.deviceName}
                        </div>
                      </div>
                    </div>

                    {/* Location + Status + Revoke */}
                    <div className="flex items-center gap-6 shrink-0 text-xs">
                      {/* Location with Flag */}
                      <div className="hidden sm:flex items-center gap-1.5 text-neutral-400">
                        <span className="text-sm">{device.flag}</span>
                        <span>{device.location}</span>
                      </div>

                      {/* Time / Current Session Status */}
                      <div
                        className={cn(
                          "w-28 text-right font-medium",
                          device.isCurrent ? "text-neutral-300" : "text-neutral-500"
                        )}
                      >
                        {device.timeAgo}
                      </div>

                      {/* Delete / Revoke Device Button */}
                      {!device.isCurrent ? (
                        <button
                          onClick={() =>
                            revokeSessionMutation.mutate({
                              id: device.id,
                              deviceName: device.deviceName,
                            })
                          }
                          className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Remove device"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <div className="w-7" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* GENERAL TAB (Edit Profile info, username, DOB, joining date, position, employeeCode) */}
      {activeTab === "general" && (
        <div className="space-y-6">
          {/* Identity & Employee Badge Card */}
          <div className="bg-[#121316] border border-white/[0.08] rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shrink-0">
                {profile?.image ? (
                  <img
                    src={profile.image}
                    alt={displayName}
                    className="w-full h-full rounded-2xl object-cover"
                  />
                ) : (
                  <span>{displayName.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white">{displayName}</h3>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-medium">
                    Verified Member
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-1">
                  {profile?.email} · {profile?.position || "Team Contributor"}
                </p>
              </div>
            </div>

            {/* Unique Employee Code Display */}
            <div className="bg-[#17181c] border border-white/[0.08] rounded-xl p-3.5 flex items-center gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider block">
                  Official Employee Code
                </span>
                <span className="text-base font-mono font-bold text-indigo-400 tracking-wider">
                  {profile?.employeeCode || "EMP#XXXXX"}
                </span>
              </div>
              <button
                onClick={handleCopyCode}
                className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white transition-colors"
                title="Copy Employee Code"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Edit Profile Form */}
          <Card className="bg-[#121316] border-white/[0.08] p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateProfileMutation.mutate(profileForm);
              }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-base font-semibold text-white">Personal Information</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Update your organizational profile and employment credentials.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-300">Full Name</label>
                  <Input
                    value={profileForm.name}
                    onChange={(e) =>
                      setProfileForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="bg-[#17181c] border-white/[0.08] text-xs h-9"
                    placeholder="e.g. Olive Nacelle"
                    required
                  />
                </div>

                {/* Username */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-300">Username</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-xs">
                      @
                    </span>
                    <Input
                      value={profileForm.username}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, username: e.target.value }))
                      }
                      className="bg-[#17181c] border-white/[0.08] text-xs h-9 pl-7"
                      placeholder="username"
                      required
                    />
                  </div>
                </div>

                {/* Position in Company */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-300">
                    Position in Company
                  </label>
                  <Input
                    value={profileForm.position}
                    onChange={(e) =>
                      setProfileForm((prev) => ({ ...prev, position: e.target.value }))
                    }
                    className="bg-[#17181c] border-white/[0.08] text-xs h-9"
                    placeholder="e.g. Senior Product Designer"
                  />
                </div>

                {/* Department */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-300">Department</label>
                  <Input
                    value={profileForm.department}
                    onChange={(e) =>
                      setProfileForm((prev) => ({ ...prev, department: e.target.value }))
                    }
                    className="bg-[#17181c] border-white/[0.08] text-xs h-9"
                    placeholder="e.g. Engineering & Operations"
                  />
                </div>

                {/* Date of Birth */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-300">Date of Birth</label>
                  <Input
                    type="date"
                    value={profileForm.dateOfBirth}
                    onChange={(e) =>
                      setProfileForm((prev) => ({ ...prev, dateOfBirth: e.target.value }))
                    }
                    className="bg-[#17181c] border-white/[0.08] text-xs h-9 text-neutral-200"
                  />
                </div>

                {/* Joining Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-300">Joining Date</label>
                  <Input
                    type="date"
                    value={profileForm.joiningDate}
                    onChange={(e) =>
                      setProfileForm((prev) => ({ ...prev, joiningDate: e.target.value }))
                    }
                    className="bg-[#17181c] border-white/[0.08] text-xs h-9 text-neutral-200"
                  />
                </div>

                {/* Phone Number */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-300">Phone Number</label>
                  <Input
                    value={profileForm.phone}
                    onChange={(e) =>
                      setProfileForm((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    className="bg-[#17181c] border-white/[0.08] text-xs h-9"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>

                {/* Location / Office */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-300">Office Location</label>
                  <Input
                    value={profileForm.location}
                    onChange={(e) =>
                      setProfileForm((prev) => ({ ...prev, location: e.target.value }))
                    }
                    className="bg-[#17181c] border-white/[0.08] text-xs h-9"
                    placeholder="e.g. San Francisco, CA"
                  />
                </div>
              </div>

              {/* Bio */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-300">Bio / About</label>
                <Textarea
                  value={profileForm.bio}
                  onChange={(e) =>
                    setProfileForm((prev) => ({ ...prev, bio: e.target.value }))
                  }
                  rows={3}
                  className="bg-[#17181c] border-white/[0.08] text-xs resize-none"
                  placeholder="Tell your team about your role, working hours, and responsibilities..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.06]">
                <Button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                >
                  {updateProfileMutation.isPending && (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  )}
                  <span>Save Changes</span>
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* BILLING, NOTIFICATIONS & OTHER TABS */}
      {activeTab !== "security" && activeTab !== "general" && (
        <Card className="bg-[#121316] border-white/[0.08] p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.04] text-neutral-300 mx-auto flex items-center justify-center mb-3">
            {activeTab === "billing" && <CreditCard className="w-6 h-6" />}
            {activeTab === "notifications" && <Bell className="w-6 h-6" />}
            {activeTab === "apps" && <Layers className="w-6 h-6" />}
            {activeTab === "branding" && <Palette className="w-6 h-6" />}
            {activeTab === "refer" && <Gift className="w-6 h-6" />}
            {activeTab === "sharing" && <Share2 className="w-6 h-6" />}
          </div>
          <h3 className="text-base font-semibold text-white capitalize">{activeTab} Preferences</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1 mb-4">
            Customization options for {activeTab} are automatically synchronized with your enterprise plan.
          </p>
          <Button
            size="sm"
            onClick={() => setActiveTab("security")}
            variant="outline"
            className="bg-[#17181c] border-white/[0.08] text-neutral-200"
          >
            Back to Security Settings
          </Button>
        </Card>
      )}

      {/* Change Password Dialog Modal */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md bg-[#121316] border-white/[0.08] text-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-400" />
              <span>Change Password</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-400">
              Update your account password. Choose a strong password with at least 6 characters.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePasswordSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Current Password</label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="bg-[#17181c] border-white/[0.08] text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">New Password</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="bg-[#17181c] border-white/[0.08] text-xs h-9"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Confirm New Password</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="bg-[#17181c] border-white/[0.08] text-xs h-9"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPasswordDialogOpen(false)}
                className="h-8 text-xs bg-[#17181c] border-white/[0.08] text-neutral-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={changingPassword}
                size="sm"
                className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
              >
                {changingPassword ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : null}
                <span>Update Password</span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
