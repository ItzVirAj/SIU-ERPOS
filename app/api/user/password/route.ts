import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { requireEmployee, handleRouteError, HttpError } from "@/lib/authz"
import { db } from "@/lib/db"
import { validateNewPassword } from "@/lib/passwords"
import { createAuditLog } from "@/lib/audit"

const passwordSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: z.string().min(12, "Password must be at least 12 characters long"),
  })
  .strict()

export async function POST(request: NextRequest) {
  try {
    const { session } = await requireEmployee({ allowPasswordChangePending: true })
    const rawBody = await request.json()
    const { currentPassword, newPassword } = passwordSchema.parse(rawBody)

    const problems = validateNewPassword(newPassword, {
      email: session.user.email,
      currentPasswordMatches: Boolean(currentPassword && currentPassword === newPassword),
    })

    if (problems.length > 0) {
      throw new HttpError(400, problems.join(". "))
    }

    const reqHeaders = await headers()
    const ip =
      reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      reqHeaders.get("x-real-ip")

    // Check if user has an existing credential account
    const account = await db.account.findFirst({
      where: {
        userId: session.user.id,
        providerId: "credential",
      },
    })

    if (account && account.password) {
      if (!currentPassword) {
        throw new HttpError(400, "Current password is required")
      }

      try {
        await auth.api.changePassword({
          body: {
            currentPassword,
            newPassword,
            revokeOtherSessions: true,
          },
          headers: reqHeaders,
        })

        // Clear mustChangePassword and defaultPasswordExpiresAt
        await db.employee.updateMany({
          where: { userId: session.user.id },
          data: {
            mustChangePassword: false,
            defaultPasswordExpiresAt: null,
          },
        })

        await createAuditLog({
          userId: session.user.id,
          userName: session.user.name,
          userEmail: session.user.email,
          action: "SECURITY",
          entityType: "USER_PASSWORD",
          entityId: session.user.id,
          entityTitle: "Password changed (other sessions revoked)",
          ipAddress: ip,
        })

        return NextResponse.json({
          success: true,
          message:
            "Password changed successfully. Other active sessions have been revoked.",
        })
      } catch (err: any) {
        throw new HttpError(400, err.message || "Invalid current password")
      }
    } else {
      // User signed up with OAuth or has no password yet - set initial password
      try {
        await auth.api.setPassword({
          body: {
            newPassword,
          },
          headers: reqHeaders,
        })

        // Clear mustChangePassword and defaultPasswordExpiresAt
        await db.employee.updateMany({
          where: { userId: session.user.id },
          data: {
            mustChangePassword: false,
            defaultPasswordExpiresAt: null,
          },
        })

        await createAuditLog({
          userId: session.user.id,
          userName: session.user.name,
          userEmail: session.user.email,
          action: "SECURITY",
          entityType: "USER_PASSWORD",
          entityId: session.user.id,
          entityTitle: "Initial password configured",
          ipAddress: ip,
        })

        return NextResponse.json({
          success: true,
          message: "Password set successfully",
        })
      } catch (err: any) {
        throw new HttpError(400, err.message || "Failed to set password")
      }
    }
  } catch (error) {
    return handleRouteError(error)
  }
}
