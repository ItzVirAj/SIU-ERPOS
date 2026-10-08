import { db } from "@/lib/db";

export interface LogAuditParams {
  userId?: string;
  userName?: string;
  userEmail?: string;
  teamId?: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "SECURITY" | "EXPORT" | "LOGIN";
  entityType: string;
  entityId?: string;
  entityTitle?: string;
  details?: Record<string, any>;
  ipAddress?: string | null;
}

/**
 * Mask IP addresses for privacy/security compliance (e.g. 192.168.1.100 -> 192.168.1.xxx)
 */
function maskIp(ip?: string | null): string | null {
  if (!ip) return null;
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
  return "masked";
}

export async function createAuditLog(params: LogAuditParams) {
  try {
    let resolvedTeamId = params.teamId;

    // If teamId not explicitly provided, find the primary team for the user
    if (!resolvedTeamId && params.userId) {
      const membership = await db.teamMember.findFirst({
        where: { userId: params.userId },
        select: { teamId: true, userName: true, userEmail: true },
      });
      if (membership) {
        resolvedTeamId = membership.teamId;
        params.userName = params.userName || membership.userName;
        params.userEmail = params.userEmail || membership.userEmail;
      }
    }

    // Fallback to first team if still unresolved
    if (!resolvedTeamId) {
      const fallbackTeam = await db.team.findFirst({ select: { id: true } });
      resolvedTeamId = fallbackTeam?.id;
    }

    if (!resolvedTeamId) {
      return; // Cannot log without a team relation in current schema
    }

    await db.auditLog.create({
      data: {
        teamId: resolvedTeamId,
        userId: params.userId || "system",
        userName: params.userName || "System / Unauthenticated",
        userEmail: params.userEmail || "system@internal",
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        entityTitle: params.entityTitle || params.action,
        details: params.details || {},
        ipAddress: maskIp(params.ipAddress),
      },
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}
