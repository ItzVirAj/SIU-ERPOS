import { NextRequest, NextResponse } from "next/server"
import { requireTeamAccess } from "@/lib/route-guards"
import { handleRouteError, HttpError } from "@/lib/authz"
import { AppModule, AccessLevel } from "@/lib/prisma-client"
import { db } from "@/lib/db"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; leaveId: string }> }
) {
  try {
    const { teamId, leaveId } = await params
    const actor = await requireTeamAccess(teamId, {
      module: AppModule.EMPLOYEES,
      level: AccessLevel.VIEW,
    })

    const isManager =
      actor.role.level >= 50 ||
      actor.access[AppModule.EMPLOYEES] === AccessLevel.MANAGE ||
      actor.access[AppModule.EMPLOYEES] === AccessLevel.WRITE

    if (!isManager) {
      throw new HttpError(403, "Only HR or managers can approve or reject leaves", "FORBIDDEN")
    }

    const leave = await db.leaveRequest.findFirst({
      where: { id: leaveId, teamId },
    })

    if (!leave) {
      throw new HttpError(404, "Leave request not found", "NOT_FOUND")
    }

    const body = await request.json()
    const { action, rejectionReason } = body

    if (action === "APPROVE") {
      const updated = await db.leaveRequest.update({
        where: { id: leaveId },
        data: {
          status: "APPROVED",
          approvedBy: actor.user?.name || actor.userId,
          approvedAt: new Date(),
          rejectionReason: null,
        },
      })

      // Deduct from employee leave balance
      const year = new Date(leave.startDate).getFullYear()
      const balance = await db.leaveBalance.findUnique({
        where: {
          employeeId_year: {
            employeeId: leave.employeeId,
            year,
          },
        },
      })

      if (balance) {
        const updateField: any = {}
        if (leave.leaveType === "CASUAL") {
          updateField.casualUsed = balance.casualUsed + leave.totalDays
        } else if (leave.leaveType === "SICK") {
          updateField.sickUsed = balance.sickUsed + leave.totalDays
        } else if (leave.leaveType === "PAID") {
          updateField.paidUsed = balance.paidUsed + leave.totalDays
        } else {
          updateField.unpaidUsed = balance.unpaidUsed + leave.totalDays
        }
        await db.leaveBalance.update({
          where: { id: balance.id },
          data: updateField,
        })
      }

      return NextResponse.json({ leaveRequest: updated })
    } else if (action === "REJECT") {
      const updated = await db.leaveRequest.update({
        where: { id: leaveId },
        data: {
          status: "REJECTED",
          rejectionReason: rejectionReason?.trim() || "Declined by management.",
          approvedBy: null,
          approvedAt: null,
        },
      })
      return NextResponse.json({ leaveRequest: updated })
    }

    throw new HttpError(400, "Invalid action (expected APPROVE or REJECT)", "BAD_REQUEST")
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; leaveId: string }> }
) {
  try {
    const { teamId, leaveId } = await params
    const actor = await requireTeamAccess(teamId, {
      module: AppModule.EMPLOYEES,
      level: AccessLevel.VIEW,
    })

    const leave = await db.leaveRequest.findFirst({
      where: { id: leaveId, teamId },
    })

    if (!leave) {
      throw new HttpError(404, "Leave request not found", "NOT_FOUND")
    }

    if (leave.employeeId !== actor.employee.id && actor.role.level < 50) {
      throw new HttpError(403, "Forbidden", "FORBIDDEN")
    }

    if (leave.status === "APPROVED") {
      throw new HttpError(400, "Approved leaves cannot be self-cancelled; contact HR", "LOCKED")
    }

    await db.leaveRequest.delete({
      where: { id: leaveId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
