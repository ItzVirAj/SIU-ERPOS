import { NextRequest, NextResponse } from "next/server";
import { requireSession, handleRouteError, HttpError } from "@/lib/authz";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

function parseDevice(userAgent: string | null = "") {
  const ua = userAgent || "";
  let browser = "Web Browser";
  let icon = "chrome";
  let os = "Unknown OS";

  // Browser detection
  if (/Brave/i.test(ua)) {
    browser = "Brave";
    icon = "brave";
  } else if (/Edg\//i.test(ua)) {
    browser = "Microsoft Edge";
    icon = "edge";
  } else if (/Firefox\//i.test(ua)) {
    browser = "Mozilla Firefox";
    icon = "firefox";
  } else if (/Chrome\//i.test(ua)) {
    browser = "Google Chrome";
    icon = "chrome";
  } else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) {
    browser = "Apple Safari";
    icon = "safari";
  } else if (/Opera|OPR\//i.test(ua)) {
    browser = "Opera";
    icon = "opera";
  }

  // OS detection
  if (/iPhone/i.test(ua)) {
    os = "iOS";
    icon = "apple";
  } else if (/iPad/i.test(ua)) {
    os = "iPadOS";
    icon = "apple";
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    os = "macOS";
    if (browser === "Apple Safari") icon = "apple";
  } else if (/Android/i.test(ua)) {
    os = "Android";
  } else if (/Windows/i.test(ua)) {
    os = "Windows";
  } else if (/Linux/i.test(ua)) {
    os = "Linux";
  }

  const deviceName = `${browser} on ${os}`;
  return { browser, os, icon, deviceName };
}

function maskIp(ip?: string | null): string {
  if (!ip) return "Unknown";
  if (ip === "::1" || ip === "127.0.0.1") return ip;
  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
    }
  }
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return `${parts.slice(0, 3).join(":")}::xxxx`;
  }
  return "Masked";
}

function formatRelativeTime(date: Date, isCurrent: boolean) {
  if (isCurrent) return "Current session";
  const diffSec = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} minutes ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
  const days = Math.floor(diffSec / 86400);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return `${Math.floor(days / 30)} months ago`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const userId = session.user.id;
    const currentToken = session.session?.token;

    const dbSessions = await db.session.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });

    const mappedSessions = dbSessions.map((s) => {
      const isCurrent = Boolean(currentToken && s.token === currentToken);
      const device = parseDevice(s.userAgent);

      return {
        id: s.id,
        isCurrent,
        deviceName: device.deviceName,
        browser: device.browser,
        os: device.os,
        icon: device.icon,
        ipAddress: maskIp(s.ipAddress),
        timeAgo: formatRelativeTime(s.updatedAt, isCurrent),
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        expiresAt: s.expiresAt,
      };
    });

    return NextResponse.json(mappedSessions);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("id");
    const revokeAllOthers =
      searchParams.get("allOther") === "true" ||
      searchParams.get("revokeAllOthers") === "true";

    // 1. Sign out all other sessions
    if (revokeAllOthers) {
      const currentToken = session.session?.token;
      const result = await db.session.deleteMany({
        where: {
          userId: session.user.id,
          ...(currentToken ? { token: { not: currentToken } } : {}),
        },
      });

      await createAuditLog({
        userId: session.user.id,
        userName: session.user.name,
        userEmail: session.user.email,
        action: "SECURITY",
        entityType: "SESSION",
        entityTitle: "Revoked all other active sessions",
        details: { count: result.count },
        ipAddress: session.session?.ipAddress,
      });

      return NextResponse.json({
        success: true,
        message: `Signed out ${result.count} other active session(s)`,
        count: result.count,
      });
    }

    // 2. Revoke a single specific session
    if (!sessionId) {
      throw new HttpError(400, "Session ID or allOther parameter is required");
    }

    const sessionToDelete = await db.session.findFirst({
      where: {
        id: sessionId,
        userId: session.user.id,
      },
    });

    if (!sessionToDelete) {
      throw new HttpError(404, "Session not found");
    }

    await db.session.delete({
      where: { id: sessionId },
    });

    await createAuditLog({
      userId: session.user.id,
      userName: session.user.name,
      userEmail: session.user.email,
      action: "SECURITY",
      entityType: "SESSION",
      entityId: sessionId,
      entityTitle: "Revoked active session",
      details: {
        device: parseDevice(sessionToDelete.userAgent).deviceName,
      },
      ipAddress: session.session?.ipAddress,
    });

    return NextResponse.json({
      success: true,
      message: "Session revoked successfully",
      removedId: sessionId,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
