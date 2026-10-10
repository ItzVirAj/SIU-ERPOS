import { NextRequest } from 'next/server'
import { handleRouteError, HttpError } from '@/lib/authz'
import { requireTeamAccess } from '@/lib/route-guards'
import { AppModule, AccessLevel } from '@/lib/prisma-client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; invitationId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamAccess(teamId, { module: AppModule.EMPLOYEES, level: AccessLevel.WRITE })
    throw new HttpError(
      410,
      'Email invitation resend is disabled. All employees are provisioned via Access Management.'
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
