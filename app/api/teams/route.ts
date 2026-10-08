import { NextRequest, NextResponse } from 'next/server'
import { requireSession, handleRouteError } from '@/lib/authz'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession()
    const userId = session.user.id

    // Only return teams where the user is a member
    const teams = await db.team.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
      },
      include: {
        members: {
          where: {
            userId,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const teamsWithoutMembers = teams.map(({ members, ...team }) => team)
    return NextResponse.json(teamsWithoutMembers)
  } catch (error) {
    return handleRouteError(error)
  }
}
