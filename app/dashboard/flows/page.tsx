import { requireAccess } from "@/lib/authz"
import { AppModule, AccessLevel } from "@/lib/prisma-client"
import { AccessDenied } from "@/components/ui/access-denied"
import { FlowsClient } from "./flows-client"

export const metadata = {
  title: "Automations & Flows | SIU-ERPOS",
  description: "Cross-module workflow automation rules and visual builders",
}

export default async function FlowsPage() {
  try {
    await requireAccess(AppModule.AUTOMATIONS, AccessLevel.VIEW)
    return <FlowsClient />
  } catch {
    return <AccessDenied moduleName="Automations & Flows" />
  }
}
