import React from "react"
import Link from "next/link"
import { ShieldX, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export function AccessDenied({
  moduleName = "this section",
  description,
}: {
  moduleName?: string
  description?: string
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-2xl border border-white/[0.08] bg-[#141416] p-8 text-center space-y-4 shadow-2xl">
        <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
          <ShieldX className="w-6 h-6" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold text-white">Access Denied (403)</h2>
          <p className="text-xs text-neutral-400 leading-relaxed">
            {description ||
              `You do not have permission to access ${moduleName}. Contact your workspace administrator if you believe this is an error.`}
          </p>
        </div>

        <div className="pt-2">
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="text-xs border-white/[0.08]">
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Return to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
