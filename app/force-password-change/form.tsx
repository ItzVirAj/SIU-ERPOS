"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Eye, EyeOff, Check, X, LogOut, KeyRound } from "lucide-react"

const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(12, "Must be at least 12 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New passwords do not match",
    path: ["confirmPassword"],
  })

type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>

interface Props {
  userEmail: string
  userName: string
}

export function ForcePasswordChangeForm({ userEmail, userName }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  const newPassword = watch("newPassword", "")
  const confirmPassword = watch("confirmPassword", "")
  const currentPassword = watch("currentPassword", "")

  // Live checklist criteria
  const hasMinLength = newPassword.length >= 12 && newPassword.length <= 128
  const hasUpper = /[A-Z]/.test(newPassword)
  const hasLower = /[a-z]/.test(newPassword)
  const hasDigit = /[0-9]/.test(newPassword)
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword)
  const notSameAsCurrent =
    !currentPassword || !newPassword || newPassword !== currentPassword
  const matchesConfirm = Boolean(
    newPassword && confirmPassword && newPassword === confirmPassword
  )

  const onSubmit = async (values: ChangePasswordFormValues) => {
    setServerError(null)
    setSubmitting(true)

    try {
      const res = await fetch("/api/me/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.details && Array.isArray(data.details)) {
          setServerError(data.details.join(". "))
        } else {
          setServerError(data.error || "Failed to change password")
        }
        return
      }

      toast.success("Password changed successfully", {
        description: "Welcome to SIU-ERPOS! Redirecting to dashboard...",
      })

      router.replace("/dashboard")
      router.refresh()
    } catch (err: any) {
      setServerError(err.message || "An unexpected network error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await authClient.signOut()
      router.replace("/sign-in")
    } catch (err) {
      console.error("Sign out error", err)
      router.replace("/sign-in")
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-xl">
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="pt-6 space-y-5">
          {serverError && (
            <div className="rounded-lg bg-destructive/15 border border-destructive/30 p-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          {/* Current Password */}
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Current Temporary Password</Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showCurrent ? "text" : "password"}
                placeholder="Enter temporary password"
                disabled={submitting}
                {...register("currentPassword")}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.currentPassword && (
              <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
            )}
          </div>

          {/* New Password */}
          <div className="space-y-1.5">
            <Label htmlFor="newPassword">New Password</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNew ? "text" : "password"}
                placeholder="Choose a strong password"
                disabled={submitting}
                {...register("newPassword")}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-xs text-destructive">{errors.newPassword.message}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                placeholder="Re-enter new password"
                disabled={submitting}
                {...register("confirmPassword")}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          {/* Live Criteria Checklist */}
          <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-1.5 text-xs">
            <p className="font-medium text-foreground text-[11px] uppercase tracking-wider mb-1">
              Password Requirements:
            </p>
            <CheckItem satisfied={hasMinLength} label="At least 12 characters (max 128)" />
            <CheckItem satisfied={hasUpper} label="At least one uppercase letter (A-Z)" />
            <CheckItem satisfied={hasLower} label="At least one lowercase letter (a-z)" />
            <CheckItem satisfied={hasDigit} label="At least one number (0-9)" />
            <CheckItem satisfied={hasSpecial} label="At least one special symbol (!@#$%...)" />
            <CheckItem satisfied={notSameAsCurrent} label="Different from temporary password" />
            <CheckItem satisfied={matchesConfirm} label="Passwords match" />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pb-6">
          <Button
            type="submit"
            className="w-full bg-primary text-primary-foreground font-medium"
            disabled={submitting || signingOut}
          >
            <KeyRound className="w-4 h-4 mr-2" />
            {submitting ? "Updating Password..." : "Update Password & Continue"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={handleSignOut}
            disabled={submitting || signingOut}
            className="w-full text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-4 h-4 mr-2" />
            {signingOut ? "Signing out..." : "Sign Out"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function CheckItem({ satisfied, label }: { satisfied: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {satisfied ? (
        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
      ) : (
        <X className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
      )}
      <span className={satisfied ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
    </div>
  )
}
