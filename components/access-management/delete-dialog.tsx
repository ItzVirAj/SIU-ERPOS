"use client"

import React, { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { adminClient } from "@/lib/api/admin-client"
import { EmployeeListItem } from "@/lib/types/admin"
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
import { Trash2, AlertTriangle, Flame } from "lucide-react"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: EmployeeListItem | null
  isOwner: boolean
  hardDeleteEnabled: boolean
}

export function DeleteDialog({
  open,
  onOpenChange,
  employee,
  isOwner,
  hardDeleteEnabled,
}: Props) {
  const queryClient = useQueryClient()
  const [confirmEmail, setConfirmEmail] = useState("")
  const [hardConfirmEmail, setHardConfirmEmail] = useState("")
  const [showHardSection, setShowHardSection] = useState(false)

  const isTerminated = employee?.status === "TERMINATED"
  const canOfferHardDelete = hardDeleteEnabled && isOwner && isTerminated

  const deleteMutation = useMutation({
    mutationFn: (hard: boolean) => {
      if (!employee) throw new Error("No employee selected")
      return adminClient.deleteEmployee(employee.id, {
        hard,
        confirmEmail: hard ? hardConfirmEmail : confirmEmail,
      })
    },
    onSuccess: (_, hard) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "employees"] })
      if (employee) {
        queryClient.invalidateQueries({ queryKey: ["admin", "employee", employee.id] })
      }
      toast.success(
        hard
          ? "Employee permanently erased and references anonymized"
          : "Employee removed from company (terminated)"
      )
      handleClose()
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete employee")
    },
  })

  const handleClose = () => {
    if (deleteMutation.isPending) return
    setConfirmEmail("")
    setHardConfirmEmail("")
    setShowHardSection(false)
    onOpenChange(false)
  }

  if (!employee) return null

  const isSoftEmailMatch = confirmEmail.trim().toLowerCase() === employee.email.toLowerCase()
  const isHardEmailMatch = hardConfirmEmail.trim().toLowerCase() === employee.email.toLowerCase()

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-[480px] bg-[#141416] border-white/[0.08] text-foreground"
        onPointerDownOutside={(e) => {
          if (deleteMutation.isPending) e.preventDefault()
        }}
      >
        <DialogHeader>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-1 border border-rose-500/20">
            <Trash2 className="w-5 h-5" />
          </div>
          <DialogTitle className="text-lg font-semibold text-white">
            Remove from Company (Offboard)
          </DialogTitle>
          <DialogDescription className="text-xs text-neutral-400 leading-relaxed">
            Offboard <span className="text-white font-medium">{employee.fullName}</span> ({employee.email}).
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 space-y-4">
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 space-y-1.5 leading-relaxed">
            <div className="flex items-center gap-1.5 font-semibold text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              Offboarding Policy
            </div>
            <ul className="list-disc list-inside space-y-1 text-rose-300/90 pl-1 text-[11px]">
              <li>The employee is permanently marked as <span className="font-semibold">Terminated</span>.</li>
              <li>Team membership and all active sessions are revoked immediately.</li>
              <li>User profile and historical work records are preserved for audit compliance.</li>
              <li>This action cannot be undone from the user interface.</li>
            </ul>
          </div>

          {/* Email Confirmation */}
          <div className="space-y-1.5">
            <Label htmlFor="confirmEmailInput" className="text-xs text-neutral-300">
              Type <span className="font-mono text-white select-all">{employee.email}</span> to confirm:
            </Label>
            <Input
              id="confirmEmailInput"
              type="email"
              placeholder={employee.email}
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              disabled={deleteMutation.isPending || showHardSection}
              className="bg-[#1c1c1f] border-white/[0.08] text-sm font-mono"
            />
          </div>

          {/* Soft Delete Action Button */}
          {!showHardSection && (
            <div className="pt-1">
              <Button
                type="button"
                variant="destructive"
                onClick={() => deleteMutation.mutate(false)}
                disabled={!isSoftEmailMatch || deleteMutation.isPending}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-medium"
              >
                {deleteMutation.isPending ? "Offboarding Employee..." : "Confirm Offboarding"}
              </Button>
            </div>
          )}

          {/* Hard Delete Section (Only if meta.hardDeleteEnabled && actor is Owner && target is Terminated) */}
          {canOfferHardDelete && (
            <div className="mt-4 pt-4 border-t border-white/[0.08] space-y-3">
              {!showHardSection ? (
                <div className="flex items-center justify-between">
                  <div className="text-xs text-neutral-400">
                    <p className="font-medium text-neutral-300">Permanent Record Erasure</p>
                    <p className="text-[11px] text-neutral-500">Purge user and anonymize audit ties.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowHardSection(true)}
                    className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs"
                  >
                    <Flame className="w-3.5 h-3.5 mr-1" />
                    Permanently Erase
                  </Button>
                </div>
              ) : (
                <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-500/40 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-300">
                    <Flame className="w-4 h-4 text-rose-400" />
                    Permanent Hard Delete (GDPR / Data Erasure)
                  </div>
                  <p className="text-[11px] text-rose-300/80 leading-relaxed">
                    This permanently purges the user row and cascades accounts and sessions. Relational references across tasks and comments are irreversibly anonymized to &quot;Deleted user&quot;.
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="hardConfirmEmailInput" className="text-[11px] text-neutral-300">
                      Re-type <span className="font-mono text-white select-all">{employee.email}</span> to confirm permanent erasure:
                    </Label>
                    <Input
                      id="hardConfirmEmailInput"
                      type="email"
                      placeholder={employee.email}
                      value={hardConfirmEmail}
                      onChange={(e) => setHardConfirmEmail(e.target.value)}
                      disabled={deleteMutation.isPending}
                      className="bg-[#1c1c1f] border-rose-500/30 text-sm font-mono text-rose-200"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowHardSection(false)
                        setHardConfirmEmail("")
                      }}
                      disabled={deleteMutation.isPending}
                      className="text-neutral-400 hover:text-white text-xs"
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(true)}
                      disabled={!isHardEmailMatch || deleteMutation.isPending}
                      className="bg-red-700 hover:bg-red-800 text-white font-medium text-xs ml-auto"
                    >
                      {deleteMutation.isPending ? "Erasing Record..." : "Permanently Erase User"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 border-t border-white/[0.08]">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={deleteMutation.isPending}
            className="w-full text-neutral-400 hover:text-white"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
