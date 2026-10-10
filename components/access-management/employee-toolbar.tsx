"use client"

import React, { useEffect, useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Search, UserPlus, X, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RoleListItem } from "@/lib/types/admin"

interface Props {
  totalCount: number
  roles: RoleListItem[]
  canAddEmployee: boolean
  onAddEmployee: () => void
}

export function EmployeeToolbar({
  totalCount,
  roles,
  canAddEmployee,
  onAddEmployee,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentSearch = searchParams.get("search") || ""
  const currentRole = searchParams.get("role") || "all"
  const currentStatus = searchParams.get("status") || "all"

  const [searchTerm, setSearchTerm] = useState(currentSearch)

  useEffect(() => {
    setSearchTerm(currentSearch)
  }, [currentSearch])

  // Debounced URL update for search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== currentSearch) {
        updateQuery({ search: searchTerm.trim() ? searchTerm.trim() : null, page: "1" })
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const updateQuery = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "" || value === "all") {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })
    router.push(`${pathname}?${params.toString()}`)
  }

  const handleClearFilters = () => {
    setSearchTerm("")
    const params = new URLSearchParams()
    const activeTab = searchParams.get("tab")
    if (activeTab) params.set("tab", activeTab)
    router.push(`${pathname}?${params.toString()}`)
  }

  const hasActiveFilters = Boolean(currentSearch || currentRole !== "all" || currentStatus !== "all")

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
      {/* Search and Filters */}
      <div className="flex flex-1 items-center gap-2.5 flex-wrap">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <Input
            placeholder="Search by name, email, or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-8 bg-[#161619] border-white/[0.08] text-xs h-9 rounded-lg"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Role Filter */}
        <Select
          value={currentRole}
          onValueChange={(val) => updateQuery({ role: val, page: "1" })}
        >
          <SelectTrigger className="w-[140px] bg-[#161619] border-white/[0.08] text-xs h-9 rounded-lg text-neutral-200">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent className="bg-[#18181b] border-white/[0.08] text-xs">
            <SelectItem value="all">All Roles</SelectItem>
            {roles.map((r) => (
              <SelectItem key={r.key} value={r.key}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select
          value={currentStatus}
          onValueChange={(val) => updateQuery({ status: val, page: "1" })}
        >
          <SelectTrigger className="w-[130px] bg-[#161619] border-white/[0.08] text-xs h-9 rounded-lg text-neutral-200">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent className="bg-[#18181b] border-white/[0.08] text-xs">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
            <SelectItem value="TERMINATED">Terminated</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="h-9 px-2 text-xs text-neutral-400 hover:text-white"
          >
            Clear
          </Button>
        )}

        <span className="text-xs text-neutral-500 ml-1 hidden md:inline">
          {totalCount} {totalCount === 1 ? "employee" : "employees"}
        </span>
      </div>

      {/* Add Employee CTA */}
      {canAddEmployee && (
        <Button
          onClick={onAddEmployee}
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3.5 text-xs font-medium shrink-0 rounded-lg shadow-sm"
        >
          <UserPlus className="w-3.5 h-3.5 mr-1.5" />
          Add Employee
        </Button>
      )}
    </div>
  )
}
