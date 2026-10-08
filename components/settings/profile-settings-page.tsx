"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { DashboardLoader } from "@/components/ui/dashboard-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { validatePassword } from "@/lib/password-policy";
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

  // 2FA state and dialogs
  const [enable2FADialogOpen, setEnable2FADialogOpen] = useState(false);
  const [disable2FADialogOpen, setDisable2FADialogOpen] = useState(false);
  const [backupCodesDialogOpen, setBackupCodesDialogOpen] = useState(false);
  const [twoFactorPassword, setTwoFactorPassword] = useState("");
  const [twoFactorStep, setTwoFactorStep] = useState<"password" | "verify">("password");
  const [totpData, setTotpData] = useState<{ totpURI: string; backupCodes: string[] } | null>(null);
  const [totpVerificationCode, setTotpVerificationCode] = useState("");
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [backupCodesList, setBackupCodesList] = useState<string[]>([]);

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
      toast.success(`"${deviceName}" session revoked`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to remove device");
    },
  });

  // Revoke all other sessions mutation
  const revokeAllOtherSessionsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/user/sessions?allOther=true`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to sign out other sessions");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["user-sessions"],
        (old: any[] = []) => old.filter((s) => s.isCurrent)
      );
      toast.success(data.message || "All other sessions have been signed out");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to sign out other sessions");
    },
  });

  // Handle password submit
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      toast.error(validation.errors[0]);
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
      toast.success(data.message || "Password changed successfully!");
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

  // Start 2FA enable flow (requires password)
  const handleStartEnable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorPassword) {
      toast.error("Please enter your current password");
      return;
    }

    setTwoFactorLoading(true);
    try {
      const res: any = await authClient.twoFactor.enable({
        password: twoFactorPassword,
      });

      if (res?.error) {
        throw new Error(res.error.message || "Failed to initiate two-factor setup");
      }

      setTotpData(res.data);
      setBackupCodesList(res.data?.backupCodes || []);
      setTwoFactorStep("verify");
      toast.success("Authenticator key generated. Enter verification code to complete setup.");
    } catch (err: any) {
      toast.error(err.message || "Failed to enable two-factor authentication");
    } finally {
      setTwoFactorLoading(false);
    }
  };

  // Finalize 2FA enable with verification code
  const handleConfirmEnable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpVerificationCode.trim()) {
      toast.error("Please enter the 6-digit code from your authenticator app");
      return;
    }

    setTwoFactorLoading(true);
    try {
      const res: any = await authClient.twoFactor.verifyTotp({
        code: totpVerificationCode.trim(),
      });

      if (res?.error) {
        throw new Error(res.error.message || "Invalid two-factor authentication code");
      }

      toast.success("Two-Factor Authentication is now active on your account!");
      setEnable2FADialogOpen(false);
      setTwoFactorPassword("");
      setTotpVerificationCode("");
      setTotpData(null);
      setTwoFactorStep("password");
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    } catch (err: any) {
      toast.error(err.message || "Verification code failed");
    } finally {
      setTwoFactorLoading(false);
    }
  };

  // Disable 2FA
  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorPassword) {
      toast.error("Please enter your password to disable 2FA");
      return;
    }

    setTwoFactorLoading(true);
    try {
      const res: any = await authClient.twoFactor.disable({
        password: twoFactorPassword,
      });

      if (res?.error) {
        throw new Error(res.error.message || "Failed to disable 2FA");
      }

      toast.success("Two-Factor Authentication has been disabled");
      setDisable2FADialogOpen(false);
      setTwoFactorPassword("");
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to disable 2FA");
    } finally {
      setTwoFactorLoading(false);
    }
  };

  // Generate new backup codes
  const handleGenerateBackupCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorPassword) {
      toast.error("Please enter your password");
      return;
    }

    setTwoFactorLoading(true);
    try {
      const res: any = await authClient.twoFactor.generateBackupCodes({
        password: twoFactorPassword,
      });

      if (res?.error) {
        throw new Error(res.error.message || "Failed to regenerate backup codes");
      }

      setBackupCodesList(res.data?.backupCodes || []);
      toast.success("Fresh backup codes generated");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate backup codes");
    } finally {
      setTwoFactorLoading(false);
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

              {/* Two-Factor Authentication (2FA) Row */}
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-white">Two-factor authentication (2FA)</div>
                    {profile?.twoFactorEnabled ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Enabled
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Disabled
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-400">
                    Secure your account with an authenticator app (TOTP) and backup recovery codes.
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {profile?.twoFactorEnabled ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTwoFactorPassword("");
                          setBackupCodesDialogOpen(true);
                        }}
                        className="h-8 text-xs bg-[#17181c] border-white/[0.08] text-neutral-200 hover:text-white"
                      >
                        Backup Codes
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTwoFactorPassword("");
                          setDisable2FADialogOpen(true);
                        }}
                        className="h-8 text-xs bg-rose-500/10 border-rose-500/20 text-rose-300 hover:bg-rose-500/20"
                      >
                        Disable
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => {
                        setTwoFactorStep("password");
                        setTwoFactorPassword("");
                        setTotpVerificationCode("");
                        setTotpData(null);
                        setEnable2FADialogOpen(true);
                      }}
                      className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
                    >
                      Enable 2FA
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Browsers and Devices matching reference screenshot */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-white">Browsers and devices</h2>
                <p className="text-xs text-neutral-400 mt-1">
                  Active sessions currently authenticated to your account.
                </p>
              </div>
              {sessions.some((s: any) => !s.isCurrent) && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={revokeAllOtherSessionsMutation.isPending}
                  onClick={() => revokeAllOtherSessionsMutation.mutate()}
                  className="h-8 text-xs bg-[#17181c] border-rose-500/20 text-rose-300 hover:bg-rose-500/10 w-fit"
                >
                  {revokeAllOtherSessionsMutation.isPending && (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  )}
                  <span>Sign out other sessions</span>
                </Button>
              )}
            </div>

            <div className="bg-[#121316] border border-white/[0.08] rounded-2xl divide-y divide-white/[0.06] overflow-hidden">
              {sessionsLoading ? (
                <div className="p-8 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  <span>Loading active sessions...</span>
                </div>
              ) : sessions.length === 0 ? (
                <div className="p-6 text-center text-xs text-neutral-400">
                  No active sessions found.
                </div>
              ) : (
                sessions.map((device: any) => (
                  <div
                    key={device.id}
                    className="p-4 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Device Icon + Name + Masked IP */}
                    <div className="flex items-center gap-3 min-w-0">
                      <BrowserIcon icon={device.icon} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {device.deviceName}
                        </div>
                        <div className="text-[11px] text-neutral-400 font-mono">
                          IP: {device.ipAddress}
                        </div>
                      </div>
                    </div>

                    {/* Status + Revoke */}
                    <div className="flex items-center gap-4 shrink-0 text-xs">
                      {device.isCurrent ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Current session
                        </span>
                      ) : (
                        <span className="text-neutral-500 text-[11px]">
                          {device.timeAgo}
                        </span>
                      )}

                      {!device.isCurrent ? (
                        <button
                          onClick={() =>
                            revokeSessionMutation.mutate({
                              id: device.id,
                              deviceName: device.deviceName,
                            })
                          }
                          disabled={revokeSessionMutation.isPending}
                          className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Revoke session"
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
              Update your account password. Must be at least 12 characters and include letters, numbers, and symbols.
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
                placeholder="At least 12 characters"
                className="bg-[#17181c] border-white/[0.08] text-xs h-9"
                required
              />
              {newPassword && (
                <div className="text-[11px] text-neutral-400">
                  {validatePassword(newPassword).feedback}
                </div>
              )}
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

      {/* Enable 2FA Dialog Modal */}
      <Dialog open={enable2FADialogOpen} onOpenChange={setEnable2FADialogOpen}>
        <DialogContent className="sm:max-w-md bg-[#121316] border-white/[0.08] text-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>Enable Two-Factor Authentication</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-400">
              {twoFactorStep === "password"
                ? "Enter your current account password to begin two-factor authentication setup."
                : "Add this authenticator key to Google Authenticator, 1Password, or Authy, then enter the 6-digit code."}
            </DialogDescription>
          </DialogHeader>

          {twoFactorStep === "password" ? (
            <form onSubmit={handleStartEnable2FA} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-300">Current Password</label>
                <Input
                  type="password"
                  value={twoFactorPassword}
                  onChange={(e) => setTwoFactorPassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="bg-[#17181c] border-white/[0.08] text-xs h-9"
                  autoFocus
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEnable2FADialogOpen(false)}
                  className="h-8 text-xs bg-[#17181c] border-white/[0.08] text-neutral-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={twoFactorLoading}
                  size="sm"
                  className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
                >
                  {twoFactorLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                  <span>Continue</span>
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleConfirmEnable2FA} className="space-y-4 pt-2">
              {/* Authenticator URI / Secret display */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-neutral-300">Authenticator Secret Key</label>
                <div className="flex items-center gap-2 bg-[#17181c] border border-white/[0.08] p-2.5 rounded-lg">
                  <span className="font-mono text-xs text-emerald-400 tracking-wider truncate flex-1 select-all">
                    {totpData?.totpURI ? (totpData.totpURI.match(/secret=([A-Z0-9]+)/i)?.[1] || totpData.totpURI) : "Loading..."}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const secret = totpData?.totpURI ? (totpData.totpURI.match(/secret=([A-Z0-9]+)/i)?.[1] || totpData.totpURI) : "";
                      if (secret) {
                        navigator.clipboard.writeText(secret);
                        toast.success("Secret copied to clipboard");
                      }
                    }}
                    className="p-1 rounded text-neutral-400 hover:text-white"
                    title="Copy Secret"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Emergency Backup Codes Box */}
              {backupCodesList.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-neutral-300">Emergency Recovery Codes</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(backupCodesList.join("\n"));
                        toast.success("Backup codes copied");
                      }}
                      className="text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      Copy all
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 p-2 bg-[#17181c] rounded-lg border border-white/[0.08] font-mono text-[11px] text-neutral-300 max-h-24 overflow-y-auto">
                    {backupCodesList.map((code, idx) => (
                      <span key={idx} className="tracking-wider">{code}</span>
                    ))}
                  </div>
                  <p className="text-[10px] text-neutral-400">
                    Save these codes in a password manager. You will need them if you lose access to your device.
                  </p>
                </div>
              )}

              {/* Verification Code */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-300">Enter 6-Digit Code</label>
                <Input
                  type="text"
                  value={totpVerificationCode}
                  onChange={(e) => setTotpVerificationCode(e.target.value)}
                  placeholder="123456"
                  className="bg-[#17181c] border-white/[0.08] text-sm h-9 font-mono tracking-widest text-center"
                  autoFocus
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTwoFactorStep("password")}
                  className="h-8 text-xs bg-[#17181c] border-white/[0.08] text-neutral-300"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={twoFactorLoading || !totpVerificationCode.trim()}
                  size="sm"
                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                >
                  {twoFactorLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                  <span>Verify & Activate</span>
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Disable 2FA Dialog Modal */}
      <Dialog open={disable2FADialogOpen} onOpenChange={setDisable2FADialogOpen}>
        <DialogContent className="sm:max-w-md bg-[#121316] border-white/[0.08] text-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-rose-400">
              <AlertCircle className="w-5 h-5 text-rose-400" />
              <span>Disable Two-Factor Authentication</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-400">
              Disabling 2FA makes your account more vulnerable. Enter your password to confirm removal.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDisable2FA} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Confirm Password</label>
              <Input
                type="password"
                value={twoFactorPassword}
                onChange={(e) => setTwoFactorPassword(e.target.value)}
                placeholder="Enter password to disable"
                className="bg-[#17181c] border-white/[0.08] text-xs h-9"
                autoFocus
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDisable2FADialogOpen(false)}
                className="h-8 text-xs bg-[#17181c] border-white/[0.08] text-neutral-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={twoFactorLoading || !twoFactorPassword}
                size="sm"
                className="h-8 text-xs bg-rose-600 hover:bg-rose-500 text-white font-medium"
              >
                {twoFactorLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                <span>Disable 2FA</span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Backup Codes Dialog Modal */}
      <Dialog open={backupCodesDialogOpen} onOpenChange={setBackupCodesDialogOpen}>
        <DialogContent className="sm:max-w-md bg-[#121316] border-white/[0.08] text-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-400" />
              <span>Two-Factor Backup Codes</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-400">
              Use these single-use recovery codes if you lose access to your authenticator application.
            </DialogDescription>
          </DialogHeader>

          {backupCodesList.length > 0 ? (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-2 p-3 bg-[#17181c] rounded-xl border border-white/[0.08] font-mono text-xs text-neutral-200">
                {backupCodesList.map((code, idx) => (
                  <div key={idx} className="p-1 tracking-wider text-center bg-white/[0.02] rounded">
                    {code}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(backupCodesList.join("\n"));
                    toast.success("Backup codes copied to clipboard");
                  }}
                  className="h-8 text-xs bg-[#17181c] border-white/[0.08] text-neutral-200"
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  <span>Copy Codes</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setBackupCodesDialogOpen(false)}
                  className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white"
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleGenerateBackupCodes} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-300">Confirm Password</label>
                <Input
                  type="password"
                  value={twoFactorPassword}
                  onChange={(e) => setTwoFactorPassword(e.target.value)}
                  placeholder="Enter password to generate codes"
                  className="bg-[#17181c] border-white/[0.08] text-xs h-9"
                  autoFocus
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBackupCodesDialogOpen(false)}
                  className="h-8 text-xs bg-[#17181c] border-white/[0.08] text-neutral-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={twoFactorLoading || !twoFactorPassword}
                  size="sm"
                  className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
                >
                  {twoFactorLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                  <span>Generate Codes</span>
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
