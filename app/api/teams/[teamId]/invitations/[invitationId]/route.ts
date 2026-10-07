import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth-server-helpers'
import { db } from '@/lib/db'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; invitationId: string }> }
) {
  try {
    const { teamId, invitationId } = await params
    const userId = await getUserId()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    await db.invitation.delete({
      where: {
        id: invitationId,
        teamId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting invitation:', error)
    return NextResponse.json(
      { error: 'Failed to delete invitation' },
      { status: 500 }
    )
  }
}

