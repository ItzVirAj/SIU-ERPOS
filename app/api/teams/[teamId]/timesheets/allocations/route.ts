import { NextRequest, NextResponse } from "next/server"
import { requireTeamAccess } from "@/lib/route-guards"
import { handleRouteError, HttpError } from "@/lib/authz"
import { AppModule, AccessLevel } from "@/lib/prisma-client"
import { db } from "@/lib/db"

function getStartOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
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
      module: AppModule.WORK,
      level: AccessLevel.VIEW,
    })

    const { searchParams } = new URL(request.url)
    const weekParam = searchParams.get("weekStartDate")
    const date = weekParam ? new Date(weekParam) : new Date()
    const weekStartDate = getStartOfWeek(date)

    const [allocations, members, projects] = await Promise.all([
      db.resourceAllocation.findMany({
        where: {
          teamId,
          weekStartDate: {
            gte: weekStartDate,
            lte: new Date(weekStartDate.getTime() + 86400000),
          },
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
          project: {
            select: {
              id: true,
              name: true,
              key: true,
              color: true,
            },
          },
        },
      }),
      db.employee.findMany({
        where: { teamId, status: "ACTIVE" },
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
          role: { select: { key: true, name: true, level: true } },
        },
      }),
      db.project.findMany({
        where: { teamId, status: "active" },
        select: { id: true, name: true, key: true, color: true },
      }),
    ])

    // Compute user capacity summaries
    const STANDARD_CAPACITY = 40
    const memberCapacity = members.map((emp) => {
      const userAllocations = allocations.filter((a) => a.userId === emp.userId)
      const totalAllocated = userAllocations.reduce((sum, a) => sum + a.allocatedHours, 0)
      const isOverAllocated = totalAllocated > STANDARD_CAPACITY
      const isBench = totalAllocated < 20
      const utilizationRate = Math.min(Math.round((totalAllocated / STANDARD_CAPACITY) * 100), 200)

      return {
        userId: emp.userId,
        name: emp.user?.name || emp.fullName,
        email: emp.email,
        employeeCode: emp.employeeCode,
        position: emp.position,
        roleName: emp.role.name,
        standardCapacity: STANDARD_CAPACITY,
        totalAllocated,
        utilizationRate,
        isOverAllocated,
        isBench,
        allocations: userAllocations,
      }
    })

    return NextResponse.json({
      weekStartDate: weekStartDate.toISOString(),
      allocations,
      memberCapacity,
      projects,
      canManage:
        actor.role.level >= 50 ||
        actor.access[AppModule.WORK] === AccessLevel.MANAGE ||
        actor.access[AppModule.WORK] === AccessLevel.WRITE,
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
    await requireTeamAccess(teamId, {
      module: AppModule.WORK,
      level: AccessLevel.WRITE,
    })

    const body = await request.json()
    const {
      userId,
      projectId,
      weekStartDate: rawDate,
      allocatedHours,
      role,
      notes,
      isContractor = false,
      contractorRate,
    } = body

    if (!userId || !projectId || !rawDate || allocatedHours === undefined) {
      throw new HttpError(400, "userId, projectId, weekStartDate, and allocatedHours are required", "BAD_REQUEST")
    }

    const weekStartDate = getStartOfWeek(new Date(rawDate))
    const parsedHours = Number(allocatedHours)

    const allocation = await db.resourceAllocation.upsert({
      where: {
        teamId_userId_projectId_weekStartDate: {
          teamId,
          userId,
          projectId,
          weekStartDate,
        },
      },
      update: {
        allocatedHours: parsedHours,
        role: role || null,
        notes: notes || null,
        isContractor: Boolean(isContractor),
        contractorRate: contractorRate !== undefined ? Number(contractorRate) : null,
      },
      create: {
        teamId,
        userId,
        projectId,
        weekStartDate,
        allocatedHours: parsedHours,
        role: role || null,
        notes: notes || null,
        isContractor: Boolean(isContractor),
        contractorRate: contractorRate !== undefined ? Number(contractorRate) : null,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true, key: true } },
      },
    })

    return NextResponse.json({ allocation }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamAccess(teamId, {
      module: AppModule.WORK,
      level: AccessLevel.WRITE,
    })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      throw new HttpError(400, "Allocation ID is required", "BAD_REQUEST")
    }

    await db.resourceAllocation.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
