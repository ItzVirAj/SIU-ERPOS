import { requireAccess } from "@/lib/authz"
import { AppModule, AccessLevel } from "@/lib/prisma-client"
import { AccessDenied } from "@/components/ui/access-denied"
import { ManagementClient } from "./management-client"

export const metadata = {
  title: "Audit & Workspace Management | SIU-ERPOS",
  description: "Enterprise audit log trails, workspace telemetry, and administrative controls",
}

export default async function ManagementPage() {
  try {
    await requireAccess(AppModule.AUDIT_LOGS, AccessLevel.VIEW)
    return <ManagementClient />
  } catch {
    return <AccessDenied moduleName="Audit & Workspace Management" />
  }
}
