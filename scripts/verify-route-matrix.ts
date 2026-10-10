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

async function waitForServer(url: string, maxAttempts = 35): Promise<boolean> {
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
  checkCustom?: (status: number, role: RoleDefinition, resBody?: any) => boolean
  validatePayload?: (status: number, resBody: any, role: RoleDefinition) => boolean
}

async function runMatrixVerification() {
  console.log("===============================================================================")
  console.log("SIU-ERPOS 13-Role Route Authorization Matrix Suite (Step 4)")
  console.log("===============================================================================")

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

  // Print how expectations are computed (Step 4.a)
  console.log("\n[INFO] How expectations are computed:")
  console.log("  - Hand-written route table (matrixRoutes) defines each route path, HTTP method, and required [module, level] list.")
  console.log("  - Route requirements are NOT imported from route code or guard files.")
  console.log("  - For each (route, role) pair, authorization is evaluated using `hasAccess(roleDef.access, module, level)` from lib/role-definitions.ts.")
  console.log("  - Multi-module routes require that ALL module permissions are satisfied (AND semantics).")
  console.log("  - Allowed roles expect HTTP 20x (200, 201, 204). Disallowed roles expect strictly HTTP 403 Forbidden.")
  console.log("  - Special routes (DELETE team, POST teams/create, POST audit-logs) use explicit custom lifecycle checks.")

  // Cleanup tracking
  const tempUserIds: string[] = []
  const tempTeamIds: string[] = []
  const tempProjectIds: string[] = []
  const tempProductIds: string[] = []
  const tempIssueIds: string[] = []
  const tempChannelIds: string[] = []
  const tempLeadIds: string[] = []
  const tempKeyIds: string[] = []
  const tempWebhookIds: string[] = []
  const tempFlowIds: string[] = []

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

    // Create Company Setting for the team
    await prisma.companySetting.create({
      data: {
        teamId: testTeam.id,
        companyName: testTeam.name,
        legalEntityName: `${testTeam.name} Pvt Ltd`,
      },
    })

    // 3. Create One Temporary User & Employee for EACH of the 13 Roles
    console.log(`\n[2] Provisioning 13 Temporary Role Employees (${ROLE_DEFINITIONS.length} total)...`)
    const hashedPassword = await hashPassword(TEST_PASSWORD)

    const roleUsers: Record<string, { id: string; email: string; role: RoleDefinition }> = {}

    for (const roleDef of ROLE_DEFINITIONS) {
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

    // Create Core Project
    const project = await prisma.project.create({
      data: {
        teamId: testTeam.id,
        name: "Matrix Core Project",
        key: "MCP",
      },
    })
    tempProjectIds.push(project.id)

    // Create Workflow State
    const wfState = await prisma.workflowState.create({
      data: {
        teamId: testTeam.id,
        name: "Todo",
        type: "backlog",
        position: 1,
      },
    })

    // Create Domain Product
    const product = await prisma.domainProduct.create({
      data: {
        teamId: testTeam.id,
        name: "Matrix SaaS Product",
        slug: `mx-prod-${Date.now()}`,
        description: "Initial product description",
      },
    })
    tempProductIds.push(product.id)

    // Create Lead Pipeline and Stage
    const pipeline = await prisma.leadPipeline.create({
      data: {
        teamId: testTeam.id,
        name: "Matrix Pipeline",
        isDefault: true,
      },
    })
    const leadStage = await prisma.leadStage.create({
      data: {
        pipelineId: pipeline.id,
        name: "New",
        position: 0,
        type: "open",
      },
    })

    // Create an Automation Rule for flow execution
    const automationRule = await prisma.automationRule.create({
      data: {
        teamId: testTeam.id,
        name: "Matrix Flow Rule",
        triggerType: "lead_won",
        actionType: "create_project",
        isActive: true,
      },
    })
    tempFlowIds.push(automationRule.id)

    // Clear test rate limits
    await prisma.$executeRawUnsafe('DELETE FROM "rateLimit"').catch(() => {})
    await prisma.$executeRawUnsafe('DELETE FROM "rate_limit"').catch(() => {})

    // 4. Start Next.js Production Server on TEST_PORT
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

    // 5. Sign in each role over HTTP to obtain real session cookies
    console.log("\n[4] Authenticating all 13 roles over HTTP...")
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

    // 6. Define the Complete 31 Matrix Routes (Step 4.b)
    const context: Record<string, string> = {
      productId: product.id,
      projectId: project.id,
      wfStateId: wfState.id,
      pipelineId: pipeline.id,
      stageId: leadStage.id,
      flowId: automationRule.id,
    }

    const matrixRoutes: MatrixRoute[] = [
      // 1. reports/financial
      {
        id: "reports_financial",
        name: "GET reports/financial",
        method: "GET",
        pathFn: (t) => `/api/teams/${t}/reports/financial`,
        requirement: {
          multi: [
            { module: AppModule.REPORTS, level: AccessLevel.VIEW },
            { module: AppModule.FINANCE, level: AccessLevel.VIEW },
          ],
        },
      },
      // 2. reports/sales
      {
        id: "reports_sales",
        name: "GET reports/sales",
        method: "GET",
        pathFn: (t) => `/api/teams/${t}/reports/sales`,
        requirement: {
          multi: [
            { module: AppModule.REPORTS, level: AccessLevel.VIEW },
            { module: AppModule.CRM, level: AccessLevel.VIEW },
          ],
        },
      },
      // 3. reports/founder-digest
      {
        id: "reports_founder_digest",
        name: "GET reports/founder-digest",
        method: "GET",
        pathFn: (t) => `/api/teams/${t}/reports/founder-digest`,
        requirement: {
          multi: [
            { module: AppModule.REPORTS, level: AccessLevel.VIEW },
            { module: AppModule.FINANCE, level: AccessLevel.VIEW },
            { module: AppModule.CRM, level: AccessLevel.VIEW },
          ],
        },
      },
      // 4. reports/delivery
      {
        id: "reports_delivery",
        name: "GET reports/delivery",
        method: "GET",
        pathFn: (t) => `/api/teams/${t}/reports/delivery`,
        requirement: {
          multi: [
            { module: AppModule.REPORTS, level: AccessLevel.VIEW },
            { module: AppModule.WORK, level: AccessLevel.VIEW },
          ],
        },
      },
      // 5. finance/overview
      {
        id: "finance_overview",
        name: "GET finance/overview",
        method: "GET",
        pathFn: (t) => `/api/teams/${t}/finance/overview`,
        requirement: { module: AppModule.FINANCE, level: AccessLevel.VIEW },
      },
      // 6. finance/payments
      {
        id: "finance_payments",
        name: "GET finance/payments",
        method: "GET",
        pathFn: (t) => `/api/teams/${t}/finance/payments`,
        requirement: { module: AppModule.FINANCE, level: AccessLevel.VIEW },
      },
      // 7. finance/tax-summary
      {
        id: "finance_tax_summary",
        name: "GET finance/tax-summary",
        method: "GET",
        pathFn: (t) => `/api/teams/${t}/finance/tax-summary`,
        requirement: { module: AppModule.FINANCE, level: AccessLevel.VIEW },
      },
      // 8. crm/leads GET
      {
        id: "crm_leads_get",
        name: "GET crm/leads",
        method: "GET",
        pathFn: (t) => `/api/teams/${t}/crm/leads`,
        requirement: { module: AppModule.CRM, level: AccessLevel.VIEW },
      },
      // 9. crm/leads DELETE
      {
        id: "crm_leads_delete",
        name: "DELETE crm/leads/[id]",
        method: "DELETE",
        pathFn: async (t, ctx) => {
          const lead = await prisma.lead.create({
            data: {
              teamId: t,
              pipelineId: ctx.pipelineId,
              stageId: ctx.stageId,
              title: `Delete Lead ${Date.now()}`,
            },
          })
          tempLeadIds.push(lead.id)
          return `/api/teams/${t}/crm/leads/${lead.id}`
        },
        requirement: { module: AppModule.CRM, level: AccessLevel.MANAGE },
      },
      // 10. issues POST
      {
        id: "work_issues_post",
        name: "POST issues",
        method: "POST",
        pathFn: (t) => `/api/teams/${t}/issues`,
        bodyFn: () => ({
          title: `Matrix Issue ${Date.now()}`,
          projectId: context.projectId,
          workflowStateId: context.wfStateId,
        }),
        requirement: { module: AppModule.WORK, level: AccessLevel.WRITE },
      },
      // 11. issues DELETE
      {
        id: "work_issues_delete",
        name: "DELETE issues/[id]",
        method: "DELETE",
        pathFn: async (t, ctx) => {
          const issue = await prisma.issue.create({
            data: {
              team: { connect: { id: t } },
              project: { connect: { id: ctx.projectId } },
              workflowState: { connect: { id: ctx.wfStateId } },
              title: `Delete Issue ${Date.now()}`,
              number: Math.floor(Math.random() * 800000 + 100000),
              creatorId: roleUsers["owner"].id,
              creator: "Test Owner",
            },
          })
          tempIssueIds.push(issue.id)
          return `/api/teams/${t}/issues/${issue.id}`
        },
        requirement: { module: AppModule.WORK, level: AccessLevel.MANAGE },
      },
      // 12. labels POST
      {
        id: "work_labels_post",
        name: "POST labels",
        method: "POST",
        pathFn: (t) => `/api/teams/${t}/labels`,
        bodyFn: () => ({
          name: `lbl-${Date.now()}-${Math.floor(Math.random() * 999)}`,
          color: "#3b82f6",
        }),
        requirement: { module: AppModule.WORK, level: AccessLevel.MANAGE },
      },
      // 13. workflow-states POST
      {
        id: "work_workflow_states_post",
        name: "POST workflow-states",
        method: "POST",
        pathFn: (t) => `/api/teams/${t}/workflow-states`,
        bodyFn: () => ({
          name: `st-${Date.now()}-${Math.floor(Math.random() * 999)}`,
          type: "backlog",
          color: "#64748b",
        }),
        requirement: { module: AppModule.WORK, level: AccessLevel.MANAGE },
      },
      // 14. channels POST
      {
        id: "collab_channels_post",
        name: "POST channels",
        method: "POST",
        pathFn: (t) => `/api/teams/${t}/channels`,
        bodyFn: () => ({
          name: `ch-${Date.now()}-${Math.floor(Math.random() * 999)}`,
          type: "channel",
        }),
        requirement: { module: AppModule.COLLAB, level: AccessLevel.WRITE },
      },
      // 15. products PATCH
      {
        id: "products_patch",
        name: "PATCH products/[id]",
        method: "PATCH",
        pathFn: (t, ctx) => `/api/teams/${t}/products/${ctx.productId}`,
        bodyFn: () => ({
          description: `Updated description via matrix suite ${Date.now()}`,
        }),
        requirement: { module: AppModule.PRODUCTS, level: AccessLevel.WRITE },
      },
      // 16. api-keys GET
      {
        id: "api_keys_get",
        name: "GET api-keys",
        method: "GET",
        pathFn: (t) => `/api/teams/${t}/api-keys`,
        requirement: { module: AppModule.DEV_SETTINGS, level: AccessLevel.VIEW },
      },
      // 17. api-keys POST
      {
        id: "api_keys_post",
        name: "POST api-keys",
        method: "POST",
        pathFn: (t) => `/api/teams/${t}/api-keys`,
        bodyFn: () => ({
          name: `Matrix Key ${Date.now()}`,
          scopes: ["tasks:read"],
        }),
        requirement: { module: AppModule.DEV_SETTINGS, level: AccessLevel.WRITE },
      },
      // 18. api-keys DELETE
      {
        id: "api_keys_delete",
        name: "DELETE api-keys/[id]",
        method: "DELETE",
        pathFn: async (t) => {
          const key = await prisma.developerApiKey.create({
            data: {
              teamId: t,
              name: `Delete Key ${Date.now()}`,
              keyPrefix: "sk_test",
              keyHash: `hash_${Date.now()}`,
              createdBy: roleUsers["owner"].id,
              createdByName: "Owner",
            },
          })
          tempKeyIds.push(key.id)
          return `/api/teams/${t}/api-keys/${key.id}`
        },
        requirement: { module: AppModule.DEV_SETTINGS, level: AccessLevel.MANAGE },
      },
      // 19. webhooks GET
      {
        id: "webhooks_get",
        name: "GET webhooks",
        method: "GET",
        pathFn: (t) => `/api/teams/${t}/webhooks`,
        requirement: { module: AppModule.DEV_SETTINGS, level: AccessLevel.VIEW },
      },
      // 20. webhooks POST
      {
        id: "webhooks_post",
        name: "POST webhooks",
        method: "POST",
        pathFn: (t) => `/api/teams/${t}/webhooks`,
        bodyFn: () => ({
          url: "https://example.com/matrix-hook",
          events: ["task.created"],
        }),
        requirement: { module: AppModule.DEV_SETTINGS, level: AccessLevel.WRITE },
      },
      // 21. webhooks DELETE
      {
        id: "webhooks_delete",
        name: "DELETE webhooks/[id]",
        method: "DELETE",
        pathFn: async (t) => {
          const wh = await prisma.webhookEndpoint.create({
            data: {
              teamId: t,
              url: `https://example.com/del-hook-${Date.now()}`,
              secret: `sec_${Date.now()}`,
              events: ["task.created"],
            },
          })
          tempWebhookIds.push(wh.id)
          return `/api/teams/${t}/webhooks/${wh.id}`
        },
        requirement: { module: AppModule.DEV_SETTINGS, level: AccessLevel.MANAGE },
      },
      // 22. automations POST
      {
        id: "automations_post",
        name: "POST automations",
        method: "POST",
        pathFn: (t) => `/api/teams/${t}/automations`,
        bodyFn: () => ({
          name: `Matrix Rule ${Date.now()}`,
          triggerType: "lead_won",
          actionType: "create_project",
        }),
        requirement: { module: AppModule.AUTOMATIONS, level: AccessLevel.WRITE },
      },
      // 23. flows run
      {
        id: "flows_run",
        name: "POST flows/[id]/run",
        method: "POST",
        pathFn: (t, ctx) => `/api/teams/${t}/flows/${ctx.flowId}/run`,
        requirement: { module: AppModule.AUTOMATIONS, level: AccessLevel.WRITE },
      },
      // 24. audit-logs GET
      {
        id: "audit_logs_get",
        name: "GET audit-logs",
        method: "GET",
        pathFn: (t) => `/api/teams/${t}/audit-logs`,
        requirement: { module: AppModule.AUDIT_LOGS, level: AccessLevel.VIEW },
      },
      // 25. audit-logs POST (405 for everyone)
      {
        id: "audit_logs_post",
        name: "POST audit-logs (405 strict)",
        method: "POST",
        pathFn: (t) => `/api/teams/${t}/audit-logs`,
        bodyFn: () => ({
          action: "TEST_FORGE",
          entityType: "security",
        }),
        requirement: "custom",
        checkCustom: (status) => status === 405,
      },
      // 26. export (COMPANY_SETTINGS MANAGE)
      {
        id: "export",
        name: "GET export (COMPANY_SETTINGS MANAGE)",
        method: "GET",
        pathFn: (t) => `/api/teams/${t}/export`,
        requirement: { module: AppModule.COMPANY_SETTINGS, level: AccessLevel.MANAGE },
      },
      // 27. company-settings GET
      {
        id: "company_settings_get",
        name: "GET company-settings",
        method: "GET",
        pathFn: (t) => `/api/teams/${t}/company-settings`,
        requirement: { module: AppModule.COMPANY_SETTINGS, level: AccessLevel.VIEW },
      },
      // 28. company-settings write
      {
        id: "company_settings_write",
        name: "PUT company-settings",
        method: "PUT",
        pathFn: (t) => `/api/teams/${t}/company-settings`,
        bodyFn: () => ({
          companyName: `Updated Team ${Date.now()}`,
        }),
        requirement: { module: AppModule.COMPANY_SETTINGS, level: AccessLevel.MANAGE },
      },
      // 29. members GET (reduced fields)
      {
        id: "members_get",
        name: "GET members (reduced directory fields)",
        method: "GET",
        pathFn: (t) => `/api/teams/${t}/members`,
        requirement: { module: AppModule.WORK, level: AccessLevel.VIEW },
        validatePayload: (status, resBody, role) => {
          if (status !== 200) return false
          if (!Array.isArray(resBody)) return false
          // Check that no forbidden fields are leaked
          for (const m of resBody) {
            if ("phone" in m && m.phone !== undefined && m.phone !== null) return false
            if ("personalEmail" in m && m.personalEmail !== undefined && m.personalEmail !== null) return false
            if ("employeeCode" in m && m.employeeCode !== undefined && m.employeeCode !== null) return false
            if ("mustChangePassword" in m && m.mustChangePassword !== undefined && m.mustChangePassword !== null) return false
            if ("passwordHash" in m || "password" in m || "session" in m || "suspendedAt" in m) return false
          }
          return true
        },
      },
      // 30. DELETE team (Owner wrong name -> 400, others -> 403)
      {
        id: "team_delete",
        name: "DELETE team (Owner wrong name 400, others 403)",
        method: "DELETE",
        pathFn: (t) => `/api/teams/${t}`,
        bodyFn: () => ({
          confirmName: "WRONG_NAME_DO_NOT_DELETE",
        }),
        requirement: "custom",
        checkCustom: (status, role) => (role.key === "owner" ? status === 400 : status === 403),
      },
      // 31. POST teams/create (403 or 410 for all)
      {
        id: "team_create",
        name: "POST teams/create (closed 403/410)",
        method: "POST",
        pathFn: () => `/api/teams/create`,
        bodyFn: () => ({
          name: "Second Forbidden Workspace Team",
        }),
        requirement: "custom",
        checkCustom: (status) => status === 403 || status === 410,
      },
    ]

    // 7. Execute Test Matrix (31 routes x 13 roles = 403 tests)
    console.log(`\n[5] Executing Complete 13-Role Authorization Matrix (31 routes x 13 roles = ${matrixRoutes.length * ROLE_DEFINITIONS.length} tests)...`)
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
        let resBody: any = null
        if (actual === 200 && (route.id === "members_get" || route.validatePayload)) {
          try {
            resBody = await res.json()
          } catch {}
        }

        let passed = false
        let expectedDesc = ""

        if (route.requirement === "custom" && route.checkCustom) {
          passed = route.checkCustom(actual, roleDef, resBody)
          expectedDesc = route.id === "team_delete" ? (roleDef.key === "owner" ? "400" : "403") : "403/405/410"
        } else if (typeof route.requirement === "object") {
          let allowed = false
          if ("multi" in route.requirement) {
            allowed = route.requirement.multi.every((req) => hasAccess(roleDef.access, req.module, req.level))
          } else {
            allowed = hasAccess(roleDef.access, route.requirement.module, route.requirement.level)
          }

          if (allowed) {
            if (route.validatePayload) {
              passed = route.validatePayload(actual, resBody, roleDef)
            } else {
              passed = [200, 201, 204].includes(actual)
            }
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

    // 8. Named Assertions (Step 4.c)
    console.log("\n===============================================================================")
    console.log("NAMED ASSERTIONS VERIFICATION (Step 4.c)")
    console.log("===============================================================================")
    const namedAssertions = [
      {
        label: "developer -> reports/financial 403",
        role: "developer",
        routeId: "reports_financial",
        check: (s: number) => s === 403,
      },
      {
        label: "hr -> reports/financial 403",
        role: "hr",
        routeId: "reports_financial",
        check: (s: number) => s === 403,
      },
      {
        label: "hr -> export 403",
        role: "hr",
        routeId: "export",
        check: (s: number) => s === 403,
      },
      {
        label: "cto -> export 403",
        role: "cto",
        routeId: "export",
        check: (s: number) => s === 403,
      },
      {
        label: "ceo -> DELETE team 403",
        role: "ceo",
        routeId: "team_delete",
        check: (s: number) => s === 403,
      },
      {
        label: "ceo -> POST teams/create 403 or 410",
        role: "ceo",
        routeId: "team_create",
        check: (s: number) => s === 403 || s === 410,
      },
      {
        label: "viewer -> POST issues 403",
        role: "viewer",
        routeId: "work_issues_post",
        check: (s: number) => s === 403,
      },
      {
        label: "sales_executive -> finance/overview 403",
        role: "sales_executive",
        routeId: "finance_overview",
        check: (s: number) => s === 403,
      },
    ]

    let allNamedPassed = true
    for (const na of namedAssertions) {
      const result = gridResults[na.routeId]?.[na.role]
      const ok = result && na.check(result.actual)
      if (ok) {
        console.log(`  ✓ PASS: ${na.label.padEnd(46)} [HTTP ${result.actual}]`)
      } else {
        allNamedPassed = false
        console.error(`  ✗ FAIL: ${na.label.padEnd(46)} [Got HTTP ${result?.actual}]`)
      }
    }

    // 9. Print the Pass/Fail Grid (Step 4.d)
    console.log("\n======================================================================================================================")
    console.log("ROLE AUTHORIZATION PASS / FAIL GRID (Step 4.d)")
    console.log("======================================================================================================================")
    const roleKeys = ROLE_DEFINITIONS.map((r) => r.key)

    const headerRow =
      "Route".padEnd(38) +
      " | " +
      roleKeys.map((k) => k.slice(0, 5).padEnd(5)).join(" ")
    console.log(headerRow)
    console.log("-".repeat(headerRow.length))

    for (const route of matrixRoutes) {
      const rowStatuses = roleKeys.map((k) => {
        const item = gridResults[route.id][k]
        return item.passed ? "  P  " : ` ${item.actual} `
      })
      console.log(route.name.slice(0, 38).padEnd(38) + " | " + rowStatuses.join(" "))
    }
    console.log("======================================================================================================================")
    console.log(`Grid Tests Summary: ${passedTests}/${totalTests} PASSED (Failures: ${failedTests})`)

    // 10. Production-Mode HTTP Auth & Rate Limiting Checks (Step 3.b & Step 2.d)
    console.log("\n[6] Production-Mode HTTP Auth & Rate Limiting Verification...")

    // 10.A: 6th wrong password attempt returns 429
    console.log("  Testing 6th wrong password sign-in rate limit (max 5 per 10min)...")
    const attackEmail = `rate-limit-test-${Date.now()}@test.internal`
    let got429 = false
    const rateLimitStatuses: number[] = []

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

    // 10.B: Valid sign-in sets cookie and GET /dashboard returns 200 without redirect
    console.log("  Testing valid sign-in and direct GET /dashboard without redirect loop (Step 3.b)...")
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

    // 10.C: Unauthenticated GET /dashboard redirects to /sign-in
    console.log("  Testing unauthenticated GET /dashboard redirect (Step 3.b)...")
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

    if (failedTests > 0 || !got429 || !dashPassed || !isRedirect || !allNamedPassed) {
      process.exitCode = 1
      throw new Error(`Matrix verification encountered failures: ${failedTests} route checks failed, named assertions passed: ${allNamedPassed}`)
    }

    console.log("\n===============================================================================")
    console.log("ALL MATRIX CHECKS AND NAMED ASSERTIONS PASSED SUCCESSFULLY!")
    console.log("===============================================================================")
  } finally {
    // 11. Clean up all temporary records
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
      if (tempKeyIds.length > 0) {
        await prisma.developerApiKey.deleteMany({ where: { id: { in: tempKeyIds } } }).catch(() => {})
      }
      if (tempWebhookIds.length > 0) {
        await prisma.webhookEndpoint.deleteMany({ where: { id: { in: tempWebhookIds } } }).catch(() => {})
      }
      if (tempFlowIds.length > 0) {
        await prisma.automationRule.deleteMany({ where: { id: { in: tempFlowIds } } }).catch(() => {})
      }
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
        await prisma.companySetting.deleteMany({ where: { teamId: { in: tempTeamIds } } }).catch(() => {})
        await prisma.leadStage.deleteMany({ where: { pipeline: { teamId: { in: tempTeamIds } } } }).catch(() => {})
        await prisma.leadPipeline.deleteMany({ where: { teamId: { in: tempTeamIds } } }).catch(() => {})
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
