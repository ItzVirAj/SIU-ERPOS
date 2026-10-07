import { NextRequest, NextResponse } from 'next/server'
import { getUserId, getUser } from '@/lib/auth-server-helpers'
import { db } from '@/lib/db'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const userId = await getUserId()
    
    // Check if team exists
    const team = await db.team.findUnique({
      where: { id: teamId },
      include: {
        members: true,
      },
    })

    if (!team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      )
    }

    // Check if user is an admin of the team
    const member = team.members.find(m => m.userId === userId)
    if (!member || member.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized: Only admins can delete teams' },
        { status: 403 }
      )
    }

    // Delete the team (cascade will handle related data)
    await db.team.delete({
      where: { id: teamId },
    })

    return NextResponse.json({ message: 'Team deleted successfully' })
  } catch (error) {
    console.error('Error deleting team:', error)
    return NextResponse.json(
      { error: 'Failed to delete team' },
      { status: 500 }
    )
  }
}

