import { NextRequest } from 'next/server'
import { handleRouteError, HttpError } from "@/lib/authz"
import { requireTeamAccess } from '@/lib/route-guards'

export async function POST(
  _request: NextRequest,
  _context: { params: Promise<{ teamId: string; invitationId: string }> }
) {
  // Invitation acceptance is deprecated in favor of closed enterprise provisioning
  return handleRouteError(
    new HttpError(
      410,
      'Invitation acceptance is disabled. All employees and team members are provisioned directly by company administrators.'
    )
  )
}

