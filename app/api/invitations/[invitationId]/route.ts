import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { handleRouteError } from '@/lib/authz'

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***'
  const [user, domain] = email.split('@')
  if (user.length <= 2) {
    return `${user[0]}***@${domain}`
  }
  return `${user[0]}***${user[user.length - 1]}@${domain}`
}

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

    const isExpired = new Date(invitation.expiresAt) < new Date() || invitation.status !== 'pending'

    // Return non-sensitive status and masked email only (never plain email, role, or teamId)
    return NextResponse.json({
      id: invitation.id,
      valid: !isExpired,
      status: isExpired && invitation.status === 'pending' ? 'expired' : invitation.status,
      maskedEmail: maskEmail(invitation.email),
      expiresAt: invitation.expiresAt,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
