import { requireAccess } from "@/lib/authz"
import { AppModule, AccessLevel } from "@/lib/prisma-client"
import { AccessDenied } from "@/components/ui/access-denied"
import { TimesheetsClient } from "./timesheets-client"

export const metadata = {
  title: "Timesheets & Resource Planning | SIU-ERPOS",
  description: "Work log timers, weekly approvals, capacity planning & estimate accuracy",
}

export default async function TimesheetsPage() {
  try {
    await requireAccess(AppModule.WORK, AccessLevel.VIEW)
    return <TimesheetsClient />
  } catch {
    return <AccessDenied moduleName="Timesheets & Planning" />
  }
}
