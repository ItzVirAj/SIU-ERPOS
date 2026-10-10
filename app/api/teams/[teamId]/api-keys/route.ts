import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import crypto from "crypto"
import { handleRouteError } from "@/lib/authz"
import { requireTeamAccess } from "@/lib/route-guards"
import { AppModule, AccessLevel } from "@/lib/prisma-client"
import { db } from "@/lib/db"

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).default(["tasks:read", "projects:read"]),
  expiresInDays: z.number().int().positive().optional(),
}).strict()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamAccess(teamId, {
      module: AppModule.DEV_SETTINGS,
      level: AccessLevel.VIEW,
    })

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
    return handleRouteError(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const { user, userId, member } = await requireTeamAccess(teamId, {
      module: AppModule.DEV_SETTINGS,
      level: AccessLevel.WRITE,
    })

    const rawBody = await request.json()
    const { name, scopes, expiresInDays } = createApiKeySchema.parse(rawBody)

    // Generate random secure token: sk_live_<16 hex bytes>
    const rawSecret = crypto.randomBytes(24).toString("hex")
    const fullKey = `sk_live_${rawSecret}`
    const keyPrefix = `sk_live_${rawSecret.slice(0, 6)}...${rawSecret.slice(-4)}`
    const keyHash = crypto.createHash("sha256").update(fullKey).digest("hex")

    let expiresAt: Date | null = null
    if (expiresInDays && Number(expiresInDays) > 0) {
      expiresAt = new Date(Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000)
    }

    const creatorName = member.userName || user.name || "Admin"
    const creatorEmail = member.userEmail || user.email || "admin@sketchitup.internal"

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
    return handleRouteError(error)
  }
}
