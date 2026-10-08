import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "./auth"
import { db } from "./db"

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = "HttpError"
  }
}

export const ROLE_HIERARCHY = {
  viewer: 1,
  developer: 2,
  admin: 3,
} as const

export type TeamRole = keyof typeof ROLE_HIERARCHY

export function getRoleRank(role: string): number {
  const normalized = (role || "").toLowerCase().trim()
  if (["admin", "owner", "ceo", "cto"].includes(normalized)) return 3
  if (
    [
      "developer",
      "finance_manager",
      "project_manager",
      "sales_manager",
      "team_lead",
      "accountant",
      "sales_executive",
    ].includes(normalized)
  ) {
    return 2
  }
  if (normalized === "viewer") return 1
  return ROLE_HIERARCHY[normalized as TeamRole] ?? 0
}

/**
 * Validates session using Better Auth.
 * Throws HttpError(401) if unauthenticated.
 */
export async function requireSession() {
  const reqHeaders = await headers()
  const session = await auth.api.getSession({
    headers: reqHeaders,
  })

  if (!session?.user?.id) {
    throw new HttpError(401, "Authentication required")
  }

  return session
}

/**
 * Returns current session or null if not authenticated.
 */
export async function getSession() {
  const reqHeaders = await headers()
  return await auth.api.getSession({
    headers: reqHeaders,
  })
}

export async function getSessionOrNull() {
  return await getSession()
}

/**
 * Returns authenticated user ID or throws HttpError(401).
 */
export async function getUserId(): Promise<string> {
  const session = await requireSession()
  return session.user.id
}

export async function requireUserId(): Promise<string> {
  return await getUserId()
}

/**
 * Returns authenticated user object or throws HttpError(401).
 */
export async function getUser() {
  const session = await requireSession()
  return session.user
}

/**
 * Verifies that the authenticated user is an active member of the given team,
 * and optionally checks that their role meets the minimum role hierarchy requirement.
 * Throws HttpError(401) if not logged in, or HttpError(403) if not authorized.
 */
export async function requireTeamMember(teamId: string, minRole?: TeamRole) {
  if (!teamId || typeof teamId !== "string") {
    throw new HttpError(400, "Team ID is required")
  }

  const session = await requireSession()
  const user = session.user
  const userId = user.id

  const member = await db.teamMember.findFirst({
    where: {
      teamId,
      userId,
    },
  })

  if (!member) {
    throw new HttpError(403, "Access denied: Not a member of this team")
  }

  if (minRole) {
    const requiredRank = ROLE_HIERARCHY[minRole] ?? 1
    const actualRank = getRoleRank(member.role)
    if (actualRank < requiredRank) {
      throw new HttpError(
        403,
        `Access denied: Action requires at least '${minRole}' role`
      )
    }
  }

  return {
    session,
    user,
    userId,
    member,
  }
}

/**
 * Convenience helper to enforce admin role for a team.
 */
export async function requireTeamAdmin(teamId: string) {
  return await requireTeamMember(teamId, "admin")
}

/**
 * Check if a user belongs to a team without throwing.
 */
export async function isTeamMember(teamId: string, userId: string): Promise<boolean> {
  if (!teamId || !userId) return false
  const member = await db.teamMember.findFirst({
    where: { teamId, userId },
  })
  return !!member
}

/**
 * Verify team membership for a specific userId, throwing HttpError(403) if not found.
 */
export async function verifyTeamMembership(teamId: string, userId: string): Promise<void> {
  const isMember = await isTeamMember(teamId, userId)
  if (!isMember) {
    throw new HttpError(403, "Access denied: Not a member of this team")
  }
}

/**
 * Centralized error handler for Next.js App Router API handlers.
 * Maps HttpError to the appropriate status and message.
 * Maps ZodError to 400 with validation details.
 * Prevents leaking database/internal error stack traces.
 */
export function handleRouteError(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status }
    )
  }

  if (error instanceof z.ZodError) {
    const issues = error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }))
    return NextResponse.json(
      { error: "Validation error", issues },
      { status: 400 }
    )
  }

  // Generic 500 without leaking sensitive schema or database details
  console.error("[API_ROUTE_ERROR]", error instanceof Error ? error.message : error)
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  )
}
