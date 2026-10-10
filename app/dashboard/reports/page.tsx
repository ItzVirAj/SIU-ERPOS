import { requireAccess } from "@/lib/authz"
import { AppModule, AccessLevel } from "@/lib/prisma-client"
import { AccessDenied } from "@/components/ui/access-denied"
import { ReportsClient } from "./reports-client"

export const metadata = {
  title: "Analytics & Reports | SIU-ERPOS",
  description: "Financial summaries, sales analytics, delivery KPIs, and founder digests",
}

export default async function ReportsPage() {
  try {
    await requireAccess(AppModule.REPORTS, AccessLevel.VIEW)
    return <ReportsClient />
  } catch {
    return <AccessDenied moduleName="Analytics & Reports" />
  }
}
