import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireTeamMember, handleRouteError } from '@/lib/authz'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamMember(teamId)

    const existingTeam = await db.team.findUnique({
      where: { id: teamId },
    })

    if (!existingTeam) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    return NextResponse.json(existingTeam)
  } catch (error) {
    return handleRouteError(error)
  }
}
