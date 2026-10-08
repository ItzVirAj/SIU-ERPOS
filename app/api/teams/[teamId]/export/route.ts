import { NextRequest, NextResponse } from "next/server"
import { requireTeamAdmin, handleRouteError } from "@/lib/authz"
import { db } from "@/lib/db"

function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""'
  const str = typeof val === "object" ? JSON.stringify(val) : String(val)
  return `"${str.replace(/"/g, '""')}"`
}

function toCsv(rows: Record<string, any>[]): string {
  if (!rows || rows.length === 0) return ""
  const headers = Object.keys(rows[0])
  const headerRow = headers.map(escapeCsvCell).join(",")
  const bodyRows = rows.map((row) => headers.map((h) => escapeCsvCell(row[h])).join(","))
  return [headerRow, ...bodyRows].join("\n")
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const { user, userId, member } = await requireTeamAdmin(teamId)

    const { searchParams } = new URL(request.url)
    const entity = searchParams.get("entity") || "all" // "tasks", "projects", "audit_logs", "automations", "all"
    const format = searchParams.get("format") || "json" // "json", "csv"

    const timestampStr = new Date().toISOString().replace(/[:.]/g, "-")

    // Audit the export action
    await db.auditLog.create({
      data: {
        teamId,
        userId,
        userName: member.userName || user.name || "Admin",
        userEmail: member.userEmail || user.email || "admin@sketchitup.internal",
        action: "EXPORT",
        entityType: entity.toUpperCase(),
        entityId: teamId,
        entityTitle: `Export ${entity}`,
        details: { entity, format, timestamp: timestampStr },
      },
    })

    if (entity === "tasks") {
      const issues = await db.issue.findMany({
        where: { teamId },
        include: {
          project: { select: { name: true, key: true } },
          workflowState: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      })

      const flatTasks = issues.map((i) => ({
        id: i.id,
        number: i.number,
        title: i.title,
        project: i.project?.name || "None",
        status: i.workflowState?.name || "None",
        priority: i.priority,
        assignee: i.assignee || "Unassigned",
        completedAt: i.completedAt ? i.completedAt.toISOString() : "",
        createdAt: i.createdAt.toISOString(),
      }))

      if (format === "csv") {
        return new NextResponse(toCsv(flatTasks), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="tasks_${teamId}_${timestampStr}.csv"`,
          },
        })
      }
      return NextResponse.json({ data: flatTasks, exportedAt: new Date() })
    }

    if (entity === "projects") {
      const projects = await db.project.findMany({
        where: { teamId },
        include: {
          _count: { select: { issues: true, members: true } },
        },
        orderBy: { createdAt: "desc" },
      })

      const flatProjects = projects.map((p) => ({
        id: p.id,
        name: p.name,
        key: p.key,
        description: p.description || "",
        totalIssues: p._count.issues,
        totalMembers: p._count.members,
        createdAt: p.createdAt.toISOString(),
      }))

      if (format === "csv") {
        return new NextResponse(toCsv(flatProjects), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="projects_${teamId}_${timestampStr}.csv"`,
          },
        })
      }
      return NextResponse.json({ data: flatProjects, exportedAt: new Date() })
    }

    if (entity === "audit_logs") {
      const logs = await db.auditLog.findMany({
        where: { teamId },
        orderBy: { createdAt: "desc" },
        take: 1000,
      })

      const flatLogs = logs.map((l) => ({
        id: l.id,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId || "",
        entityTitle: l.entityTitle || "",
        userName: l.userName || "System",
        userEmail: l.userEmail || "",
        createdAt: l.createdAt.toISOString(),
        details: l.details ? JSON.stringify(l.details) : "",
      }))

      if (format === "csv") {
        return new NextResponse(toCsv(flatLogs), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="audit_logs_${teamId}_${timestampStr}.csv"`,
          },
        })
      }
      return NextResponse.json({ data: flatLogs, exportedAt: new Date() })
    }

    // Default: Complete JSON Workspace Dump
    const [team, settings, projects, issues, automations, webhooks, auditLogs] = await Promise.all([
      db.team.findUnique({ where: { id: teamId }, select: { id: true, name: true, createdAt: true } }),
      db.companySetting.findUnique({ where: { teamId } }),
      db.project.findMany({ where: { teamId } }),
      db.issue.findMany({ where: { teamId } }),
      db.automationRule.findMany({ where: { teamId } }),
      db.webhookEndpoint.findMany({ where: { teamId }, select: { id: true, url: true, events: true, isActive: true } }),
      db.auditLog.findMany({ where: { teamId }, orderBy: { createdAt: "desc" }, take: 200 }),
    ])

    const backupPayload = {
      version: "1.0",
      type: "FULL_WORKSPACE_BACKUP",
      exportedAt: new Date().toISOString(),
      team,
      companySettings: settings,
      projects,
      issues,
      automations,
      webhooks,
      recentAuditLogs: auditLogs,
    }

    return new NextResponse(JSON.stringify(backupPayload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="erpos_full_backup_${teamId}_${timestampStr}.json"`,
      },
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
