import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { handleRouteError } from "@/lib/authz";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamAccess(teamId, { module: AppModule.WORK, level: AccessLevel.WRITE })

    const existingTeam = await db.team.findUnique({
      where: { id: teamId },
    })

    if (!existingTeam) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    return NextResponse.json(existingTeam)
  } catch (error) {
    return handleRouteError(error)
  }
}
