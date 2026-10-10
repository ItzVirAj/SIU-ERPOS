import { NextRequest, NextResponse } from 'next/server'
import { handleRouteError, HttpError } from '@/lib/authz'
import { requireTeamAccess } from '@/lib/route-guards'
import { AppModule, AccessLevel } from '@/lib/prisma-client'
import { writeAudit, AUDIT_ACTIONS } from '@/lib/audit'
import { db } from '@/lib/db'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const actor = await requireTeamAccess(teamId, {
      module: AppModule.COMPANY_SETTINGS,
      level: AccessLevel.MANAGE,
    })

    if (actor.role.key !== 'owner') {
      throw new HttpError(403, 'Forbidden: Only the Owner can delete the team', 'FORBIDDEN')
    }

    const team = await db.team.findUnique({
      where: { id: teamId },
    })

    if (!team) {
      throw new HttpError(404, 'Team not found', 'TEAM_NOT_FOUND')
    }

    let body: any = {}
    try {
      body = await request.json()
    } catch {}

    if (!body?.confirmName || body.confirmName !== team.name) {
      throw new HttpError(400, 'Confirmation team name does not match', 'CONFIRM_NAME_MISMATCH')
    }

    await writeAudit(db, {
      actor: {
        id: actor.userId,
        name: actor.employee.fullName,
        email: actor.employee.email,
        role: actor.role.key,
      },
      action: AUDIT_ACTIONS.TEAM_DELETE,
      target: { id: team.id, email: team.name },
      before: { teamId: team.id, name: team.name },
    })

    await db.team.delete({
      where: { id: teamId },
    })

    return NextResponse.json({ message: 'Team deleted successfully' })
  } catch (error) {
    return handleRouteError(error)
  }
}
