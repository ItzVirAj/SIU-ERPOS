import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/auth-server-helpers"
import { db } from "@/lib/db"
import crypto from "crypto"

// GET /api/teams/[teamId]/api-keys - List developer API keys for the team
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const userId = await getUserId()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const membership = await db.teamMember.findFirst({
      where: { teamId, userId },
    })

    if (!membership) {
      return NextResponse.json({ error: "Forbidden: Not a team member" }, { status: 403 })
    }

    const keys = await db.developerApiKey.findMany({
      where: { teamId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        createdBy: true,
        createdByName: true,
        lastUsedAt: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ keys })
  } catch (error) {
    console.error("Error fetching API keys:", error)
    return NextResponse.json({ error: "Failed to fetch API keys" }, { status: 500 })
  }
}

// POST /api/teams/[teamId]/api-keys - Create a new developer API key
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const userId = await getUserId()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const membership = await db.teamMember.findFirst({
      where: {
        teamId,
        userId,
        role: { in: ["admin", "developer"] },
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "Forbidden: Admin/Developer role required" }, { status: 403 })
    }

    const body = await request.json()
    const { name, scopes = ["tasks:read", "projects:read"], expiresInDays } = body

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Key name is required" }, { status: 400 })
    }

    // Generate random secure token: sk_live_<16 hex bytes>
    const rawSecret = crypto.randomBytes(24).toString("hex")
    const fullKey = `sk_live_${rawSecret}`
    const keyPrefix = `sk_live_${rawSecret.slice(0, 6)}...${rawSecret.slice(-4)}`
    const keyHash = crypto.createHash("sha256").update(fullKey).digest("hex")

    let expiresAt: Date | null = null
    if (expiresInDays && Number(expiresInDays) > 0) {
      expiresAt = new Date(Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000)
    }

    const creatorName = membership.userName || "Admin"
    const creatorEmail = membership.userEmail || "admin@sketchitup.internal"

    const createdKey = await db.developerApiKey.create({
      data: {
        teamId,
        name: name.trim(),
        keyPrefix,
        keyHash,
        scopes,
        createdBy: userId,
        createdByName: creatorName,
        expiresAt,
        isActive: true,
      },
    })

    // Create Audit Log entry
    await db.auditLog.create({
      data: {
        teamId,
        userId,
        userName: creatorName,
        userEmail: creatorEmail,
        action: "CREATE",
        entityType: "API_KEY",
        entityId: createdKey.id,
        entityTitle: createdKey.name,
        details: {
          name: createdKey.name,
          keyPrefix: createdKey.keyPrefix,
          scopes,
        },
      },
    })

    // Return the secret key ONLY once on creation
    return NextResponse.json({
      apiKey: {
        id: createdKey.id,
        name: createdKey.name,
        keyPrefix: createdKey.keyPrefix,
        secretKey: fullKey,
        scopes: createdKey.scopes,
        createdByName: creatorName,
        createdAt: createdKey.createdAt,
        expiresAt: createdKey.expiresAt,
      },
      warning: "Copy this key now. You will not be able to see it again!",
    })
  } catch (error) {
    console.error("Error creating API key:", error)
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 })
  }
}
