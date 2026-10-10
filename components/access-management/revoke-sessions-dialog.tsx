"use client"

import React from "react"
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
import { LogOut } from "lucide-react"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: EmployeeListItem | null
  sessionId?: string
}

export function RevokeSessionsDialog({
  open,
  onOpenChange,
  employee,
  sessionId,
}: Props) {
  const queryClient = useQueryClient()

  const revokeMutation = useMutation({
    mutationFn: () => {
      if (!employee) throw new Error("No employee selected")
      return adminClient.revokeSessions(employee.id, { sessionId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "employees"] })
      if (employee) {
        queryClient.invalidateQueries({ queryKey: ["admin", "employee", employee.id] })
      }
      toast.success(
        sessionId ? "Specific session revoked" : "All active sessions revoked"
      )
      onOpenChange(false)
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to revoke sessions")
    },
  })

  if (!employee) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] bg-[#141416] border-white/[0.08] text-foreground">
        <DialogHeader>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-1 border border-amber-500/20">
            <LogOut className="w-5 h-5" />
          </div>
          <DialogTitle className="text-lg font-semibold text-white">
            {sessionId ? "Revoke Device Session" : "Revoke All Active Sessions"}
          </DialogTitle>
          <DialogDescription className="text-xs text-neutral-400 leading-relaxed">
            {sessionId
              ? `End this active session for ${employee.fullName}? The employee will be forced to log in again on that device.`
              : `Terminate all active sessions across all devices for ${employee.fullName}? The employee will be logged out of all web and mobile browsers immediately.`}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-white/[0.08]">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={revokeMutation.isPending}
            className="text-neutral-400 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => revokeMutation.mutate()}
            disabled={revokeMutation.isPending}
            className="bg-amber-600 hover:bg-amber-700 text-white font-medium"
          >
            {revokeMutation.isPending ? "Revoking..." : "Revoke Sessions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
