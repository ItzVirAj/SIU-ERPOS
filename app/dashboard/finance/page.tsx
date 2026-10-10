import { requireAccess } from "@/lib/authz"
import { AppModule, AccessLevel } from "@/lib/prisma-client"
import { AccessDenied } from "@/components/ui/access-denied"
import { FinanceClient } from "./finance-client"

export const metadata = {
  title: "Finance & Billing | SIU-ERPOS",
  description: "Indian GST records, receivables, and subscription billing",
}

export default async function FinancePage() {
  try {
    await requireAccess(AppModule.FINANCE, AccessLevel.VIEW)
    return <FinanceClient />
  } catch {
    return <AccessDenied moduleName="Finance & Billing" />
  }
}
