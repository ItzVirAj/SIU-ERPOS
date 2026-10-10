import fs from "fs"
import path from "path"

function findRouteFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  let files: string[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files = files.concat(findRouteFiles(full))
    } else if (entry.isFile() && entry.name === "route.ts") {
      files.push(full)
    }
  }
  return files
}

const apiDir = path.resolve(process.cwd(), "app/api")
const routes = findRouteFiles(apiDir)

interface HandlerAudit {
  file: string
  relPath: string
  method: string
  guard: string
  isTeamRoute: boolean
}

const handlers: HandlerAudit[] = []

for (const file of routes) {
  const relPath = path.relative(process.cwd(), file).replace(/\\/g, "/")
  const content = fs.readFileSync(file, "utf-8")
  const isTeamRoute = relPath.startsWith("app/api/teams/")

  const methodRegex = /export\s+async\s+function\s+(GET|POST|PATCH|PUT|DELETE|HEAD|OPTIONS)\s*\(/g
  let match: RegExpExecArray | null

  while ((match = methodRegex.exec(content)) !== null) {
    const method = match[1]
    const funcStartIndex = match.index
    // Find matching function body or next export
    const nextExport = content.indexOf("export async function", funcStartIndex + 1)
    const funcBody = nextExport !== -1 ? content.slice(funcStartIndex, nextExport) : content.slice(funcStartIndex)

    let guard = "none"
    if (funcBody.includes("requireTeamAccess")) {
      guard = "requireTeamAccess"
    } else if (funcBody.includes("requireTeamAdmin")) {
      guard = "requireTeamAdmin"
    } else if (funcBody.includes("requireTeamMember")) {
      guard = "requireTeamMember"
    } else if (funcBody.includes("requireAccess")) {
      guard = "requireAccess"
    } else if (funcBody.includes("requireEmployee")) {
      guard = "requireEmployee"
    } else if (funcBody.includes("requireSession")) {
      guard = "requireSession"
    } else if (funcBody.includes("assertEmployeeUsable")) {
      guard = "assertEmployeeUsable"
    } else if (funcBody.includes("Better Auth") || relPath.includes("[...all]")) {
      guard = "authCatchAll"
    } else if (relPath.includes("invitations/[invitationId]")) {
      guard = "publicAllowlist"
    } else {
      guard = "other"
    }

    handlers.push({
      file,
      relPath,
      method,
      guard,
      isTeamRoute,
    })
  }
}

// Group counts
const counts: Record<string, number> = {}
const teamCounts: Record<string, number> = {}

for (const h of handlers) {
  counts[h.guard] = (counts[h.guard] || 0) + 1
  if (h.isTeamRoute) {
    teamCounts[h.guard] = (teamCounts[h.guard] || 0) + 1
  }
}

console.log("=== ALL API HANDLERS COUNTS ===")
console.table(counts)

console.log("\n=== TEAM API (app/api/teams/**) HANDLERS COUNTS ===")
console.table(teamCounts)

const notUsingTeamAccessInTeams = handlers.filter(h => h.isTeamRoute && h.guard !== "requireTeamAccess")
console.log(`\nTotal team handlers NOT using requireTeamAccess: ${notUsingTeamAccessInTeams.length}`)

fs.writeFileSync("scripts/step0-audit-handlers.json", JSON.stringify(handlers, null, 2))
