import { requireAccess } from "@/lib/authz"
import { AppModule, AccessLevel } from "@/lib/prisma-client"
import { AccessDenied } from "@/components/ui/access-denied"
import { ProductsClient } from "./products-client"

export const metadata = {
  title: "SaaS Products & IP | SIU-ERPOS",
  description: "Product roadmap, feature requests, pilot customer tracking, and reusable components",
}

export default async function ProductsPage() {
  try {
    await requireAccess(AppModule.PRODUCTS, AccessLevel.VIEW)
    return <ProductsClient />
  } catch {
    return <AccessDenied moduleName="SaaS Products & IP" />
  }
}
