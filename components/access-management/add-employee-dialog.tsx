"use client"

import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { adminClient } from "@/lib/api/admin-client"
import { RoleListItem, CreateEmployeeResponse } from "@/lib/types/admin"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Check, Copy, Info, CheckCircle2 } from "lucide-react"

const addEmployeeSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address"),
  roleKey: z.string().min(1, "Please select a role"),
  position: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  joiningDate: z.string().optional(),
})

type AddEmployeeFormValues = z.infer<typeof addEmployeeSchema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  assignableRoles: RoleListItem[]
}

export function AddEmployeeDialog({
  open,
  onOpenChange,
  assignableRoles,
}: Props) {
  const queryClient = useQueryClient()
  const [createdData, setCreatedData] = useState<CreateEmployeeResponse | null>(null)
  const [copied, setCopied] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AddEmployeeFormValues>({
    resolver: zodResolver(addEmployeeSchema),
    defaultValues: {
      fullName: "",
      email: "",
      roleKey: assignableRoles[0]?.key || "",
      position: "",
      department: "",
      phone: "",
      joiningDate: new Date().toISOString().split("T")[0],
    },
  })

  const selectedRoleKey = watch("roleKey")

  const createMutation = useMutation({
    mutationFn: (values: AddEmployeeFormValues) =>
      adminClient.createEmployee({
        ...values,
        joiningDate: values.joiningDate ? new Date(values.joiningDate).toISOString() : undefined,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "employees"] })
      toast.success("Employee provisioned successfully")
      setCreatedData(data)
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create employee")
    },
  })

  const onSubmit = (values: AddEmployeeFormValues) => {
    createMutation.mutate(values)
  }

  const handleCopyInstructions = () => {
    if (!createdData) return
    const signInUrl = typeof window !== "undefined" ? `${window.location.origin}/sign-in` : "/sign-in"
    const text = `Your account for SIU-ERPOS has been provisioned.\nSign in at: ${signInUrl}\nEmail: ${createdData.employee.email}\nYour temporary password is the company default; you will be asked to change it at first login.`
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success("Sign-in instructions copied to clipboard")
    setTimeout(() => setCopied(false), 2500)
  }

  const handleAddAnother = () => {
    reset({
      fullName: "",
      email: "",
      roleKey: assignableRoles[0]?.key || "",
      position: "",
      department: "",
      phone: "",
      joiningDate: new Date().toISOString().split("T")[0],
    })
    setCreatedData(null)
  }

  const handleClose = () => {
    setCreatedData(null)
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[540px] bg-[#141416] border-white/[0.08] text-foreground">
        {!createdData ? (
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-white">
                Add New Employee
              </DialogTitle>
              <DialogDescription className="text-sm text-neutral-400">
                Provision a verified corporate account. The employee will receive the temporary default password.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* Notice Box */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  This person receives the company default password and must change it the first time they sign in. It expires in 7 days.
                </span>
              </div>

              {/* Full Name & Work Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-xs text-neutral-300">
                    Full Name <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="fullName"
                    placeholder="Jane Doe"
                    disabled={createMutation.isPending}
                    {...register("fullName")}
                    className="bg-[#1c1c1f] border-white/[0.08] text-sm"
                  />
                  {errors.fullName && (
                    <p className="text-[11px] text-red-400">{errors.fullName.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs text-neutral-300">
                    Work Email <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="jane@company.com"
                    disabled={createMutation.isPending}
                    {...register("email")}
                    className="bg-[#1c1c1f] border-white/[0.08] text-sm"
                  />
                  {errors.email && (
                    <p className="text-[11px] text-red-400">{errors.email.message}</p>
                  )}
                </div>
              </div>

              {/* Role Select */}
              <div className="space-y-1.5">
                <Label htmlFor="roleKey" className="text-xs text-neutral-300">
                  Assigned Role <span className="text-red-400">*</span>
                </Label>
                <Select
                  value={selectedRoleKey}
                  onValueChange={(val) => setValue("roleKey", val, { shouldValidate: true })}
                  disabled={createMutation.isPending}
                >
                  <SelectTrigger
                    id="roleKey"
                    className="bg-[#1c1c1f] border-white/[0.08] text-sm text-foreground"
                  >
                    <SelectValue placeholder="Select an authorized role" />
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
                {errors.roleKey && (
                  <p className="text-[11px] text-red-400">{errors.roleKey.message}</p>
                )}
              </div>

              {/* Department & Position */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="department" className="text-xs text-neutral-300">
                    Department
                  </Label>
                  <Input
                    id="department"
                    placeholder="Engineering"
                    disabled={createMutation.isPending}
                    {...register("department")}
                    className="bg-[#1c1c1f] border-white/[0.08] text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="position" className="text-xs text-neutral-300">
                    Position / Job Title
                  </Label>
                  <Input
                    id="position"
                    placeholder="Lead Architect"
                    disabled={createMutation.isPending}
                    {...register("position")}
                    className="bg-[#1c1c1f] border-white/[0.08] text-sm"
                  />
                </div>
              </div>

              {/* Phone & Joining Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs text-neutral-300">
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    placeholder="+91 98765 43210"
                    disabled={createMutation.isPending}
                    {...register("phone")}
                    className="bg-[#1c1c1f] border-white/[0.08] text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="joiningDate" className="text-xs text-neutral-300">
                    Joining Date
                  </Label>
                  <Input
                    id="joiningDate"
                    type="date"
                    disabled={createMutation.isPending}
                    {...register("joiningDate")}
                    className="bg-[#1c1c1f] border-white/[0.08] text-sm text-neutral-200"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-white/[0.08]">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={createMutation.isPending}
                className="text-neutral-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {createMutation.isPending ? "Provisioning..." : "Create Employee"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          /* Success Confirmation Panel */
          <div className="space-y-4 py-2">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <DialogTitle className="text-lg font-semibold text-white">
                Employee Created Successfully
              </DialogTitle>
              <DialogDescription className="text-xs text-neutral-400 max-w-sm">
                Corporate credentials generated. The employee can now sign in using the company temporary password.
              </DialogDescription>
            </div>

            <div className="rounded-lg bg-[#18181b] border border-white/[0.08] p-4 space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-white/[0.05]">
                <span className="text-neutral-400">Employee Email</span>
                <span className="font-medium text-white">{createdData.employee.email}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/[0.05]">
                <span className="text-neutral-400">Assigned Role</span>
                <span className="font-medium text-white">{createdData.employee.role.name}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/[0.05]">
                <span className="text-neutral-400">Employee Code</span>
                <span className="font-mono text-neutral-200">{createdData.employee.employeeCode}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-neutral-400">Temporary Password Expiry</span>
                <span className="text-amber-400">
                  {new Date(createdData.expiresAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleCopyInstructions}
              className="w-full border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.08] text-xs justify-center gap-2"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied Sign-In Instructions" : "Copy Sign-In Instructions"}
            </Button>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-white/[0.08]">
              <Button
                type="button"
                variant="outline"
                onClick={handleAddAnother}
                className="border-white/[0.08] hover:bg-white/[0.05]"
              >
                Add Another
              </Button>
              <Button
                type="button"
                onClick={handleClose}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
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
