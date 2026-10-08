import { NextRequest, NextResponse } from "next/server"
import { getUserId } from "@/lib/auth-server-helpers"
import { db } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const userId = await getUserId()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const membership = await db.teamMember.findFirst({
      where: { teamId, userId },
    })

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let components = await db.reusableComponent.findMany({
      where: { teamId },
      orderBy: { timesReused: "desc" },
    })

    // Auto-seed starter agency IP components if empty
    if (components.length === 0) {
      await db.reusableComponent.createMany({
        data: [
          {
            teamId,
            name: "Indian GST & SAC Invoicing Engine",
            category: "BACKEND",
            description: "Stateless TypeScript utility that calculates CGST (9%), SGST (9%), IGST (18%), and Export LUT with sequential numbering and GSTR-1 CSV generator.",
            techStack: "TypeScript, Prisma, Zod",
            repoUrl: "https://github.com/sketchitup/siu-gst-engine",
            timesReused: 6,
            hoursSavedEstimate: 80,
          },
          {
            teamId,
            name: "Multi-tenant RBAC Middleware",
            category: "BACKEND",
            description: "High-performance edge session authorization verifying team membership, role permissions, and token introspection.",
            techStack: "Next.js 15, Better Auth, Neon DB",
            repoUrl: "https://github.com/sketchitup/siu-edge-rbac",
            timesReused: 8,
            hoursSavedEstimate: 120,
          },
          {
            teamId,
            name: "Groq LLaMA Meeting Intelligence Worker",
            category: "AI_ML",
            description: "Audio/transcript parser that extracts 5-line executive summaries, action items with assignees, and drafts follow-up client emails in under 3 seconds.",
            techStack: "Groq SDK, LLaMA-3.3-70B, LangChain",
            repoUrl: "https://github.com/sketchitup/siu-meeting-ai",
            timesReused: 4,
            hoursSavedEstimate: 95,
          },
          {
            teamId,
            name: "Owner OS Dark Component System",
            category: "DESIGN_SYSTEM",
            description: "Curated Radix UI + Tailwind CSS token library with glassmorphic cards, KPI strips, and high-contrast accessibility.",
            techStack: "Tailwind CSS, Radix UI, Lucide",
            repoUrl: "https://github.com/sketchitup/owner-os-tokens",
            timesReused: 12,
            hoursSavedEstimate: 150,
          },
        ],
      })

      components = await db.reusableComponent.findMany({
        where: { teamId },
        orderBy: { timesReused: "desc" },
      })
    }

    return NextResponse.json({ components })
  } catch (error) {
    console.error("Error listing reusable components:", error)
    return NextResponse.json({ error: "Failed to list reusable components" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const userId = await getUserId()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const membership = await db.teamMember.findFirst({
      where: {
        teamId,
        userId,
        role: { in: ["admin", "developer"] },
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "Forbidden: Admin or Developer required" }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      category = "BACKEND",
      description,
      techStack = "TypeScript, Next.js",
      repoUrl,
      timesReused = 1,
      hoursSavedEstimate = 40,
    } = body

    if (!name) {
      return NextResponse.json({ error: "Component name is required" }, { status: 400 })
    }

    const component = await db.reusableComponent.create({
      data: {
        teamId,
        name,
        category,
        description,
        techStack,
        repoUrl,
        timesReused: Number(timesReused) || 1,
        hoursSavedEstimate: Number(hoursSavedEstimate) || 40,
      },
    })

    return NextResponse.json({ component }, { status: 201 })
  } catch (error) {
    console.error("Error creating reusable component:", error)
    return NextResponse.json({ error: "Failed to create reusable component" }, { status: 500 })
  }
}
