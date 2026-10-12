import { NextRequest, NextResponse } from "next/server"
import { requireTeamAccess } from "@/lib/route-guards"
import { handleRouteError, HttpError } from "@/lib/authz"
import { AppModule, AccessLevel, TimesheetStatus } from "@/lib/prisma-client"
import { db } from "@/lib/db"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; entryId: string }> }
) {
  try {
    const { teamId, entryId } = await params
    const actor = await requireTeamAccess(teamId, {
      module: AppModule.WORK,
      level: AccessLevel.VIEW,
    })

    const entry = await db.timeEntry.findFirst({
      where: { id: entryId, teamId },
      include: { timesheet: true },
    })

    if (!entry) {
      throw new HttpError(404, "Time entry not found", "NOT_FOUND")
    }

    if (entry.timesheet?.status === TimesheetStatus.APPROVED) {
      throw new HttpError(400, "Cannot delete entry from approved timesheet", "TIMESHEET_LOCKED")
    }

    const isManager =
      actor.role.level >= 50 ||
      actor.access[AppModule.WORK] === AccessLevel.MANAGE

    if (entry.userId !== actor.userId && !isManager) {
      throw new HttpError(403, "Forbidden", "FORBIDDEN")
    }

    const timesheetId = entry.timesheetId

    await db.timeEntry.delete({
      where: { id: entryId },
    })

    // Recalculate totals if attached to timesheet
    if (timesheetId) {
      const aggregated = await db.timeEntry.aggregate({
        where: { timesheetId },
        _sum: { hours: true },
      })
      const billableAgg = await db.timeEntry.aggregate({
        where: { timesheetId, isBillable: true },
        _sum: { hours: true },
      })
      await db.timesheet.update({
        where: { id: timesheetId },
        data: {
          totalHours: aggregated._sum.hours || 0,
          billableHours: billableAgg._sum.hours || 0,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; entryId: string }> }
) {
  try {
    const { teamId, entryId } = await params
    const actor = await requireTeamAccess(teamId, {
      module: AppModule.WORK,
      level: AccessLevel.VIEW,
    })

    const entry = await db.timeEntry.findFirst({
      where: { id: entryId, teamId },
      include: { timesheet: true },
    })

    if (!entry) {
      throw new HttpError(404, "Time entry not found", "NOT_FOUND")
    }

    if (entry.timesheet?.status === TimesheetStatus.APPROVED) {
      throw new HttpError(400, "Cannot edit entry in approved timesheet", "TIMESHEET_LOCKED")
    }

    const isManager =
      actor.role.level >= 50 ||
      actor.access[AppModule.WORK] === AccessLevel.MANAGE

    if (entry.userId !== actor.userId && !isManager) {
      throw new HttpError(403, "Forbidden", "FORBIDDEN")
    }

    const body = await request.json()
    const { hours, description, projectId, issueId, isBillable, category } = body

    const updateData: any = {}
    if (hours !== undefined) {
      const parsed = Number(hours)
      if (isNaN(parsed) || parsed <= 0 || parsed > 24) {
        throw new HttpError(400, "Invalid hours", "BAD_REQUEST")
      }
      updateData.hours = parsed
    }
    if (description !== undefined) updateData.description = description.trim()
    if (projectId !== undefined) updateData.projectId = projectId || null
    if (issueId !== undefined) updateData.issueId = issueId || null
    if (isBillable !== undefined) updateData.isBillable = Boolean(isBillable)
    if (category !== undefined) updateData.category = category

    const updated = await db.timeEntry.update({
      where: { id: entryId },
      data: updateData,
      include: {
        project: { select: { id: true, name: true, key: true, color: true } },
        issue: { select: { id: true, title: true, number: true } },
      },
    })

    // Recalculate totals
    if (entry.timesheetId) {
      const aggregated = await db.timeEntry.aggregate({
        where: { timesheetId: entry.timesheetId },
        _sum: { hours: true },
      })
      const billableAgg = await db.timeEntry.aggregate({
        where: { timesheetId: entry.timesheetId, isBillable: true },
        _sum: { hours: true },
      })
      await db.timesheet.update({
        where: { id: entry.timesheetId },
        data: {
          totalHours: aggregated._sum.hours || 0,
          billableHours: billableAgg._sum.hours || 0,
        },
      })
    }

    return NextResponse.json({ entry: updated })
  } catch (error) {
    return handleRouteError(error)
  }
}
