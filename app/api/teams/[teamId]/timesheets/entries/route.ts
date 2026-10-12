import { NextRequest, NextResponse } from "next/server"
import { requireTeamAccess } from "@/lib/route-guards"
import { handleRouteError, HttpError } from "@/lib/authz"
import { AppModule, AccessLevel, TimesheetStatus } from "@/lib/prisma-client"
import { db } from "@/lib/db"

function getStartOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
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

    const body = await request.json()
    const {
      timesheetId,
      date,
      hours,
      description,
      projectId,
      issueId,
      isBillable = true,
      category = "DEVELOPMENT",
      isTimer = false,
      startedAt,
      stoppedAt,
      userId,
    } = body

    if (!date || hours === undefined || !description) {
      throw new HttpError(400, "Date, hours, and description are required", "BAD_REQUEST")
    }

    const parsedHours = Number(hours)
    if (isNaN(parsedHours) || parsedHours <= 0 || parsedHours > 24) {
      throw new HttpError(400, "Hours must be a positive number up to 24", "INVALID_HOURS")
    }

    const targetUserId =
      userId && (actor.role.level >= 50 || actor.access[AppModule.WORK] === AccessLevel.MANAGE)
        ? userId
        : actor.userId

    const entryDate = new Date(date)
    const weekStartDate = getStartOfWeek(entryDate)
    const weekEndDate = getEndOfWeek(weekStartDate)

    // Locate or create the timesheet for this entry
    let activeTimesheet = null
    if (timesheetId) {
      activeTimesheet = await db.timesheet.findFirst({
        where: { id: timesheetId, teamId },
      })
    } else {
      activeTimesheet = await db.timesheet.findFirst({
        where: {
          teamId,
          userId: targetUserId,
          weekStartDate,
        },
      })
    }

    if (!activeTimesheet) {
      activeTimesheet = await db.timesheet.create({
        data: {
          teamId,
          userId: targetUserId,
          weekStartDate,
          weekEndDate,
          status: TimesheetStatus.DRAFT,
        },
      })
    }

    if (activeTimesheet.status === TimesheetStatus.APPROVED) {
      throw new HttpError(400, "Cannot add entries to an approved & locked timesheet", "TIMESHEET_LOCKED")
    }

    // Optional rate card lookup for cost tracking (TIME-04)
    let costRate: number | null = null
    let billingRate: number | null = null
    const rateCard = await db.rateCard.findFirst({
      where: {
        teamId,
        OR: [{ userId: targetUserId }, { roleKey: actor.role.key }],
      },
      orderBy: { effectiveFrom: "desc" },
    })

    if (rateCard) {
      costRate = rateCard.hourlyCostRate
      billingRate = rateCard.hourlyBillingRate
    }

    const newEntry = await db.timeEntry.create({
      data: {
        teamId,
        userId: targetUserId,
        timesheetId: activeTimesheet.id,
        date: entryDate,
        hours: parsedHours,
        description: description.trim(),
        projectId: projectId || null,
        issueId: issueId || null,
        isBillable: Boolean(isBillable),
        category: category || "DEVELOPMENT",
        costRate,
        billingRate,
        isTimer: Boolean(isTimer),
        startedAt: startedAt ? new Date(startedAt) : null,
        stoppedAt: stoppedAt ? new Date(stoppedAt) : null,
      },
      include: {
        project: { select: { id: true, name: true, key: true, color: true } },
        issue: { select: { id: true, title: true, number: true, priority: true } },
      },
    })

    // Update timesheet aggregate totals
    const aggregated = await db.timeEntry.aggregate({
      where: { timesheetId: activeTimesheet.id },
      _sum: { hours: true },
    })

    const billableAgg = await db.timeEntry.aggregate({
      where: { timesheetId: activeTimesheet.id, isBillable: true },
      _sum: { hours: true },
    })

    await db.timesheet.update({
      where: { id: activeTimesheet.id },
      data: {
        totalHours: aggregated._sum.hours || 0,
        billableHours: billableAgg._sum.hours || 0,
      },
    })

    return NextResponse.json({
      entry: newEntry,
      timesheetId: activeTimesheet.id,
    }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
