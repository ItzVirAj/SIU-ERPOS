import { NextResponse } from 'next/server'
import {
  requireAccess,
  handleRouteError,
} from '@/lib/authz'
import { AppModule, AccessLevel } from '@/lib/prisma-client'
import { ROLE_DEFINITIONS } from '@/lib/role-definitions'
import { canProvision } from '@/lib/employee-policy'

export async function GET() {
  try {
    const actor = await requireAccess(AppModule.EMPLOYEES, AccessLevel.VIEW)
    const isProvisioner = canProvision(actor.role.key)
    const isOwner = actor.role.key === 'owner'

    const roles = ROLE_DEFINITIONS.map((r) => {
      let assignable = false
      if (isProvisioner) {
        if (isOwner) {
          // Owner can assign any role except owner directly through normal creation
          assignable = true
        } else {
          assignable = actor.role.level > r.level
        }
      }

      return {
        key: r.key,
        name: r.name,
        description: r.description,
        level: r.level,
        access: r.access,
        assignable,
      }
    })

    const hardDeleteEnabled = process.env.ALLOW_HARD_DELETE === '1'

    const response = NextResponse.json({
      roles,
      meta: {
        hardDeleteEnabled,
      },
    })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    return handleRouteError(error)
  }
}
