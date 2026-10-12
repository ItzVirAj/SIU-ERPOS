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
    await requireTeamAccess(teamId, {
      module: AppModule.EMPLOYEES,
      level: AccessLevel.VIEW,
    })

    const [openings, candidates] = await Promise.all([
      db.jobOpening.findMany({
        where: { teamId },
        include: {
          _count: { select: { candidates: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.candidate.findMany({
        where: { teamId },
        include: {
          jobOpening: { select: { id: true, title: true, department: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
    ])

    return NextResponse.json({
      openings,
      candidates,
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
      module: AppModule.EMPLOYEES,
      level: AccessLevel.WRITE,
    })

    const body = await request.json()
    const { action } = body

    if (action === "CREATE_OPENING") {
      const { title, department, location = "Remote (India)", type = "FULL_TIME", description, openingsCount = 1 } = body
      if (!title || !department) {
        throw new HttpError(400, "Title and department are required", "BAD_REQUEST")
      }
      const opening = await db.jobOpening.create({
        data: {
          teamId,
          title: title.trim(),
          department: department.trim(),
          location: location.trim(),
          type,
          description: description?.trim() || null,
          openingsCount: Number(openingsCount) || 1,
          status: "OPEN",
        },
      })
      return NextResponse.json({ opening }, { status: 201 })
    } else if (action === "ADD_CANDIDATE") {
      const {
        jobOpeningId,
        fullName,
        email,
        phone,
        stage = "SOURCED",
        resumeUrl,
        portfolioUrl,
        experienceYears,
        expectedCtc,
        noticePeriodDays,
        rating,
        notes,
      } = body

      if (!fullName || !email) {
        throw new HttpError(400, "Candidate name and email are required", "BAD_REQUEST")
      }

      const candidate = await db.candidate.create({
        data: {
          teamId,
          jobOpeningId: jobOpeningId || null,
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone?.trim() || null,
          stage,
          resumeUrl: resumeUrl?.trim() || null,
          portfolioUrl: portfolioUrl?.trim() || null,
          experienceYears: experienceYears ? Number(experienceYears) : null,
          expectedCtc: expectedCtc ? Number(expectedCtc) : null,
          noticePeriodDays: noticePeriodDays ? Number(noticePeriodDays) : null,
          rating: rating ? Number(rating) : null,
          notes: notes?.trim() || null,
        },
        include: {
          jobOpening: { select: { id: true, title: true, department: true } },
        },
      })
      return NextResponse.json({ candidate }, { status: 201 })
    }

    throw new HttpError(400, "Invalid action (expected CREATE_OPENING or ADD_CANDIDATE)", "BAD_REQUEST")
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
    await requireTeamAccess(teamId, {
      module: AppModule.EMPLOYEES,
      level: AccessLevel.WRITE,
    })

    const body = await request.json()
    const { candidateId, stage, rating, notes } = body

    if (!candidateId) {
      throw new HttpError(400, "Candidate ID is required", "BAD_REQUEST")
    }

    const updateData: any = {}
    if (stage) updateData.stage = stage
    if (rating !== undefined) updateData.rating = Number(rating)
    if (notes !== undefined) updateData.notes = notes

    const updated = await db.candidate.update({
      where: { id: candidateId },
      data: updateData,
      include: {
        jobOpening: { select: { id: true, title: true, department: true } },
      },
    })

    return NextResponse.json({ candidate: updated })
  } catch (error) {
    return handleRouteError(error)
  }
}
