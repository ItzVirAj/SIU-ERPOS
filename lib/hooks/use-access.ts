"use client"

import { useQuery } from "@tanstack/react-query"
import { adminClient } from "@/lib/api/admin-client"
import { AppModule, AccessLevel } from "@/lib/prisma-client"
import { hasAccess } from "@/lib/permissions"
import { MyAccessResponse } from "@/lib/types/admin"

export function useAccess() {
  const query = useQuery<MyAccessResponse, Error>({
    queryKey: ["my-access"],
    queryFn: () => adminClient.getMyAccess(),
    staleTime: 60_000,
    retry: 1,
  })

  const access = query.data?.access
  const role = query.data?.role
  const employee = query.data?.employee

  const can = (module: AppModule, level: AccessLevel): boolean => {
    return hasAccess(access, module, level)
  }

  return {
    ...query,
    access,
    role,
    employee,
    can,
  }
}
