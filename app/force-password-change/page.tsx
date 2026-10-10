import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { ForcePasswordChangeForm } from "./form"

export const metadata = {
  title: "Password Change Required | SIU-ERPOS",
}

export default async function ForcePasswordChangePage() {
  const reqHeaders = await headers()
  const session = await auth.api.getSession({
    headers: reqHeaders,
  })

  if (!session?.user?.id) {
    redirect("/sign-in")
  }

  const employee = await db.employee.findUnique({
    where: { userId: session.user.id },
    select: {
      mustChangePassword: true,
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  })

  if (!employee || !employee.mustChangePassword) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 mb-2">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Change Temporary Password
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            You are using a temporary password. Choose a new one to continue.
          </p>
        </div>

        <ForcePasswordChangeForm
          userEmail={employee.user.email}
          userName={employee.user.name || employee.user.email}
        />
      </div>
    </div>
  )
}
