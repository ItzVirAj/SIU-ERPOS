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
import { UserCheck } from "lucide-react"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: EmployeeListItem | null
}

export function RestoreDialog({ open, onOpenChange, employee }: Props) {
  const queryClient = useQueryClient()

  const restoreMutation = useMutation({
    mutationFn: () => {
      if (!employee) throw new Error("No employee selected")
      return adminClient.restoreEmployee(employee.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "employees"] })
      if (employee) {
        queryClient.invalidateQueries({ queryKey: ["admin", "employee", employee.id] })
      }
      toast.success("Employee restored to Active status")
      onOpenChange(false)
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to restore employee")
    },
  })

  if (!employee) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] bg-[#141416] border-white/[0.08] text-foreground">
        <DialogHeader>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-1 border border-emerald-500/20">
            <UserCheck className="w-5 h-5" />
          </div>
          <DialogTitle className="text-lg font-semibold text-white">
            Restore Employee Account
          </DialogTitle>
          <DialogDescription className="text-xs text-neutral-400 leading-relaxed">
            Are you sure you want to restore access for <span className="text-white font-medium">{employee.fullName}</span>? Their status will return to <span className="text-emerald-400 font-medium">Active</span> and they will be permitted to sign in again.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-white/[0.08]">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={restoreMutation.isPending}
            className="text-neutral-400 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => restoreMutation.mutate()}
            disabled={restoreMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            {restoreMutation.isPending ? "Restoring..." : "Restore Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
