import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handleRouteError, HttpError } from '@/lib/authz'
import { requireTeamAccess } from '@/lib/route-guards'
import { AppModule, AccessLevel } from '@/lib/prisma-client'
import { encryptSecret, decryptSecret } from '@/lib/secrets'

const updateKeySchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(10, { message: 'Groq API key must be at least 10 characters' })
    .max(256, { message: 'Groq API key is too long' })
    .startsWith('gsk_', { message: 'Invalid Groq API key format (must start with gsk_)' }),
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

    const team = await db.team.findUnique({
      where: { id: teamId },
      select: {
        groqApiKey: true,
      },
    })

    if (!team) {
      throw new HttpError(404, 'Team not found')
    }

    let last4: string | null = null
    if (team.groqApiKey) {
      const decrypted = decryptSecret(team.groqApiKey)
      last4 = decrypted.length >= 4 ? decrypted.slice(-4) : decrypted
    }

    return NextResponse.json({ hasKey: !!team.groqApiKey, last4 })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamAccess(teamId, {
      module: AppModule.DEV_SETTINGS,
      level: AccessLevel.WRITE,
    })

    const rawBody = await request.json()
    const { apiKey } = updateKeySchema.parse(rawBody)

    // Validate key server-side with a lightweight request (5 second timeout, never log key)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      const testRes = await fetch('https://api.groq.com/openai/v1/models', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId))

      if (!testRes.ok) {
        throw new HttpError(400, 'Key was rejected by the provider')
      }
    } catch (err) {
      if (err instanceof HttpError) throw err
      throw new HttpError(400, 'Key was rejected by the provider')
    }

    const encryptedKey = encryptSecret(apiKey)

    await db.team.update({
      where: { id: teamId },
      data: {
        groqApiKey: encryptedKey,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamAccess(teamId, {
      module: AppModule.DEV_SETTINGS,
      level: AccessLevel.MANAGE,
    })

    await db.team.update({
      where: { id: teamId },
      data: {
        groqApiKey: null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}

