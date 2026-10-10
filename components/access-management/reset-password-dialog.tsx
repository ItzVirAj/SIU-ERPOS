"use client"

import React, { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { adminClient } from "@/lib/api/admin-client"
import { EmployeeListItem, ResetPasswordResponse } from "@/lib/types/admin"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { KeyRound, ShieldAlert, CheckCircle2, Lock } from "lucide-react"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: EmployeeListItem | null
}

export function ResetPasswordDialog({ open, onOpenChange, employee }: Props) {
  const queryClient = useQueryClient()
  const [actorPassword, setActorPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [resetSuccessData, setResetSuccessData] = useState<ResetPasswordResponse | null>(null)

  const resetMutation = useMutation({
    mutationFn: () => {
      if (!employee) throw new Error("No employee selected")
      return adminClient.resetPassword(employee.id, {
        actorPassword,
      })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "employees"] })
      if (employee) {
        queryClient.invalidateQueries({ queryKey: ["admin", "employee", employee.id] })
      }
      toast.success("Employee password reset successfully")
      setActorPassword("")
      setErrorMessage(null)
      setResetSuccessData(data)
    },
    onError: (err: any) => {
      setActorPassword("")
      if (err.status === 401 || err.status === 403) {
        setErrorMessage("Incorrect administrator password. Please try again.")
      } else if (err.status === 429) {
        setErrorMessage("Too many failed re-authentication attempts. Please wait 15 minutes before trying again.")
      } else {
        setErrorMessage(err.message || "Failed to reset password")
      }
    },
  })

  const handleClose = () => {
    setActorPassword("")
    setErrorMessage(null)
    setResetSuccessData(null)
    onOpenChange(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!actorPassword) return
    setErrorMessage(null)
    resetMutation.mutate()
  }

  if (!employee) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[460px] bg-[#141416] border-white/[0.08] text-foreground">
        {!resetSuccessData ? (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-1 border border-amber-500/20">
                <KeyRound className="w-5 h-5" />
              </div>
              <DialogTitle className="text-lg font-semibold text-white">
                Reset Employee Password
              </DialogTitle>
              <DialogDescription className="text-xs text-neutral-400">
                Reset credentials for <span className="text-white font-medium">{employee.fullName}</span> ({employee.email}).
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              <div className="p-3 rounded-lg bg-[#18181b] border border-white/[0.06] space-y-1.5 text-xs text-neutral-300">
                <p className="font-medium text-white flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-400" /> Security Impact
                </p>
                <ul className="list-disc list-inside space-y-1 text-neutral-400 pl-1 text-[11px] leading-relaxed">
                  <li>Their password resets to the company default password.</li>
                  <li>All active sessions on all devices are revoked immediately.</li>
                  <li>They will be forced to change it at their next login within 7 days.</li>
                </ul>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                  {errorMessage}
                </div>
              )}

              {/* Step-up Re-authentication */}
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="actorPasswordInput" className="text-xs text-neutral-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-neutral-400" />
                  Confirm Your Administrator Password <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="actorPasswordInput"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your current password to authorize"
                  value={actorPassword}
                  onChange={(e) => setActorPassword(e.target.value)}
                  disabled={resetMutation.isPending}
                  className="bg-[#1c1c1f] border-white/[0.08] text-sm"
                  autoFocus
                />
                <p className="text-[11px] text-neutral-500">
                  Step-up authentication is required to reset employee credentials.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-white/[0.08]">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={resetMutation.isPending}
                className="text-neutral-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!actorPassword || resetMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700 text-white font-medium"
              >
                {resetMutation.isPending ? "Verifying & Resetting..." : "Reset Password"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          /* Reset Success State */
          <div className="space-y-4 py-2">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <DialogTitle className="text-lg font-semibold text-white">
                Password Reset Applied
              </DialogTitle>
              <DialogDescription className="text-xs text-neutral-400 max-w-sm">
                The employee&apos;s password has been reset to the company default and all their active sessions have been revoked.
              </DialogDescription>
            </div>

            <div className="rounded-lg bg-[#18181b] border border-white/[0.08] p-4 space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-white/[0.05]">
                <span className="text-neutral-400">Employee</span>
                <span className="font-medium text-white">{employee.fullName}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-neutral-400">Temporary Password Expires</span>
                <span className="text-amber-400 font-medium">
                  {new Date(resetSuccessData.expiresAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>

            <DialogFooter className="pt-2 border-t border-white/[0.08]">
              <Button
                type="button"
                onClick={handleClose}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
