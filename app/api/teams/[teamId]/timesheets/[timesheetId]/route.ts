import { NextRequest, NextResponse } from "next/server"
import { requireTeamAccess } from "@/lib/route-guards"
import { handleRouteError, HttpError } from "@/lib/authz"
import { AppModule, AccessLevel, TimesheetStatus } from "@/lib/prisma-client"
import { db } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; timesheetId: string }> }
) {
  try {
    const { teamId, timesheetId } = await params
    const actor = await requireTeamAccess(teamId, {
      module: AppModule.WORK,
      level: AccessLevel.VIEW,
    })

    const timesheet = await db.timesheet.findFirst({
      where: {
        id: timesheetId,
        teamId,
      },
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
    })

    if (!timesheet) {
      throw new HttpError(404, "Timesheet not found", "NOT_FOUND")
    }

    const isManager =
      actor.role.level >= 50 ||
      actor.access[AppModule.WORK] === AccessLevel.MANAGE

    if (!isManager && timesheet.userId !== actor.userId) {
      throw new HttpError(403, "Access denied to this timesheet", "FORBIDDEN")
    }

    return NextResponse.json({ timesheet })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; timesheetId: string }> }
) {
  try {
    const { teamId, timesheetId } = await params
    const actor = await requireTeamAccess(teamId, {
      module: AppModule.WORK,
      level: AccessLevel.VIEW,
    })

    const timesheet = await db.timesheet.findFirst({
      where: { id: timesheetId, teamId },
    })

    if (!timesheet) {
      throw new HttpError(404, "Timesheet not found", "NOT_FOUND")
    }

    const isManager =
      actor.role.level >= 50 ||
      actor.access[AppModule.WORK] === AccessLevel.MANAGE

    const body = await request.json()
    const { action, notes, rejectionReason } = body

    let updateData: any = {}

    if (notes !== undefined) {
      updateData.notes = notes
    }

    if (action === "SUBMIT") {
      if (timesheet.userId !== actor.userId && !isManager) {
        throw new HttpError(403, "Only the timesheet owner can submit", "FORBIDDEN")
      }
      if (timesheet.status === TimesheetStatus.APPROVED) {
        throw new HttpError(400, "Timesheet is already approved and locked", "ALREADY_APPROVED")
      }
      updateData.status = TimesheetStatus.SUBMITTED
      updateData.submittedAt = new Date()
    } else if (action === "APPROVE") {
      if (!isManager) {
        throw new HttpError(403, "Only managers or team leads can approve timesheets", "FORBIDDEN")
      }
      updateData.status = TimesheetStatus.APPROVED
      updateData.approvedAt = new Date()
      updateData.approvedBy = actor.user?.name || actor.userId
      updateData.rejectionReason = null
    } else if (action === "REJECT") {
      if (!isManager) {
        throw new HttpError(403, "Only managers or team leads can reject timesheets", "FORBIDDEN")
      }
      updateData.status = TimesheetStatus.REJECTED
      updateData.rejectionReason = rejectionReason || "Timesheet rejected by reviewer."
      updateData.approvedAt = null
      updateData.approvedBy = null
    } else if (action === "REOPEN") {
      if (timesheet.userId !== actor.userId && !isManager) {
        throw new HttpError(403, "Only the owner or manager can reopen", "FORBIDDEN")
      }
      if (timesheet.status === TimesheetStatus.APPROVED && !isManager) {
        throw new HttpError(403, "Only managers can unlock approved timesheets", "FORBIDDEN")
      }
      updateData.status = TimesheetStatus.DRAFT
      updateData.approvedAt = null
      updateData.approvedBy = null
    }

    const updated = await db.timesheet.update({
      where: { id: timesheetId },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, email: true } },
        entries: {
          include: {
            project: { select: { id: true, name: true, key: true, color: true } },
            issue: { select: { id: true, title: true, number: true } },
          },
        },
      },
    })

    return NextResponse.json({ timesheet: updated })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; timesheetId: string }> }
) {
  try {
    const { teamId, timesheetId } = await params
    const actor = await requireTeamAccess(teamId, {
      module: AppModule.WORK,
      level: AccessLevel.VIEW,
    })

    const timesheet = await db.timesheet.findFirst({
      where: { id: timesheetId, teamId },
    })

    if (!timesheet) {
      throw new HttpError(404, "Timesheet not found", "NOT_FOUND")
    }

    if (timesheet.status === TimesheetStatus.APPROVED) {
      throw new HttpError(400, "Approved timesheets cannot be deleted", "LOCKED")
    }

    const isManager =
      actor.role.level >= 50 ||
      actor.access[AppModule.WORK] === AccessLevel.MANAGE

    if (timesheet.userId !== actor.userId && !isManager) {
      throw new HttpError(403, "Forbidden", "FORBIDDEN")
    }

    await db.timesheet.delete({
      where: { id: timesheetId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
