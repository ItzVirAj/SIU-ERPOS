import { NextRequest, NextResponse } from "next/server"
import { requireTeamAccess } from "@/lib/route-guards"
import { handleRouteError } from "@/lib/authz"
import { AppModule, AccessLevel, TimesheetStatus } from "@/lib/prisma-client"
import { db } from "@/lib/db"

function getStartOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday (start on Monday)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getEndOfWeek(startDate: Date): Date {
  const d = new Date(startDate)
  d.setDate(d.getDate() + 6)
  d.setHours(23, 59, 59, 999)
  return d
}

// GET /api/teams/[teamId]/timesheets
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const actor = await requireTeamAccess(teamId, {
      module: AppModule.WORK,
      level: AccessLevel.VIEW,
    })

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get("status") as TimesheetStatus | null
    const userIdParam = searchParams.get("userId")
    const weekStartParam = searchParams.get("weekStartDate")
    const scope = searchParams.get("scope") || "my" // "my" | "team"

    const isManager =
      actor.role.level >= 50 ||
      actor.access[AppModule.WORK] === AccessLevel.MANAGE

    const whereClause: any = {
      teamId,
    }

    if (scope === "my" || (!isManager && !userIdParam)) {
      whereClause.userId = actor.userId
    } else if (userIdParam) {
      if (!isManager && userIdParam !== actor.userId) {
        whereClause.userId = actor.userId
      } else {
        whereClause.userId = userIdParam
      }
    }

    if (statusParam && Object.values(TimesheetStatus).includes(statusParam)) {
      whereClause.status = statusParam
    }

    if (weekStartParam) {
      const parsedWeek = new Date(weekStartParam)
      const startOfWeek = getStartOfWeek(parsedWeek)
      whereClause.weekStartDate = {
        gte: startOfWeek,
        lte: new Date(startOfWeek.getTime() + 86400000), // within the same day
      }
    }

    const timesheets = await db.timesheet.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            employeeCode: true,
            position: true,
          },
        },
        entries: {
          include: {
            project: { select: { id: true, name: true, key: true, color: true } },
            issue: { select: { id: true, title: true, number: true, priority: true } },
          },
          orderBy: { date: "asc" },
        },
      },
      orderBy: { weekStartDate: "desc" },
      take: 50,
    })

    return NextResponse.json({
      timesheets,
      isManager,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}

// POST /api/teams/[teamId]/timesheets - Get or create a timesheet for a given week
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const actor = await requireTeamAccess(teamId, {
      module: AppModule.WORK,
      level: AccessLevel.VIEW,
    })

    const body = await request.json().catch(() => ({}))
    const rawDate = body.weekStartDate ? new Date(body.weekStartDate) : new Date()
    const weekStartDate = getStartOfWeek(rawDate)
    const weekEndDate = getEndOfWeek(weekStartDate)

    const existing = await db.timesheet.findFirst({
      where: {
        teamId,
        userId: actor.userId,
        weekStartDate,
      },
      include: {
        entries: {
          include: {
            project: { select: { id: true, name: true, key: true, color: true } },
            issue: { select: { id: true, title: true, number: true, priority: true } },
          },
          orderBy: { date: "asc" },
        },
      },
    })

    if (existing) {
      return NextResponse.json({ timesheet: existing })
    }

    const newTimesheet = await db.timesheet.create({
      data: {
        teamId,
        userId: actor.userId,
        weekStartDate,
        weekEndDate,
        status: TimesheetStatus.DRAFT,
        notes: body.notes || null,
      },
      include: {
        entries: true,
      },
    })

    return NextResponse.json({ timesheet: newTimesheet }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
