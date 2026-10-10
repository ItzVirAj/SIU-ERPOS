import dotenv from "dotenv"
import path from "path"
import { spawn, ChildProcess } from "child_process"
import crypto from "crypto"

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })
dotenv.config({ path: path.resolve(process.cwd(), ".env") })

import { PrismaClient, EmployeeStatus, AppModule, AccessLevel } from "../lib/prisma-client"
import { hashPassword } from "better-auth/crypto"
import { ROLE_DEFINITIONS, RoleDefinition } from "../lib/role-definitions"
import { hasAccess } from "../lib/permissions"

const prisma = new PrismaClient()

const TEST_PORT = 3099
const BASE_URL = `http://localhost:${TEST_PORT}`
const TEST_PASSWORD = "MatrixPass@2026!"

async function waitForServer(url: string, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${url}/api/auth/ok`, { method: "GET" }).catch(() => null)
      if (res && res.status < 500) return true
      const resRoot = await fetch(url).catch(() => null)
      if (resRoot && resRoot.status < 500) return true
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  return false
}

interface MatrixRoute {
  id: string
  name: string
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  pathFn: (teamId: string, ctx: Record<string, string>, role: RoleDefinition) => string | Promise<string>
  bodyFn?: (team: any) => any
  requirement:
    | { module: AppModule; level: AccessLevel }
    | { multi: Array<{ module: AppModule; level: AccessLevel }> }
    | "custom"
  checkCustom?: (status: number, role: RoleDefinition) => boolean
}

async function runMatrixVerification() {
  console.log("===================================================")
  console.log("SIU-ERPOS 13-Role Route Authorization Matrix Suite")
  console.log("===================================================")

  // 1. Guard against non-dev databases
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL is missing")
  const dbHost = new URL(databaseUrl).hostname
  console.log(`Database Host: ${dbHost}`)

  const isDevOrLocal =
    dbHost === "localhost" ||
    dbHost === "127.0.0.1" ||
    dbHost.includes("neon.tech") ||
    dbHost.includes("supabase.co") ||
    dbHost.includes("dev")

  if (!isDevOrLocal && process.env.ALLOW_PROD_SEED !== "1") {
    throw new Error(`Execution blocked: host "${dbHost}" is not a recognized dev database`)
  }

  // Cleanup tracking
  const tempUserIds: string[] = []
  const tempTeamIds: string[] = []
  const tempProjectIds: string[] = []
  const tempProductIds: string[] = []
  const tempIssueIds: string[] = []
  const tempChannelIds: string[] = []
  const tempLeadIds: string[] = []

  let serverProcess: ChildProcess | null = null

  try {
    // 2. Create Temporary Test Team
    console.log("\n[1] Creating Temporary Workspace Team...")
    const randKey = `MX${Math.floor(Math.random() * 899 + 100)}`
    const testTeam = await prisma.team.create({
      data: {
        name: `Matrix Test Team ${Date.now()}`,
        key: randKey,
      },
    })
    tempTeamIds.push(testTeam.id)

    // 2. Create One Temporary User & Employee for EACH of the 13 Roles
    console.log(`\n[2] Provisioning 13 Temporary Role Employees (${ROLE_DEFINITIONS.length} total)...`)
    const hashedPassword = await hashPassword(TEST_PASSWORD)

    const roleUsers: Record<string, { id: string; email: string; role: RoleDefinition }> = {}

    for (const roleDef of ROLE_DEFINITIONS) {
      // Find the database role record matching key
      const dbRole = await prisma.role.findUniqueOrThrow({ where: { key: roleDef.key } })

      const userId = crypto.randomUUID()
      const email = `temp-matrix-${roleDef.key}-${Date.now()}@test.internal`
      const name = `Test ${roleDef.name}`

      await prisma.user.create({
        data: {
          id: userId,
          email,
          name,
          emailVerified: true,
        },
      })
      tempUserIds.push(userId)

      await prisma.account.create({
        data: {
          id: crypto.randomUUID(),
          userId,
          accountId: userId,
          providerId: "credential",
          password: hashedPassword,
        },
      })

      await prisma.employee.create({
        data: {
          userId,
          teamId: testTeam.id,
          roleId: dbRole.id,
          fullName: name,
          email,
          status: EmployeeStatus.ACTIVE,
          mustChangePassword: false,
          defaultPasswordExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      })

      await prisma.teamMember.create({
        data: {
          teamId: testTeam.id,
          userId,
          role: roleDef.legacyTeamRole,
          userName: name,
          userEmail: email,
        },
      })

      roleUsers[roleDef.key] = {
        id: userId,
        email,
        role: roleDef,
      }
    }

    // Create a temporary project
    const project = await prisma.project.create({
      data: {
        teamId: testTeam.id,
        name: "Matrix Core Project",
        key: "MCP",
      },
    })
    tempProjectIds.push(project.id)

    // Create a temporary workflow state
    const wfState = await prisma.workflowState.create({
      data: {
        teamId: testTeam.id,
        name: "Todo",
        type: "backlog",
        position: 1,
      },
    })

    // Create a temporary issue for deletion test
    const issue = await prisma.issue.create({
      data: {
        team: { connect: { id: testTeam.id } },
        project: { connect: { id: project.id } },
        workflowState: { connect: { id: wfState.id } },
        title: "Matrix Temporary Issue",
        number: 1,
        creatorId: roleUsers["owner"].id,
        creator: "Test Owner",
      },
    })
    tempIssueIds.push(issue.id)

    // Create a temporary domain product for patch test
    const product = await prisma.domainProduct.create({
      data: {
        teamId: testTeam.id,
        name: "Matrix SaaS Product",
        slug: `mx-prod-${Date.now()}`,
        description: "Initial product description",
      },
    })
    tempProductIds.push(product.id)

    // Clear test rate limits
    await prisma.$executeRawUnsafe('DELETE FROM "rateLimit"').catch(() => {})
    await prisma.$executeRawUnsafe('DELETE FROM "rate_limit"').catch(() => {})

    // 4. Start Next.js Server on TEST_PORT
    console.log(`\n[3] Starting Next.js Production Server on Port ${TEST_PORT}...`)
    const isWindows = process.platform === "win32"
    const nextCmd = isWindows ? "npx.cmd" : "npx"

    serverProcess = spawn(nextCmd, ["next", "start", "-p", String(TEST_PORT)], {
      cwd: process.cwd(),
      shell: true,
      env: {
        ...process.env,
        PORT: String(TEST_PORT),
        BETTER_AUTH_URL: BASE_URL,
        NEXT_PUBLIC_APP_URL: BASE_URL,
      },
      stdio: "pipe",
    })

    serverProcess.stderr?.on("data", (data) => {
      const errStr = data.toString()
      if (!errStr.includes("Warning") && !errStr.includes("ExperimentalWarning")) {
        console.error(`  [Next.js Server Error]: ${errStr.trim()}`)
      }
    })

    const ready = await waitForServer(BASE_URL, 45)
    if (!ready) {
      throw new Error(`Next.js test server failed to start within timeout on port ${TEST_PORT}`)
    }
    console.log(`  ✓ Next.js server live at ${BASE_URL}`)

    // 5. Sign in each role over HTTP to obtain real signed cookies
    console.log("\n[4] Signing in all 13 roles over HTTP...")
    const roleCookies: Record<string, string> = {}
    let roleIdx = 0

    for (const [key, userObj] of Object.entries(roleUsers)) {
      roleIdx++
      const clientIp = `192.168.10.${roleIdx}`
      const signInRes = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": clientIp,
        },
        body: JSON.stringify({ email: userObj.email, password: TEST_PASSWORD }),
      })

      if (!signInRes.ok) {
        throw new Error(`Failed to sign in role ${key} (${userObj.email}): HTTP ${signInRes.status}`)
      }

      const setCookies = (signInRes.headers as any).getSetCookie
        ? (signInRes.headers as any).getSetCookie()
        : [signInRes.headers.get("set-cookie")].filter(Boolean)

      const cookieHeader = setCookies.map((c: string) => c.split(";")[0]).join("; ")
      roleCookies[key] = cookieHeader
      console.log(`  ✓ Authenticated ${key.padEnd(20)} [cookie acquired]`)
    }

    // 6. Define Matrix Routes
    // Every expectation is generated algorithmically from lib/role-definitions.ts using hasAccess
    const context: Record<string, string> = {
      issueId: issue.id,
      productId: product.id,
      projectId: project.id,
      wfStateId: wfState.id,
    }

    const matrixRoutes: MatrixRoute[] = [
      // WORK MODULE
      {
        id: "work_overview",
        name: "GET /api/teams/[id]/projects",
        method: "GET",
        pathFn: (t) => `/api/teams/${t}/projects`,
        requirement: { module: AppModule.WORK, level: AccessLevel.VIEW },
      },
      {
        id: "work_issue_create",
        name: "POST /api/teams/[id]/issues",
        method: "POST",
        pathFn: (t) => `/api/teams/${t}/issues`,
        bodyFn: () => ({
          title: `Matrix Created Issue ${Date.now()}`,
          projectId: context.projectId,
          workflowStateId: context.wfStateId,
        }),
        requirement: { module: AppModule.WORK, level: AccessLevel.WRITE },
      },
      {
        id: "work_issue_delete",
        name: "DELETE /api/teams/[id]/issues/[id]",
        method: "DELETE",
        pathFn: async (t, ctx) => {
          const toDelete = await prisma.issue.create({
            data: {
              team: { connect: { id: t } },
              project: { connect: { id: ctx.projectId } },
              workflowState: { connect: { id: ctx.wfStateId } },
              title: `Delete Test Issue ${Date.now()}`,
              number: Math.floor(Math.random() * 800000 + 100000),
              creatorId: roleUsers["owner"].id,
              creator: "Test Owner",
            },
          })
          tempIssueIds.push(toDelete.id)
          return `/api/teams/${t}/issues/${toDelete.id}`
        },
        requirement: { module: AppModule.WORK, level: AccessLevel.MANAGE },
      },

      // COLLAB MODULE
      {
        id: "collab_calendar",
        name: "GET /api/teams/[id]/calendar/events",
        method: "GET",
        pathFn: (t) => `/api/teams/${t}/calendar/events`,
        requirement: { module: AppModule.COLLAB, level: AccessLevel.VIEW },
      },
      {
        id: "collab_channel_create",
        name: "POST /api/teams/[id]/channels",
        method: "POST",
        pathFn: (t) => `/api/teams/${t}/channels`,
        bodyFn: () => ({
          name: `mx-ch-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          type: "channel",
        }),
        requirement: { module: AppModule.COLLAB, level: AccessLevel.WRITE },
      },

      // CRM MODULE
      {
        id: "crm_leads_list",
        name: "GET /api/teams/[id]/crm/leads",
        method: "GET",
        pathFn: (t) => `/api/teams/${t}/crm/leads`,
        requirement: { module: AppModule.CRM, level: AccessLevel.VIEW },
      },
      {
        id: "crm_leads_create",
        name: "POST /api/teams/[id]/crm/leads",
        method: "POST",
        pathFn: (t) => `/api/teams/${t}/crm/leads`,
        bodyFn: () => ({
          title: "New Matrix Lead",
          estimatedValue: 10000,
        }),
        requirement: { module: AppModule.CRM, level: AccessLevel.WRITE },
      },

      // FINANCE MODULE
      {
        id: "finance_overview",
        name: "GET /api/teams/[id]/finance/overview",
        method: "GET",
        pathFn: (t) => `/api/teams/${t}/finance/overview`,
        requirement: { module: AppModule.FINANCE, level: AccessLevel.VIEW },
      },
      {
        id: "finance_payments",
        name: "GET /api/teams/[id]/finance/payments",
        method: "GET",
        pathFn: (t) => `/api/teams/${t}/finance/payments`,
        requirement: { module: AppModule.FINANCE, level: AccessLevel.VIEW },
      },
      {
        id: "finance_expenses_create",
        name: "POST /api/teams/[id]/finance/expenses",
        method: "POST",
        pathFn: (t) => `/api/teams/${t}/finance/expenses`,
        bodyFn: () => ({
          vendorName: "AWS Cloud Infrastructure",
          amount: 1200,
          category: "SOFTWARE_SAAS",
        }),
        requirement: { module: AppModule.FINANCE, level: AccessLevel.WRITE },
      },

      // PRODUCTS MODULE
      {
        id: "products_overview",
        name: "GET /api/teams/[id]/products/overview",
        method: "GET",
        pathFn: (t) => `/api/teams/${t}/products/overview`,
        requirement: { module: AppModule.PRODUCTS, level: AccessLevel.VIEW },
      },
      {
        id: "products_patch",
        name: "PATCH /api/teams/[id]/products/[id]",
        method: "PATCH",
        pathFn: (t, ctx) => `/api/teams/${t}/products/${ctx.productId}`,
        bodyFn: () => ({
          description: "Updated description via matrix suite",
        }),
        requirement: { module: AppModule.PRODUCTS, level: AccessLevel.WRITE },
      },

      // REPORTS MODULE (Multi-module requirements)
      {
        id: "reports_financial",
        name: "GET /api/teams/[id]/reports/financial",
        method: "GET",
        pathFn: (t) => `/api/teams/${t}/reports/financial`,
        requirement: {
          multi: [
            { module: AppModule.REPORTS, level: AccessLevel.VIEW },
            { module: AppModule.FINANCE, level: AccessLevel.VIEW },
          ],
        },
      },
      {
        id: "reports_sales",
        name: "GET /api/teams/[id]/reports/sales",
        method: "GET",
        pathFn: (t) => `/api/teams/${t}/reports/sales`,
        requirement: {
          multi: [
            { module: AppModule.REPORTS, level: AccessLevel.VIEW },
            { module: AppModule.CRM, level: AccessLevel.VIEW },
          ],
        },
      },

      // AUTOMATIONS MODULE
      {
        id: "automations_list",
        name: "GET /api/teams/[id]/automations",
        method: "GET",
        pathFn: (t) => `/api/teams/${t}/automations`,
        requirement: { module: AppModule.AUTOMATIONS, level: AccessLevel.VIEW },
      },
      {
        id: "flows_list",
        name: "GET /api/teams/[id]/flows",
        method: "GET",
        pathFn: (t) => `/api/teams/${t}/flows`,
        requirement: { module: AppModule.AUTOMATIONS, level: AccessLevel.VIEW },
      },

      // DEV SETTINGS MODULE
      {
        id: "api_keys_get",
        name: "GET /api/teams/[id]/api-keys",
        method: "GET",
        pathFn: (t) => `/api/teams/${t}/api-keys`,
        requirement: { module: AppModule.DEV_SETTINGS, level: AccessLevel.VIEW },
      },
      {
        id: "api_keys_post",
        name: "POST /api/teams/[id]/api-keys",
        method: "POST",
        pathFn: (t) => `/api/teams/${t}/api-keys`,
        bodyFn: () => ({
          name: `Matrix Key ${Date.now()}`,
          scopes: ["tasks:read"],
        }),
        requirement: { module: AppModule.DEV_SETTINGS, level: AccessLevel.WRITE },
      },
      {
        id: "webhooks_post",
        name: "POST /api/teams/[id]/webhooks",
        method: "POST",
        pathFn: (t) => `/api/teams/${t}/webhooks`,
        bodyFn: () => ({
          url: "https://example.com/webhook",
          events: ["task.created"],
        }),
        requirement: { module: AppModule.DEV_SETTINGS, level: AccessLevel.WRITE },
      },

      // COMPANY SETTINGS & EXPORT
      {
        id: "company_settings_get",
        name: "GET /api/teams/[id]/company-settings",
        method: "GET",
        pathFn: (t) => `/api/teams/${t}/company-settings`,
        requirement: { module: AppModule.COMPANY_SETTINGS, level: AccessLevel.VIEW },
      },
      {
        id: "company_export",
        name: "GET /api/teams/[id]/export",
        method: "GET",
        pathFn: (t) => `/api/teams/${t}/export`,
        requirement: { module: AppModule.COMPANY_SETTINGS, level: AccessLevel.MANAGE },
      },

      // AUDIT LOGS
      {
        id: "audit_logs_get",
        name: "GET /api/teams/[id]/audit-logs",
        method: "GET",
        pathFn: (t) => `/api/teams/${t}/audit-logs`,
        requirement: { module: AppModule.AUDIT_LOGS, level: AccessLevel.VIEW },
      },
      {
        id: "audit_logs_post",
        name: "POST /api/teams/[id]/audit-logs",
        method: "POST",
        pathFn: (t) => `/api/teams/${t}/audit-logs`,
        bodyFn: () => ({
          action: "TEST_FORGE",
          entityType: "security",
        }),
        requirement: "custom",
        // Client write removed: strictly returns 405 Method Not Allowed for all roles
        checkCustom: (status) => status === 405,
      },

      // HIGH-RISK TEAM LIFECYCLE
      {
        id: "team_delete",
        name: "DELETE /api/teams/[id] (Owner only)",
        method: "DELETE",
        pathFn: (t) => `/api/teams/${t}`,
        // Send mismatched confirmName so team is NOT actually deleted, but owner gets 400 instead of 403
        bodyFn: () => ({
          confirmName: "WRONG_NAME_DO_NOT_DELETE",
        }),
        requirement: "custom",
        checkCustom: (status, role) => (role.key === "owner" ? status === 400 : status === 403),
      },
      {
        id: "team_create",
        name: "POST /api/teams/create (Single team)",
        method: "POST",
        pathFn: () => `/api/teams/create`,
        bodyFn: () => ({
          name: "Second Workspace Team",
        }),
        requirement: "custom",
        // Existing workspace exists -> strictly returns 403 for all
        checkCustom: (status) => status === 403,
      },
    ]

    // 7. Execute Test Grid (Rows = matrixRoutes, Columns = roles)
    console.log("\n[5] Executing Complete 13-Role Authorization Matrix...")
    const gridResults: Record<string, Record<string, { expected: string; actual: number; passed: boolean }>> = {}

    let totalTests = 0
    let passedTests = 0
    let failedTests = 0

    for (const route of matrixRoutes) {
      gridResults[route.id] = {}

      for (const roleDef of ROLE_DEFINITIONS) {
        const cookie = roleCookies[roleDef.key]
        const pathSuffix = await route.pathFn(testTeam.id, context, roleDef)
        const pathUrl = `${BASE_URL}${pathSuffix}`

        const fetchOptions: RequestInit = {
          method: route.method,
          headers: {
            Cookie: cookie,
            ...(route.bodyFn ? { "Content-Type": "application/json" } : {}),
          },
          ...(route.bodyFn ? { body: JSON.stringify(route.bodyFn(testTeam)) } : {}),
        }

        const res = await fetch(pathUrl, fetchOptions)
        const actual = res.status
        let passed = false
        let expectedDesc = ""

        if (route.requirement === "custom" && route.checkCustom) {
          passed = route.checkCustom(actual, roleDef)
          expectedDesc = route.id === "team_delete" ? (roleDef.key === "owner" ? "400" : "403") : "403/405"
        } else if (typeof route.requirement === "object") {
          let allowed = false
          if ("multi" in route.requirement) {
            allowed = route.requirement.multi.every((req) => hasAccess(roleDef.access, req.module, req.level))
          } else {
            allowed = hasAccess(roleDef.access, route.requirement.module, route.requirement.level)
          }
          if (allowed) {
            passed = [200, 201, 204].includes(actual)
            expectedDesc = "20x"
          } else {
            passed = actual === 403
            expectedDesc = "403"
          }
        }

        totalTests++
        if (passed) passedTests++
        else failedTests++

        gridResults[route.id][roleDef.key] = { expected: expectedDesc, actual, passed }

        if (!passed) {
          console.error(
            `  ✗ FAIL [${roleDef.key}] ${route.method} ${route.name} -> Expected ${expectedDesc}, got ${actual}`
          )
        }
      }
    }

    // 8. Print the Full Matrix Grid Table
    console.log("\n==========================================================================================")
    console.log("ROLE AUTHORIZATION PASS / FAIL GRID")
    console.log("==========================================================================================")
    const roleKeys = ROLE_DEFINITIONS.map((r) => r.key)

    // Header row
    const headerRow =
      "Route".padEnd(34) +
      " | " +
      roleKeys.map((k) => k.slice(0, 5).padEnd(5)).join(" ")
    console.log(headerRow)
    console.log("-".repeat(headerRow.length))

    for (const route of matrixRoutes) {
      const rowStatuses = roleKeys.map((k) => {
        const item = gridResults[route.id][k]
        return item.passed ? "  P  " : ` ${item.actual} `
      })
      console.log(route.name.slice(0, 34).padEnd(34) + " | " + rowStatuses.join(" "))
    }
    console.log("==========================================================================================")
    console.log(`Grid Tests Summary: ${passedTests}/${totalTests} PASSED (Failures: ${failedTests})`)

    // 9. Production-Mode HTTP Auth & Rate Limiting Checks
    console.log("\n[6] Production-Mode HTTP Auth & Rate Limiting Verification...")

    // 9.A: 6th wrong password attempt returns 429
    console.log("  Testing 6th wrong password sign-in rate limit (max 5 per 10min)...")
    const attackEmail = `rate-limit-test-${Date.now()}@test.internal`
    let got429 = false
    let rateLimitStatuses: number[] = []

    const attackIp = "198.51.100.99"
    for (let attempt = 1; attempt <= 7; attempt++) {
      const res = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": attackIp,
        },
        body: JSON.stringify({ email: attackEmail, password: "WrongPassword123!" }),
      })
      rateLimitStatuses.push(res.status)
      if (res.status === 429) {
        got429 = true
        console.log(`  ✓ Attempt #${attempt} returned HTTP 429 Too Many Requests`)
        break
      }
    }

    if (!got429) {
      console.error(`  ✗ Expected HTTP 429 on attempts 6-7, got: ${rateLimitStatuses.join(", ")}`)
    } else {
      console.log(`  ✓ Rate limiter triggered as expected: ${rateLimitStatuses.join(" -> ")}`)
    }

    // 9.B: Valid sign-in sets cookie and GET /dashboard returns 200 without redirect
    console.log("  Testing valid sign-in and direct GET /dashboard without redirect loop...")
    const devCookie = roleCookies["developer"]
    const dashRes = await fetch(`${BASE_URL}/dashboard`, {
      method: "GET",
      headers: { Cookie: devCookie },
      redirect: "manual",
    })
    console.log(`  GET /dashboard with valid cookie: HTTP ${dashRes.status}`)
    const dashPassed = dashRes.status === 200
    if (dashPassed) {
      console.log("  ✓ GET /dashboard returned 200 OK directly (no redirect loop)")
    } else {
      console.error(`  ✗ GET /dashboard returned unexpected status ${dashRes.status}`)
    }

    // 9.C: Unauthenticated GET /dashboard redirects to /sign-in
    console.log("  Testing unauthenticated GET /dashboard redirect...")
    const unauthRes = await fetch(`${BASE_URL}/dashboard`, {
      method: "GET",
      redirect: "manual",
    })
    const isRedirect = [302, 307, 308].includes(unauthRes.status)
    const location = unauthRes.headers.get("location") || ""
    console.log(`  Unauthenticated GET /dashboard: HTTP ${unauthRes.status} -> Location: ${location}`)
    if (isRedirect && location.includes("/sign-in")) {
      console.log("  ✓ Unauthenticated request redirected to /sign-in")
    } else {
      console.error(`  ✗ Unauthenticated request did not redirect to /sign-in (got ${unauthRes.status})`)
    }

    // 9.D: X-Forwarded-For spoofing test
    console.log("  Testing X-Forwarded-For header processing...")
    const spoofRes = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "1.2.3.4, 5.6.7.8",
      },
      body: JSON.stringify({ email: attackEmail, password: "WrongPassword123!" }),
    })
    console.log(`  ✓ Proxied request processed with status HTTP ${spoofRes.status}`)

    if (failedTests > 0 || !got429 || !dashPassed || !isRedirect) {
      process.exitCode = 1
      throw new Error(`Matrix verification encountered failures: ${failedTests} route checks failed`)
    }

    console.log("\n===================================================")
    console.log("ALL MATRIX CHECKS PASSED SUCCESSFULLY!")
    console.log("===================================================")
  } finally {
    // 10. Clean up all temporary records
    console.log("\n[7] Cleaning up temporary records...")
    if (serverProcess) {
      try {
        if (process.platform === "win32") {
          spawn("taskkill", ["/pid", String(serverProcess.pid), "/f", "/t"])
        } else {
          serverProcess.kill("SIGTERM")
        }
      } catch {}
      console.log("  ✓ Terminated test Next.js server")
    }

    try {
      if (tempLeadIds.length > 0) {
        await prisma.lead.deleteMany({ where: { id: { in: tempLeadIds } } }).catch(() => {})
      }
      if (tempChannelIds.length > 0) {
        await prisma.teamChannel.deleteMany({ where: { id: { in: tempChannelIds } } }).catch(() => {})
      }
      if (tempIssueIds.length > 0) {
        await prisma.issue.deleteMany({ where: { id: { in: tempIssueIds } } }).catch(() => {})
      }
      if (tempProductIds.length > 0) {
        await prisma.domainProduct.deleteMany({ where: { id: { in: tempProductIds } } }).catch(() => {})
      }
      if (tempProjectIds.length > 0) {
        await prisma.project.deleteMany({ where: { id: { in: tempProjectIds } } }).catch(() => {})
      }
      if (tempTeamIds.length > 0) {
        await prisma.workflowState.deleteMany({ where: { teamId: { in: tempTeamIds } } }).catch(() => {})
        await prisma.teamMember.deleteMany({ where: { teamId: { in: tempTeamIds } } }).catch(() => {})
        await prisma.employee.deleteMany({ where: { teamId: { in: tempTeamIds } } }).catch(() => {})
        await prisma.auditLog.deleteMany({ where: { teamId: { in: tempTeamIds } } }).catch(() => {})
        await prisma.team.deleteMany({ where: { id: { in: tempTeamIds } } }).catch(() => {})
      }
      if (tempUserIds.length > 0) {
        await prisma.session.deleteMany({ where: { userId: { in: tempUserIds } } }).catch(() => {})
        await prisma.account.deleteMany({ where: { userId: { in: tempUserIds } } }).catch(() => {})
        await prisma.employee.deleteMany({ where: { userId: { in: tempUserIds } } }).catch(() => {})
        await prisma.user.deleteMany({ where: { id: { in: tempUserIds } } }).catch(() => {})
      }
      // Purge test rate limit records
      await prisma.$executeRawUnsafe('DELETE FROM "rateLimit"').catch(() => {})
      await prisma.$executeRawUnsafe('DELETE FROM "rate_limit"').catch(() => {})
      console.log("  ✓ Successfully purged temporary test entities and users")
    } catch (cleanupErr) {
      console.error("  Warning during cleanup:", cleanupErr)
    } finally {
      await prisma.$disconnect()
    }
  }
}

runMatrixVerification()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error("Fatal error during matrix verification:", err)
    process.exit(1)
  })
