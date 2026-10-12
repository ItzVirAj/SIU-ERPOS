import { NextRequest, NextResponse } from "next/server"
import { requireTeamAccess } from "@/lib/route-guards"
import { handleRouteError, HttpError } from "@/lib/authz"
import { AppModule, AccessLevel } from "@/lib/prisma-client"
import { db } from "@/lib/db"

const DEFAULT_ONBOARDING_ITEMS = [
  { id: "1", title: "Corporate Google Workspace Email & Better Auth Account", category: "ACCOUNTS", isCompleted: true },
  { id: "2", title: "GitHub Organization & Repository Access Granted", category: "ACCOUNTS", isCompleted: false },
  { id: "3", title: "Development Environment, VPN & Secrets Vault Access", category: "IT_SETUP", isCompleted: false },
  { id: "4", title: "Company Non-Disclosure Agreement (NDA) & IP Policy E-Sign", category: "LEGAL", isCompleted: false },
  { id: "5", title: "Team Introduction & Onboarding Buddy Assigned", category: "CULTURE", isCompleted: false },
  { id: "6", title: "First-Week Sprint Plan & Architecture Overview Meeting", category: "WORK", isCompleted: false },
]

const DEFAULT_OFFBOARDING_ITEMS = [
  { id: "1", title: "Revoke GitHub, Cloud & Neon Database Permissions", category: "SECURITY", isCompleted: false },
  { id: "2", title: "Terminate Active Sessions & Invalidate Better Auth Tokens", category: "SECURITY", isCompleted: false },
  { id: "3", title: "Knowledge Handover & Project Documentation Sign-off", category: "HANDOVER", isCompleted: false },
  { id: "4", title: "Company Laptop & Hardware Asset Return Logged", category: "ASSETS", isCompleted: false },
  { id: "5", title: "Exit Interview & Final Settlement Payroll Input", category: "HR", isCompleted: false },
]

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

    const whereClause: any = { teamId }
    if (!isManager) {
      whereClause.employeeId = actor.employee.id
    }

    const checklists = await db.onboardingChecklist.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            position: true,
            department: true,
            user: { select: { name: true, image: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ checklists, isManager })
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
      level: AccessLevel.WRITE,
    })

    const body = await request.json()
    const { employeeId, type = "ONBOARDING", title } = body

    if (!employeeId) {
      throw new HttpError(400, "Employee ID is required", "BAD_REQUEST")
    }

    const defaultTitle =
      title || (type === "ONBOARDING" ? "Standard New Joiner Onboarding Checklist" : "Standard Employee Offboarding Checklist")
    const defaultItems = type === "ONBOARDING" ? DEFAULT_ONBOARDING_ITEMS : DEFAULT_OFFBOARDING_ITEMS

    const checklist = await db.onboardingChecklist.create({
      data: {
        teamId,
        employeeId,
        type,
        title: defaultTitle,
        items: defaultItems,
        isCompleted: false,
      },
      include: {
        employee: { select: { fullName: true, employeeCode: true, position: true } },
      },
    })

    return NextResponse.json({ checklist }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PATCH(
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
    const { checklistId, itemId, isCompleted } = body

    if (!checklistId || !itemId) {
      throw new HttpError(400, "checklistId and itemId are required", "BAD_REQUEST")
    }

    const checklist = await db.onboardingChecklist.findFirst({
      where: { id: checklistId, teamId },
    })

    if (!checklist) {
      throw new HttpError(404, "Checklist not found", "NOT_FOUND")
    }

    const items = (checklist.items as any[]) || []
    const updatedItems = items.map((it) => {
      if (it.id === itemId) {
        return {
          ...it,
          isCompleted: Boolean(isCompleted),
          completedAt: isCompleted ? new Date().toISOString() : null,
          completedBy: isCompleted ? (actor.user?.name || actor.userId) : null,
        }
      }
      return it
    })

    const allFinished = updatedItems.every((it) => it.isCompleted)

    const updated = await db.onboardingChecklist.update({
      where: { id: checklistId },
      data: {
        items: updatedItems,
        isCompleted: allFinished,
        completedAt: allFinished ? new Date() : null,
      },
    })

    return NextResponse.json({ checklist: updated })
  } catch (error) {
    return handleRouteError(error)
  }
}
