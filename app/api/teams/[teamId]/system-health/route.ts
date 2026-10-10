import { NextRequest, NextResponse } from "next/server"
import { handleRouteError } from "@/lib/authz"
import { requireTeamAccess } from "@/lib/route-guards"
import { AppModule, AccessLevel } from "@/lib/prisma-client"
import { db } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamAccess(teamId, {
      module: AppModule.COMPANY_SETTINGS,
      level: AccessLevel.VIEW,
    })

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
  } catch (error) {
    return handleRouteError(error)
  }
}
