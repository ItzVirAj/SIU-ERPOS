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
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { UserX } from "lucide-react"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: EmployeeListItem | null
}

export function SuspendDialog({ open, onOpenChange, employee }: Props) {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState("")

  const suspendMutation = useMutation({
    mutationFn: () => {
      if (!employee) throw new Error("No employee selected")
      return adminClient.suspendEmployee(employee.id, { reason })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "employees"] })
      if (employee) {
        queryClient.invalidateQueries({ queryKey: ["admin", "employee", employee.id] })
      }
      toast.success("Employee account suspended and sessions revoked")
      setReason("")
      onOpenChange(false)
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to suspend employee")
    },
  })

  if (!employee) return null

  const trimmedLen = reason.trim().length
  const isValid = trimmedLen >= 5 && trimmedLen <= 300

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!suspendMutation.isPending) {
          setReason("")
          onOpenChange(val)
        }
      }}
    >
      <DialogContent className="sm:max-w-[460px] bg-[#141416] border-white/[0.08] text-foreground">
        <DialogHeader>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-1 border border-amber-500/20">
            <UserX className="w-5 h-5" />
          </div>
          <DialogTitle className="text-lg font-semibold text-white">
            Suspend Employee
          </DialogTitle>
          <DialogDescription className="text-xs text-neutral-400">
            Temporarily disable system access for <span className="text-white font-medium">{employee.fullName}</span>. All active sessions will terminate immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 space-y-3">
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <Label htmlFor="suspendReason" className="text-neutral-300">
                Suspension Reason <span className="text-red-400">*</span>
              </Label>
              <span className={`text-[11px] ${trimmedLen > 300 ? "text-red-400" : "text-neutral-500"}`}>
                {trimmedLen} / 300 characters
              </span>
            </div>
            <Textarea
              id="suspendReason"
              placeholder="Provide a formal reason (5-300 characters)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={suspendMutation.isPending}
              rows={3}
              className="bg-[#1c1c1f] border-white/[0.08] text-sm resize-none"
            />
            {trimmedLen > 0 && trimmedLen < 5 && (
              <p className="text-[11px] text-amber-400">Reason must be at least 5 characters.</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-white/[0.08]">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={suspendMutation.isPending}
            className="text-neutral-400 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => suspendMutation.mutate()}
            disabled={!isValid || suspendMutation.isPending}
            className="bg-amber-600 hover:bg-amber-700 text-white font-medium"
          >
            {suspendMutation.isPending ? "Suspending..." : "Suspend Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
