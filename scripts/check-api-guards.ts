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

const allowListPath = path.resolve(process.cwd(), "scripts/public-routes.json")
let allowList: string[] = []
if (fs.existsSync(allowListPath)) {
  allowList = JSON.parse(fs.readFileSync(allowListPath, "utf-8"))
}

const apiDir = path.resolve(process.cwd(), "app/api")
const routes = findRouteFiles(apiDir)

console.log("===================================================")
console.log("Checking Strict API Route Guards Across app/api/**")
console.log("===================================================")

let passed = 0
let failed = 0
const failures: string[] = []

for (const file of routes) {
  const relPath = path.relative(process.cwd(), file).replace(/\\/g, "/")
  
  if (allowList.includes(relPath)) {
    console.log(`  [ALLOWLIST] ${relPath}`)
    passed++
    continue
  }

  const content = fs.readFileSync(file, "utf-8")
  let fileHasError = false

  // 1. FAIL if any route file under app/api/teams/** imports requireTeamMember or requireTeamAdmin
  if (relPath.startsWith("app/api/teams/")) {
    if (/\b(requireTeamMember|requireTeamAdmin)\b/.test(content)) {
      failures.push(`${relPath}: Forbidden legacy guard imported or referenced (requireTeamMember or requireTeamAdmin)`)
      fileHasError = true
    }
  }

  // 2. Check getSession isolation: FAIL if route calls getSession directly without assertEmployeeUsable
  const hasDirectSession = /\bgetSession\s*\(|\bauth\.api\.getSession\s*\(/.test(content)
  const hasEmployeeUsable = /\bassertEmployeeUsable\s*\(/.test(content)
  if (hasDirectSession && !hasEmployeeUsable) {
    failures.push(`${relPath}: Direct getSession call found without assertEmployeeUsable`)
    fileHasError = true
  }

  // 3. FAIL if a requireTeamAccess call in a team route does not pass an explicit module and level
  const teamAccessMatches = content.matchAll(/\brequireTeamAccess\s*\(([^)]+)\)/g)
  for (const match of teamAccessMatches) {
    const args = match[1]
    const hasModule = /\bmodule\s*:/.test(args)
    const hasLevel = /\blevel\s*:/.test(args)
    if (!hasModule || !hasLevel) {
      failures.push(`${relPath}: requireTeamAccess called without explicit module and level: requireTeamAccess(${args})`)
      fileHasError = true
    }
  }

  // 4. Must call requireAccess, requireTeamAccess, or requireEmployee
  // requireEmployee is permitted for self-service (/api/me, /api/user) and workspace bootstrap (/api/teams/create, /api/teams)
  const isSelfService =
    relPath.startsWith("app/api/me/") ||
    relPath.startsWith("app/api/user/") ||
    relPath === "app/api/teams/route.ts" ||
    relPath === "app/api/teams/create/route.ts"

  const hasRequireTeamAccess = /\brequireTeamAccess\b/.test(content)
  const hasRequireAccess = /\brequireAccess\b/.test(content)
  const hasRequireEmployee = /\brequireEmployee\b/.test(content)

  if (relPath.startsWith("app/api/teams/[teamId]")) {
    if (!hasRequireTeamAccess) {
      failures.push(`${relPath}: Team route must enforce requireTeamAccess`)
      fileHasError = true
    }
  } else if (isSelfService) {
    if (!hasRequireEmployee && !hasRequireAccess && !hasRequireTeamAccess) {
      failures.push(`${relPath}: Self-service route must call requireEmployee, requireAccess, or requireTeamAccess`)
      fileHasError = true
    }
  } else {
    if (!hasRequireAccess && !hasRequireTeamAccess) {
      failures.push(`${relPath}: Route must call requireAccess or requireTeamAccess`)
      fileHasError = true
    }
  }

  if (fileHasError) {
    failed++
  } else {
    passed++
  }
}

console.log("===================================================")
console.log(`API Guards Check: ${passed} passed, ${failed} failed (Total: ${routes.length})`)
console.log("===================================================")

if (failed > 0) {
  console.error("\nFailures:")
  failures.forEach((f) => console.error(`  ✗ ${f}`))
  process.exit(1)
} else {
  console.log("All route handlers strictly enforce required authz guards!")
  process.exit(0)
}
