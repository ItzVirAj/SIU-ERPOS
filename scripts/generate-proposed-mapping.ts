import fs from "fs"
import path from "path"

const handlers = JSON.parse(fs.readFileSync("scripts/step0-audit-handlers.json", "utf-8"))

interface MappingRow {
  method: string
  path: string
  currentGuard: string
  proposedModule: string
  proposedLevel: string
  notes: string
}

const rows: MappingRow[] = []

for (const h of handlers) {
  let routePath = "/" + h.relPath.replace(/^app\//, "").replace(/\/route\.ts$/, "")
  // Normalize Next.js route path
  const currentGuard = h.guard
  const method = h.method

  let proposedModule = ""
  let proposedLevel = ""
  let notes = ""

  // Skip admin routes and me/user routes which already use requireAccess/requireEmployee
  if (routePath.startsWith("/api/admin/") || routePath.startsWith("/api/me/") || routePath.startsWith("/api/user/") || routePath.startsWith("/api/auth/") || routePath === "/api/invitations/[invitationId]") {
    continue
  }

  // Determine module & level
  if (routePath.includes("/projects") || routePath.includes("/issues") || routePath.includes("/labels") || routePath.includes("/workflow-states") || routePath.includes("/my-tasks") || routePath.includes("/stats") || routePath.endsWith("/sync")) {
    proposedModule = "WORK"
    if (routePath.includes("/workflow-states") || routePath.includes("/labels")) {
      proposedLevel = method === "GET" ? "VIEW" : "MANAGE"
      notes = method === "GET" ? "Read config" : "Configuration modification requires MANAGE"
    } else if (method === "GET") {
      proposedLevel = "VIEW"
    } else if (method === "DELETE") {
      proposedLevel = "MANAGE"
    } else {
      proposedLevel = "WRITE"
    }
  } else if (routePath.includes("/channels") || routePath.includes("/chat") || routePath.includes("/calendar") || routePath.includes("/standup") || routePath.includes("/announcements") || routePath.includes("/inbox")) {
    proposedModule = "COLLAB"
    if (method === "GET") proposedLevel = "VIEW"
    else if (method === "DELETE") proposedLevel = "MANAGE"
    else proposedLevel = "WRITE"
  } else if (routePath.includes("/crm/")) {
    proposedModule = "CRM"
    if (method === "GET") proposedLevel = "VIEW"
    else if (method === "DELETE") proposedLevel = "MANAGE"
    else proposedLevel = "WRITE"
  } else if (routePath.includes("/finance/")) {
    proposedModule = "FINANCE"
    if (method === "GET") proposedLevel = "VIEW"
    else if (method === "DELETE") proposedLevel = "MANAGE"
    else proposedLevel = "WRITE"
  } else if (routePath.includes("/products")) {
    proposedModule = "PRODUCTS"
    if (method === "GET") proposedLevel = "VIEW"
    else if (method === "DELETE") proposedLevel = "MANAGE"
    else proposedLevel = "WRITE"
  } else if (routePath.includes("/reports/")) {
    if (routePath.endsWith("/financial")) {
      proposedModule = "FINANCE + REPORTS"
      proposedLevel = "VIEW"
      notes = "Requires both FINANCE: VIEW and REPORTS: VIEW"
    } else if (routePath.endsWith("/sales")) {
      proposedModule = "CRM + REPORTS"
      proposedLevel = "VIEW"
      notes = "Requires both CRM: VIEW and REPORTS: VIEW"
    } else if (routePath.endsWith("/delivery") || routePath.endsWith("/team-utilization")) {
      proposedModule = "WORK + REPORTS"
      proposedLevel = "VIEW"
      notes = "Requires both WORK: VIEW and REPORTS: VIEW"
    } else if (routePath.endsWith("/founder-digest")) {
      proposedModule = "FINANCE + CRM + REPORTS"
      proposedLevel = "VIEW"
      notes = "Requires FINANCE: VIEW, CRM: VIEW and REPORTS: VIEW"
    } else if (routePath.endsWith("/kpis")) {
      proposedModule = "REPORTS"
      proposedLevel = method === "GET" ? "VIEW" : "MANAGE"
    } else {
      proposedModule = "REPORTS"
      proposedLevel = "VIEW"
    }
  } else if (routePath.includes("/flows") || routePath.includes("/automations")) {
    proposedModule = "AUTOMATIONS"
    if (method === "GET") proposedLevel = "VIEW"
    else if (method === "DELETE") proposedLevel = "MANAGE"
    else proposedLevel = "WRITE"
  } else if (routePath.includes("/api-key") || routePath.includes("/webhooks")) {
    proposedModule = "DEV_SETTINGS"
    if (method === "GET") proposedLevel = "VIEW"
    else if (method === "DELETE") proposedLevel = "MANAGE"
    else proposedLevel = "WRITE"
  } else if (routePath.includes("/company-settings") || routePath.includes("/system-health")) {
    proposedModule = "COMPANY_SETTINGS"
    proposedLevel = method === "GET" ? "VIEW" : "MANAGE"
  } else if (routePath.endsWith("/export")) {
    proposedModule = "COMPANY_SETTINGS"
    proposedLevel = "MANAGE"
    notes = "Full company data export; audit with writeAudit, rate limit 3/hour"
  } else if (routePath.includes("/audit-logs")) {
    proposedModule = "AUDIT_LOGS"
    if (method === "GET") {
      proposedLevel = "VIEW"
    } else {
      proposedLevel = "405 Method Not Allowed"
      notes = "Client write access removed; unforgeable audit trail"
    }
  } else if (routePath.includes("/members")) {
    proposedModule = "WORK"
    if (method === "GET") {
      proposedLevel = "VIEW"
    } else {
      proposedLevel = "410 Gone"
      notes = "Member mutations deprecated; must use Access Management"
    }
  } else if (routePath.includes("/invitations")) {
    proposedModule = "EMPLOYEES"
    if (routePath.endsWith("/accept") || routePath.endsWith("/resend") || method === "POST") {
      proposedLevel = "410 Gone"
      notes = "Closed registration/invitations deprecated"
    } else if (method === "DELETE") {
      proposedLevel = "WRITE"
    } else {
      proposedLevel = "VIEW"
    }
  } else if (routePath === "/api/teams/[teamId]") {
    if (method === "DELETE") {
      proposedModule = "OWNER_ONLY"
      proposedLevel = "OWNER"
      notes = "Strict check: role.key === 'owner' + confirmName check"
    }
  } else if (routePath === "/api/teams/create" || routePath === "/api/teams") {
    if (method === "POST") {
      proposedModule = "OWNER_ONLY"
      proposedLevel = "403/410"
      notes = "Single-company workspace; closed unless owner & no team exists"
    } else {
      proposedModule = "requireEmployee"
      proposedLevel = "N/A"
      notes = "Returns only caller's own team"
    }
  }

  rows.push({
    method,
    path: routePath,
    currentGuard,
    proposedModule,
    proposedLevel,
    notes,
  })
}

fs.writeFileSync("scripts/proposed-mapping-table.json", JSON.stringify(rows, null, 2))
console.log(`Generated proposed mapping table for ${rows.length} handlers.`)
