"use client"

import React, { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
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
import { AlertCircle } from "lucide-react"

const editEmployeeSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters").max(100),
  email: z.string().email("Invalid work email address"),
  personalEmail: z.string().email("Invalid personal email").or(z.literal("")).optional(),
  position: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  joiningDate: z.string().optional(),
})

type EditEmployeeFormValues = z.infer<typeof editEmployeeSchema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: EmployeeListItem | null
}

export function EditEmployeeDialog({ open, onOpenChange, employee }: Props) {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<EditEmployeeFormValues>({
    resolver: zodResolver(editEmployeeSchema),
    defaultValues: {
      fullName: "",
      email: "",
      personalEmail: "",
      position: "",
      department: "",
      phone: "",
      joiningDate: "",
    },
  })

  useEffect(() => {
    if (employee) {
      reset({
        fullName: employee.fullName,
        email: employee.email,
        personalEmail: employee.personalEmail || "",
        position: employee.position || "",
        department: employee.department || "",
        phone: employee.phone || "",
        joiningDate: employee.joiningDate
          ? new Date(employee.joiningDate).toISOString().split("T")[0]
          : "",
      })
    }
  }, [employee, reset])

  const currentEmail = watch("email")
  const emailChanged = employee && currentEmail.trim().toLowerCase() !== employee.email.toLowerCase()

  const updateMutation = useMutation({
    mutationFn: (values: EditEmployeeFormValues) => {
      if (!employee) throw new Error("No employee selected")
      return adminClient.updateEmployee(employee.id, {
        ...values,
        personalEmail: values.personalEmail ? values.personalEmail : undefined,
        joiningDate: values.joiningDate ? new Date(values.joiningDate).toISOString() : undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "employees"] })
      if (employee) {
        queryClient.invalidateQueries({ queryKey: ["admin", "employee", employee.id] })
      }
      toast.success("Employee profile updated")
      onOpenChange(false)
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update employee")
    },
  })

  const onSubmit = (values: EditEmployeeFormValues) => {
    updateMutation.mutate(values)
  }

  if (!employee) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-[#141416] border-white/[0.08] text-foreground">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-white">
              Edit Employee Profile
            </DialogTitle>
            <DialogDescription className="text-sm text-neutral-400">
              Update directory and contact information for {employee.fullName}.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Email change warning */}
            {emailChanged && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Notice: Changing the work email changes their sign-in username. The employee will sign in with this new email.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="editFullName" className="text-xs text-neutral-300">
                  Full Name <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="editFullName"
                  disabled={updateMutation.isPending}
                  {...register("fullName")}
                  className="bg-[#1c1c1f] border-white/[0.08] text-sm"
                />
                {errors.fullName && (
                  <p className="text-[11px] text-red-400">{errors.fullName.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="editEmail" className="text-xs text-neutral-300">
                  Work Email <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="editEmail"
                  type="email"
                  disabled={updateMutation.isPending}
                  {...register("email")}
                  className="bg-[#1c1c1f] border-white/[0.08] text-sm"
                />
                {errors.email && (
                  <p className="text-[11px] text-red-400">{errors.email.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="editDepartment" className="text-xs text-neutral-300">
                  Department
                </Label>
                <Input
                  id="editDepartment"
                  disabled={updateMutation.isPending}
                  {...register("department")}
                  className="bg-[#1c1c1f] border-white/[0.08] text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="editPosition" className="text-xs text-neutral-300">
                  Position / Title
                </Label>
                <Input
                  id="editPosition"
                  disabled={updateMutation.isPending}
                  {...register("position")}
                  className="bg-[#1c1c1f] border-white/[0.08] text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="editPhone" className="text-xs text-neutral-300">
                  Phone
                </Label>
                <Input
                  id="editPhone"
                  disabled={updateMutation.isPending}
                  {...register("phone")}
                  className="bg-[#1c1c1f] border-white/[0.08] text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="editPersonalEmail" className="text-xs text-neutral-300">
                  Personal Email
                </Label>
                <Input
                  id="editPersonalEmail"
                  type="email"
                  placeholder="Optional"
                  disabled={updateMutation.isPending}
                  {...register("personalEmail")}
                  className="bg-[#1c1c1f] border-white/[0.08] text-sm"
                />
                {errors.personalEmail && (
                  <p className="text-[11px] text-red-400">{errors.personalEmail.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editJoiningDate" className="text-xs text-neutral-300">
                Joining Date
              </Label>
              <Input
                id="editJoiningDate"
                type="date"
                disabled={updateMutation.isPending}
                {...register("joiningDate")}
                className="bg-[#1c1c1f] border-white/[0.08] text-sm text-neutral-200"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-white/[0.08]">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
              className="text-neutral-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
