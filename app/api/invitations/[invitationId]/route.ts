import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { handleRouteError } from '@/lib/authz'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  try {
    const { invitationId } = await params

    const invitation = await db.invitation.findUnique({
      where: { id: invitationId },
    })

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }

    const isExpired =
      new Date(invitation.expiresAt) < new Date() || invitation.status !== 'pending'

    // Return only { valid, expired } with no email, role, or team data
    return NextResponse.json({
      valid: !isExpired,
      expired: isExpired,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
