import { NextRequest, NextResponse } from "next/server"
import { requireTeamAccess } from "@/lib/route-guards"
import { handleRouteError, HttpError } from "@/lib/authz"
import { AppModule, AccessLevel } from "@/lib/prisma-client"
import { db } from "@/lib/db"

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

    const isManager =
      actor.role.level >= 50 ||
      actor.access[AppModule.EMPLOYEES] === AccessLevel.MANAGE ||
      actor.access[AppModule.EMPLOYEES] === AccessLevel.WRITE

    const currentYear = new Date().getFullYear()

    // 1. Ensure employee has a leave balance initialized for current year
    let leaveBalance = await db.leaveBalance.findUnique({
      where: {
        employeeId_year: {
          employeeId: actor.employee.id,
          year: currentYear,
        },
      },
    })

    if (!leaveBalance) {
      leaveBalance = await db.leaveBalance.create({
        data: {
          teamId,
          employeeId: actor.employee.id,
          year: currentYear,
          casualTotal: 12,
          casualUsed: 0,
          sickTotal: 10,
          sickUsed: 0,
          paidTotal: 15,
          paidUsed: 0,
          unpaidUsed: 0,
        },
      })
    }

    // 2. Fetch my leave requests
    const myLeaves = await db.leaveRequest.findMany({
      where: {
        teamId,
        employeeId: actor.employee.id,
      },
      orderBy: { createdAt: "desc" },
    })

    // 3. If manager or HR, also fetch all team leave requests
    let teamLeaves: any[] = []
    if (isManager) {
      teamLeaves = await db.leaveRequest.findMany({
        where: { teamId },
        include: {
          employee: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
              position: true,
              department: true,
              user: { select: { name: true, email: true, image: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    }

    // 4. Fetch team absence calendar (approved leaves for the current month / upcoming)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
    const activeLeaves = await db.leaveRequest.findMany({
      where: {
        teamId,
        status: "APPROVED",
        endDate: { gte: thirtyDaysAgo },
      },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            position: true,
            user: { select: { name: true, image: true } },
          },
        },
      },
      orderBy: { startDate: "asc" },
    })

    return NextResponse.json({
      leaveBalance,
      myLeaves,
      teamLeaves,
      activeLeaves,
      isManager,
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
    const { leaveType, startDate, endDate, totalDays, reason, emergencyContact } = body

    if (!leaveType || !startDate || !endDate || !reason) {
      throw new HttpError(400, "Missing required leave fields", "BAD_REQUEST")
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    if (end < start) {
      throw new HttpError(400, "End date cannot be earlier than start date", "INVALID_DATES")
    }

    const daysCount = totalDays ? Number(totalDays) : Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1)

    const leaveRequest = await db.leaveRequest.create({
      data: {
        teamId,
        employeeId: actor.employee.id,
        userId: actor.userId,
        leaveType,
        startDate: start,
        endDate: end,
        totalDays: daysCount,
        reason: reason.trim(),
        emergencyContact: emergencyContact?.trim() || null,
        status: "PENDING",
      },
    })

    return NextResponse.json({ leaveRequest }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
