import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth-server-helpers'
import { db } from '@/lib/db'
import { updateTeamSettings, getTeamSettings } from '@/lib/api/chat'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const userId = await getUserId()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is a team member
    const teamMember = await db.teamMember.findFirst({
      where: {
        teamId,
        userId,
      },
    })

    if (!teamMember) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Get team with API key
    const team = await db.team.findUnique({
      where: { id: teamId },
      select: {
        groqApiKey: true,
      },
    })

    if (!team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      )
    }

    // Return masked API key
    const maskedKey = team.groqApiKey
      ? `${team.groqApiKey.substring(0, 8)}...${team.groqApiKey.substring(team.groqApiKey.length - 4)}`
      : null

    return NextResponse.json({ apiKey: maskedKey, hasKey: !!team.groqApiKey })
  } catch (error) {
    console.error('Error fetching API key:', error)
    return NextResponse.json(
      { error: 'Failed to fetch API key' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const userId = await getUserId()
    const body = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is a team member with admin role
    const teamMember = await db.teamMember.findFirst({
      where: {
        teamId,
        userId,
        role: {
          in: ['admin', 'developer'],
        },
      },
    })

    if (!teamMember) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    // Validate API key format
    if (!body.apiKey || typeof body.apiKey !== 'string') {
      return NextResponse.json(
        { error: 'Invalid API key format' },
        { status: 400 }
      )
    }

    if (!body.apiKey.startsWith('gsk_')) {
      return NextResponse.json(
        { error: 'Invalid Groq API key format (should start with gsk_)' },
        { status: 400 }
      )
    }

    // Update team API key
    await db.team.update({
      where: { id: teamId },
      data: {
        groqApiKey: body.apiKey,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating API key:', error)
    return NextResponse.json(
      { error: 'Failed to update API key' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const userId = await getUserId()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is a team member with admin role
    const teamMember = await db.teamMember.findFirst({
      where: {
        teamId,
        userId,
        role: {
          in: ['admin', 'developer'],
        },
      },
    })

    if (!teamMember) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    // Remove team API key
    await db.team.update({
      where: { id: teamId },
      data: {
        groqApiKey: null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing API key:', error)
    return NextResponse.json(
      { error: 'Failed to remove API key' },
      { status: 500 }
    )
  }
}

