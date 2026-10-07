import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth-server-helpers";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const reqHeaders = await headers();

    // Check if user has an existing credential account
    const account = await db.account.findFirst({
      where: {
        userId: session.user.id,
        providerId: "credential",
      },
    });

    if (account && account.password) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required" },
          { status: 400 }
        );
      }

      try {
        await auth.api.changePassword({
          body: {
            currentPassword,
            newPassword,
            revokeOtherSessions: false,
          },
          headers: reqHeaders,
        });
        return NextResponse.json({
          success: true,
          message: "Password changed successfully",
        });
      } catch (err: any) {
        return NextResponse.json(
          { error: err.message || "Invalid current password" },
          { status: 400 }
        );
      }
    } else {
      // User signed up with OAuth or has no password yet - set initial password
      try {
        await auth.api.setPassword({
          body: {
            newPassword,
          },
          headers: reqHeaders,
        });
        return NextResponse.json({
          success: true,
          message: "Password set successfully",
        });
      } catch (err: any) {
        return NextResponse.json(
          { error: err.message || "Failed to set password" },
          { status: 400 }
        );
      }
    }
  } catch (error: any) {
    console.error("Password update error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update password" },
      { status: 500 }
    );
  }
}
