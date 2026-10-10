import { requireAccess } from "@/lib/authz"
import { AppModule, AccessLevel } from "@/lib/prisma-client"
import { AccessDenied } from "@/components/ui/access-denied"
import { CrmClient } from "./crm-client"

export const metadata = {
  title: "CRM & Leads | SIU-ERPOS",
  description: "Sales pipeline, lead management, and conversion tracking",
}

export default async function CrmPage() {
  try {
    await requireAccess(AppModule.CRM, AccessLevel.VIEW)
    return <CrmClient />
  } catch {
    return <AccessDenied moduleName="CRM & Leads" />
  }
}
