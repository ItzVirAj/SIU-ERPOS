import { NextRequest, NextResponse } from "next/server"
import { requireTeamAccess } from "@/lib/route-guards"
import { handleRouteError, HttpError } from "@/lib/authz"
import { AppModule, AccessLevel } from "@/lib/prisma-client"
import { db } from "@/lib/db"

function getMidnight(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const actor = await requireTeamAccess(teamId, {
      module: AppModule.EMPLOYEES,
      level: AccessLevel.VIEW,
    })

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get("date")
    const targetDate = dateParam ? new Date(dateParam) : new Date()
    const midnight = getMidnight(targetDate)

    const [todayAttendance, teamRegister] = await Promise.all([
      db.attendance.findUnique({
        where: {
          employeeId_date: {
            employeeId: actor.employee.id,
            date: midnight,
          },
        },
      }),
      db.attendance.findMany({
        where: {
          teamId,
          date: midnight,
        },
        include: {
          employee: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
              position: true,
              department: true,
              user: { select: { image: true, email: true } },
            },
          },
        },
        orderBy: { checkInTime: "asc" },
      }),
    ])

    return NextResponse.json({
      todayAttendance,
      teamRegister,
      targetDate: midnight.toISOString(),
    })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const actor = await requireTeamAccess(teamId, {
      module: AppModule.EMPLOYEES,
      level: AccessLevel.VIEW,
    })

    const body = await request.json()
    const { action, workMode = "WFH", notes } = body
    const now = new Date()
    const todayMidnight = getMidnight(now)

    if (action === "CHECK_IN") {
      const attendance = await db.attendance.upsert({
        where: {
          employeeId_date: {
            employeeId: actor.employee.id,
            date: todayMidnight,
          },
        },
        update: {
          workMode,
          notes: notes?.trim() || null,
        },
        create: {
          teamId,
          employeeId: actor.employee.id,
          userId: actor.userId,
          date: todayMidnight,
          checkInTime: now,
          workMode,
          status: "PRESENT",
          notes: notes?.trim() || null,
        },
      })
      return NextResponse.json({ attendance }, { status: 201 })
    } else if (action === "CHECK_OUT") {
      const existing = await db.attendance.findUnique({
        where: {
          employeeId_date: {
            employeeId: actor.employee.id,
            date: todayMidnight,
          },
        },
      })

      if (!existing) {
        throw new HttpError(400, "Cannot check out without checking in first", "NOT_CHECKED_IN")
      }

      const diffMs = now.getTime() - existing.checkInTime.getTime()
      const totalHours = Math.max(0.1, Number((diffMs / (1000 * 60 * 60)).toFixed(2)))

      const attendance = await db.attendance.update({
        where: { id: existing.id },
        data: {
          checkOutTime: now,
          totalHours,
          notes: notes ? `${existing.notes ? existing.notes + " | " : ""}${notes.trim()}` : existing.notes,
        },
      })
      return NextResponse.json({ attendance })
    }

    throw new HttpError(400, "Invalid action (expected CHECK_IN or CHECK_OUT)", "BAD_REQUEST")
  } catch (error) {
    return handleRouteError(error)
  }
}
