import { NextRequest, NextResponse } from 'next/server'
import { requireTeamAdmin, handleRouteError } from '@/lib/authz'
import { db } from '@/lib/db'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamAdmin(teamId)

    await db.team.delete({
      where: { id: teamId },
    })

    return NextResponse.json({ message: 'Team deleted successfully' })
  } catch (error) {
    return handleRouteError(error)
  }
}
