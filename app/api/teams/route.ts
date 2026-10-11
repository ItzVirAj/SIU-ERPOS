import { NextRequest, NextResponse } from 'next/server'
import { requireEmployee, handleRouteError } from '@/lib/authz'
import { db } from '@/lib/db'
import { publicTeamSelect } from '@/lib/team-select'

export async function GET(request: NextRequest) {
  try {
    const { employee, session } = await requireEmployee()
    const userId = session.user.id

    // Only return teams where the user is a member
    const teams = await db.team.findMany({
      where: {
        id: employee.teamId,
      },
      select: publicTeamSelect,
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(teams)
  } catch (error) {
    return handleRouteError(error)
  }
}
