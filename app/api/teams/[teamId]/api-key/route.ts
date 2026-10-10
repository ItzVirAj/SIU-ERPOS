import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handleRouteError, HttpError } from '@/lib/authz'
import { requireTeamAccess } from '@/lib/route-guards'
import { AppModule, AccessLevel } from '@/lib/prisma-client'

const updateKeySchema = z.object({
  apiKey: z.string().min(1).startsWith('gsk_', { message: 'Invalid Groq API key format (must start with gsk_)' }),
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

    const maskedKey = team.groqApiKey
      ? `${team.groqApiKey.substring(0, 8)}...${team.groqApiKey.substring(team.groqApiKey.length - 4)}`
      : null

    return NextResponse.json({ apiKey: maskedKey, hasKey: !!team.groqApiKey })
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

    await db.team.update({
      where: { id: teamId },
      data: {
        groqApiKey: apiKey,
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

