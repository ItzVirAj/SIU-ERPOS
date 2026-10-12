import { requireAccess } from "@/lib/authz"
import { AppModule, AccessLevel } from "@/lib/prisma-client"
import { AccessDenied } from "@/components/ui/access-denied"
import { HrClient } from "./hr-client"

export const metadata = {
  title: "People Operations (HR Lite) | SIU-ERPOS",
  description: "Staff directory, leave balances, remote attendance, onboarding & hiring pipeline",
}

export default async function HrPage() {
  try {
    await requireAccess(AppModule.EMPLOYEES, AccessLevel.VIEW)
    return <HrClient />
  } catch {
    return <AccessDenied moduleName="People Operations (HR)" />
  }
}
