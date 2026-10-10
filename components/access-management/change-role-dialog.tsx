"use client"

import React, { useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { adminClient } from "@/lib/api/admin-client"
import { EmployeeListItem, RoleListItem } from "@/lib/types/admin"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertCircle, ShieldAlert } from "lucide-react"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: EmployeeListItem | null
  assignableRoles: RoleListItem[]
  canProvision: boolean
}

export function ChangeRoleDialog({
  open,
  onOpenChange,
  employee,
  assignableRoles,
  canProvision,
}: Props) {
  const queryClient = useQueryClient()
  const [selectedRoleKey, setSelectedRoleKey] = useState<string>("")
  const [signoutAcknowledged, setSignoutAcknowledged] = useState<boolean>(false)
  const [confirmSecondOwner, setConfirmSecondOwner] = useState<boolean>(false)

  useEffect(() => {
    if (employee) {
      setSelectedRoleKey(employee.role.key)
      setSignoutAcknowledged(false)
      setConfirmSecondOwner(false)
    }
  }, [employee, open])

  const isAssigningOwner = selectedRoleKey === "owner"
  const isSameRole = employee?.role.key === selectedRoleKey

  const changeRoleMutation = useMutation({
    mutationFn: () => {
      if (!employee) throw new Error("No employee selected")
      return adminClient.changeRole(employee.id, {
        roleKey: selectedRoleKey,
        confirmSecondOwner: isAssigningOwner ? confirmSecondOwner : undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "employees"] })
      if (employee) {
        queryClient.invalidateQueries({ queryKey: ["admin", "employee", employee.id] })
      }
      toast.success("Employee role updated successfully")
      onOpenChange(false)
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update role")
    },
  })

  if (!employee) return null

  const isSubmitDisabled =
    !canProvision ||
    isSameRole ||
    !signoutAcknowledged ||
    (isAssigningOwner && !confirmSecondOwner) ||
    changeRoleMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-[#141416] border-white/[0.08] text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-white">
            Change Employee Role
          </DialogTitle>
          <DialogDescription className="text-sm text-neutral-400">
            Reassign permissions for <span className="text-white font-medium">{employee.fullName}</span>.
          </DialogDescription>
        </DialogHeader>

        {!canProvision ? (
          <div className="py-4">
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">
              Only Owner, HR, and CTO roles are authorized to change employee roles.
            </div>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            {/* Current Role Info */}
            <div className="flex justify-between items-center p-3 rounded-lg bg-[#18181b] border border-white/[0.06] text-xs">
              <span className="text-neutral-400">Current Role</span>
              <span className="font-medium text-white">{employee.role.name}</span>
            </div>

            {/* Role Selection */}
            <div className="space-y-1.5">
              <Label htmlFor="changeRoleSelect" className="text-xs text-neutral-300">
                New Role <span className="text-red-400">*</span>
              </Label>
              <Select
                value={selectedRoleKey}
                onValueChange={setSelectedRoleKey}
                disabled={changeRoleMutation.isPending}
              >
                <SelectTrigger
                  id="changeRoleSelect"
                  className="bg-[#1c1c1f] border-white/[0.08] text-sm text-foreground"
                >
                  <SelectValue placeholder="Select an assignable role" />
                </SelectTrigger>
                <SelectContent className="bg-[#18181b] border-white/[0.08]">
                  {assignableRoles.map((r) => (
                    <SelectItem key={r.key} value={r.key} className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{r.name}</span>
                        <span className="text-xs text-neutral-400">(Level {r.level})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Revocation Warning */}
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 leading-relaxed">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Changing this role will revoke all active sessions for this employee immediately to enforce the updated permission level.
              </span>
            </div>

            {/* Second Owner Warning & Confirmation */}
            {isAssigningOwner && (
              <div className="space-y-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="font-semibold text-rose-200">
                    High Privilege Action: Co-Owner Role
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-rose-300/90 pl-6">
                  Assigning the Owner role grants complete control, including user deletion and system administration.
                </p>
                <div className="flex items-center gap-2 pt-1 pl-6">
                  <Checkbox
                    id="confirmSecondOwnerCheck"
                    checked={confirmSecondOwner}
                    onCheckedChange={setConfirmSecondOwner}
                  />
                  <label
                    htmlFor="confirmSecondOwnerCheck"
                    className="text-xs text-rose-200 font-medium cursor-pointer"
                  >
                    I explicitly confirm granting co-owner privileges
                  </label>
                </div>
              </div>
            )}

            {/* Required Session Revocation Acknowledgement */}
            <div className="flex items-start gap-2 pt-1">
              <Checkbox
                id="signoutAcknowledgedCheck"
                checked={signoutAcknowledged}
                onCheckedChange={setSignoutAcknowledged}
                disabled={changeRoleMutation.isPending}
              />
              <label
                htmlFor="signoutAcknowledgedCheck"
                className="text-xs text-neutral-300 cursor-pointer leading-tight select-none"
              >
                I understand this person will be signed out everywhere immediately.
              </label>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-white/[0.08]">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={changeRoleMutation.isPending}
            className="text-neutral-400 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => changeRoleMutation.mutate()}
            disabled={isSubmitDisabled}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {changeRoleMutation.isPending ? "Updating Role..." : "Update Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
