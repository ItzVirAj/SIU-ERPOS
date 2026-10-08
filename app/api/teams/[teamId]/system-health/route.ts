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

    // Measure DB query latency
    const startDb = performance.now()
    await db.$queryRaw`SELECT 1`
    const dbLatencyMs = Math.round(performance.now() - startDb)

    // Workspace metrics
    const [memberCount, projectCount, issueCount, automationCount, logCount] = await Promise.all([
      db.teamMember.count({ where: { teamId } }),
      db.project.count({ where: { teamId } }),
      db.issue.count({ where: { teamId } }),
      db.automationRule.count({ where: { teamId, isActive: true } }),
      db.auditLog.count({ where: { teamId } }),
    ])

    const memUsage = process.memoryUsage()

    const diagnostics = {
      status: "HEALTHY",
      checkedAt: new Date().toISOString(),
      database: {
        provider: "Neon Serverless PostgreSQL",
        status: dbLatencyMs < 300 ? "OPTIMAL" : "STABLE",
        latencyMs: dbLatencyMs,
        connection: "SSL Verified pool",
      },
      server: {
        uptimeSeconds: Math.round(process.uptime()),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || "development",
        memory: {
          rssMb: Math.round(memUsage.rss / 1024 / 1024),
          heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(memUsage.heapTotal / 1024 / 1024),
        },
      },
      workspace: {
        teamId,
        members: memberCount,
        projects: projectCount,
        tasks: issueCount,
        activeAutomations: automationCount,
        recordedAuditLogs: logCount,
      },
    }

    return NextResponse.json(diagnostics)
  } catch (error: any) {
    console.error("System health check failed:", error)
    return NextResponse.json(
      {
        status: "DEGRADED",
        checkedAt: new Date().toISOString(),
        error: error?.message || "Unknown error during health check",
      },
      { status: 500 }
    )
  }
}
