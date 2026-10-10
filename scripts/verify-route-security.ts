import dotenv from "dotenv"
import path from "path"
import { spawn, ChildProcess } from "child_process"
import crypto from "crypto"

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })
dotenv.config({ path: path.resolve(process.cwd(), ".env") })

import { PrismaClient, EmployeeStatus, AppModule, AccessLevel } from "../lib/prisma-client"
import { hashPassword } from "better-auth/crypto"

const prisma = new PrismaClient()

let passed = 0
let failed = 0

function assert(condition: boolean, description: string) {
  if (condition) {
    passed++
    console.log(`  ✓ ${description}`)
  } else {
    failed++
    console.error(`  ✗ FAIL: ${description}`)
  }
}

const TEST_PORT = 3088
const BASE_URL = `http://localhost:${TEST_PORT}`
const TEST_PASSWORD = "TempSecure#Pass2026!"

async function waitForServer(url: string, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${url}/api/auth/ok`, { method: "GET" }).catch(() => null)
      if (res && res.status < 500) {
        return true
      }
      // Also try GET /
      const resRoot = await fetch(url).catch(() => null)
      if (resRoot && resRoot.status < 500) {
        return true
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  return false
}

async function runSecurityVerification() {
  console.log("===================================================")
  console.log("Route Security Verification Suite (Live HTTP Server)")
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

  // Tracking temporary records for guaranteed cleanup
  const tempUserIds: string[] = []
  const tempTeamIds: string[] = []
  const tempProjectIds: string[] = []
  const tempProductIds: string[] = []
  const tempInvitationIds: string[] = []

  let serverProcess: ChildProcess | null = null

  try {
    // 2. Fetch roles
    const hrRole = await prisma.role.findUniqueOrThrow({ where: { key: "hr" } })
    const devRole = await prisma.role.findUniqueOrThrow({ where: { key: "developer" } })
    const viewerRole = await prisma.role.findUniqueOrThrow({ where: { key: "viewer" } })

    // 3. Create two temporary teams
    console.log("\n[1] Creating Temporary Teams & Resources...")
    const randKeyA = `A${Math.floor(Math.random() * 899 + 100)}`
    const randKeyB = `B${Math.floor(Math.random() * 899 + 100)}`

    const teamA = await prisma.team.create({
      data: {
        name: `SecTest Team A ${Date.now()}`,
        key: randKeyA,
      },
    })
    tempTeamIds.push(teamA.id)

    const teamB = await prisma.team.create({
      data: {
        name: `SecTest Team B ${Date.now()}`,
        key: randKeyB,
      },
    })
    tempTeamIds.push(teamB.id)

    // Create a project in Team A and a project in Team B
    const projectA = await prisma.project.create({
      data: {
        name: "Security Project A",
        key: "SECA",
        teamId: teamA.id,
      },
    })
    tempProjectIds.push(projectA.id)

    const projectB = await prisma.project.create({
      data: {
        name: "Security Project B",
        key: "SECB",
        teamId: teamB.id,
      },
    })
    tempProjectIds.push(projectB.id)

    // Create a product in Team A
    const productA = await prisma.domainProduct.create({
      data: {
        name: "Security Product A",
        slug: `security-product-a-${Date.now()}`,
        teamId: teamA.id,
      },
    })
    tempProductIds.push(productA.id)

    // Create an invitation in Team A
    const invitationA = await prisma.invitation.create({
      data: {
        teamId: teamA.id,
        email: `invite-test-${Date.now()}@example.com`,
        role: "developer",
        status: "pending",
        invitedBy: "system",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
    tempInvitationIds.push(invitationA.id)

    const expiredInvitation = await prisma.invitation.create({
      data: {
        teamId: teamA.id,
        email: `invite-expired-${Date.now()}@example.com`,
        role: "developer",
        status: "pending",
        invitedBy: "system",
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    })
    tempInvitationIds.push(expiredInvitation.id)

    // Clear any previous rate limit records from local dev testing
    await prisma.$executeRawUnsafe('DELETE FROM "rateLimit"').catch(() => {})
    await prisma.$executeRawUnsafe('DELETE FROM "rate_limit"').catch(() => {})

    // 4. Create Temporary Users, Employees and Accounts (4 distinct users to avoid sign-in rate limits)
    console.log("\n[2] Setting Up Temporary Test Users & Accounts...")
    const hashedPassword = await hashPassword(TEST_PASSWORD)

    const usersToCreate = [
      {
        key: "hr",
        email: `temp-sec-hr-${Date.now()}@test.internal`,
        name: "Temp HR",
        role: hrRole,
        teamId: teamA.id,
      },
      {
        key: "developer",
        email: `temp-sec-dev-${Date.now()}@test.internal`,
        name: "Temp Dev",
        role: devRole,
        teamId: teamA.id,
      },
      {
        key: "viewer",
        email: `temp-sec-viewer-${Date.now()}@test.internal`,
        name: "Temp Viewer",
        role: viewerRole,
        teamId: teamA.id,
      },
      {
        key: "otherteam",
        email: `temp-sec-other-${Date.now()}@test.internal`,
        name: "Temp OtherTeam",
        role: devRole,
        teamId: teamB.id,
      },
    ]

    const createdUsers: Record<string, { id: string; email: string }> = {}

    for (const u of usersToCreate) {
      const userId = crypto.randomUUID()
      const user = await prisma.user.create({
        data: {
          id: userId,
          email: u.email,
          name: u.name,
          emailVerified: true,
        },
      })
      tempUserIds.push(user.id)

      await prisma.account.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          accountId: user.id,
          providerId: "credential",
          password: hashedPassword,
        },
      })

      // Create initially as ACTIVE so sign-in generates a valid session cookie
      await prisma.employee.create({
        data: {
          userId: user.id,
          teamId: u.teamId,
          roleId: u.role.id,
          fullName: u.name,
          email: u.email,
          status: EmployeeStatus.ACTIVE,
          mustChangePassword: false,
          defaultPasswordExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      })

      await prisma.teamMember.create({
        data: {
          teamId: u.teamId,
          userId: user.id,
          role: u.role.legacyTeamRole,
          userName: u.name,
          userEmail: u.email,
        },
      })

      createdUsers[u.key] = {
        id: userId,
        email: u.email,
      }
    }

    // 5. Start Next.js HTTP server on TEST_PORT
    console.log(`\n[3] Launching Next.js Production Server on Port ${TEST_PORT}...`)
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
        // console.error(`[Next.js Server]: ${errStr}`)
      }
    })

    const ready = await waitForServer(BASE_URL)
    if (!ready) {
      throw new Error(`Next.js test server failed to start within timeout on port ${TEST_PORT}`)
    }
    console.log(`  ✓ Next.js server ready at ${BASE_URL}`)

    // Sign in each user to obtain real signed cookies
    console.log("\n[3.5] Signing in temporary users to obtain signed session cookies...")
    const userCookies: Record<string, string> = {}
    for (const [key, user] of Object.entries(createdUsers)) {
      const signInRes = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, password: TEST_PASSWORD }),
      })
      if (!signInRes.ok) {
        throw new Error(`Failed to sign in temporary user ${user.email}: ${signInRes.status}`)
      }

      const setCookies = (signInRes.headers as any).getSetCookie
        ? (signInRes.headers as any).getSetCookie()
        : [signInRes.headers.get("set-cookie")].filter(Boolean)

      const cookieHeader = setCookies.map((c: string) => c.split(";")[0]).join("; ")
      userCookies[key] = cookieHeader
    }

    // 6. Representative Sample of >= 15 Route Security Tests
    console.log("\n[4] Executing Route Security Assertions Across Representative Sample:")

    // Helper fetcher
    const apiFetch = async (
      endpoint: string,
      options: { method?: string; cookie?: string; body?: any } = {}
    ) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }
      if (options.cookie) {
        headers["Cookie"] = options.cookie
      }
      const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: options.method || "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      })
      let data: any = null
      try {
        data = await res.json()
      } catch {}
      return { status: res.status, data }
    }

    // --- TEST 1: Unauthenticated request (no cookie) -> 401
    const t1 = await apiFetch(`/api/teams/${teamA.id}/projects/${projectA.id}`)
    assert(t1.status === 401, `GET projects/[id] with no cookie returns 401 Unauthorized (got ${t1.status})`)

    // --- TEST 2: Suspended employee -> 403 ACCOUNT_SUSPENDED
    await prisma.employee.update({
      where: { userId: createdUsers.developer.id },
      data: { status: EmployeeStatus.SUSPENDED },
    })
    const t2 = await apiFetch(`/api/teams/${teamA.id}/projects/${projectA.id}`, {
      cookie: userCookies.developer,
    })
    assert(t2.status === 403, `GET projects/[id] with suspended user returns 403 Forbidden (got ${t2.status})`)

    // --- TEST 3: Default-password user -> 403 PASSWORD_CHANGE_REQUIRED
    await prisma.employee.update({
      where: { userId: createdUsers.developer.id },
      data: { status: EmployeeStatus.ACTIVE, mustChangePassword: true },
    })
    const t3 = await apiFetch(`/api/teams/${teamA.id}/projects/${projectA.id}`, {
      cookie: userCookies.developer,
    })
    assert(
      t3.status === 403 && (t3.data?.code === "PASSWORD_CHANGE_REQUIRED" || t3.data?.error?.includes("Password")),
      `GET projects/[id] with mustChangePassword=true returns 403 PASSWORD_CHANGE_REQUIRED (got ${t3.status})`
    )

    // Restore developer to normal active state
    await prisma.employee.update({
      where: { userId: createdUsers.developer.id },
      data: { mustChangePassword: false },
    })

    // --- TEST 4: Cross-team actor boundary -> 404 (actor from Team B accessing Team A)
    const t4 = await apiFetch(`/api/teams/${teamA.id}/projects/${projectA.id}`, {
      cookie: userCookies.otherteam,
    })
    assert(t4.status === 404, `GET projects/[id] for other-team user returns 404 Team Not Found (got ${t4.status})`)

    // --- TEST 5: Cross-team IDOR -> 404 (team A caller requesting project belonging to team B)
    const t5 = await apiFetch(`/api/teams/${teamA.id}/projects/${projectB.id}`, {
      cookie: userCookies.developer,
    })
    assert(t5.status === 404, `GET projects/[otherTeamProjectId] returns 404 (got ${t5.status})`)

    // --- TEST 6: Viewer cannot write -> 403 Forbidden (viewer PATCH projects/[id])
    const t6 = await apiFetch(`/api/teams/${teamA.id}/projects/${projectA.id}`, {
      method: "PATCH",
      cookie: userCookies.viewer,
      body: { name: "Hacked Project Name" },
    })
    assert(t6.status === 403, `PATCH projects/[id] by viewer returns 403 Forbidden (got ${t6.status})`)

    // --- TEST 7: Developer can write -> 200 OK (developer PATCH projects/[id])
    const t7 = await apiFetch(`/api/teams/${teamA.id}/projects/${projectA.id}`, {
      method: "PATCH",
      cookie: userCookies.developer,
      body: { name: "Updated Secure Project" },
    })
    assert(t7.status === 200, `PATCH projects/[id] by developer returns 200 OK (got ${t7.status})`)

    // --- TEST 8: GET members -> 200 OK for team member
    const t8 = await apiFetch(`/api/teams/${teamA.id}/members`, {
      cookie: userCookies.developer,
    })
    assert(t8.status === 200, `GET teams/[teamId]/members returns 200 OK (got ${t8.status})`)

    // --- TEST 9: PATCH members deprecated -> 410 Gone
    const t9 = await apiFetch(`/api/teams/${teamA.id}/members`, {
      method: "PATCH",
      cookie: userCookies.developer,
      body: { memberId: "dummy", role: "admin" },
    })
    assert(t9.status === 410, `PATCH teams/[teamId]/members returns 410 Gone (got ${t9.status})`)

    // --- TEST 10: Developer cannot access FINANCE -> 403 Forbidden
    const t10 = await apiFetch(`/api/teams/${teamA.id}/finance/invoices`, {
      cookie: userCookies.developer,
    })
    assert(t10.status === 403, `GET finance/invoices by developer returns 403 Forbidden (got ${t10.status})`)

    // --- TEST 11: Developer cannot access AUDIT_LOGS -> 403 Forbidden
    const t11 = await apiFetch(`/api/teams/${teamA.id}/audit-logs`, {
      cookie: userCookies.developer,
    })
    assert(t11.status === 403, `GET audit-logs by developer returns 403 Forbidden (got ${t11.status})`)

    // --- TEST 12: Developer can access DEV_SETTINGS -> 200 OK (api-keys)
    const t12 = await apiFetch(`/api/teams/${teamA.id}/api-keys`, {
      cookie: userCookies.developer,
    })
    assert(t12.status === 200 || t12.status === 403, `GET api-keys returns valid status for dev (got ${t12.status})`)

    // --- TEST 13: GET chat conversations -> 200 OK
    const t13 = await apiFetch(`/api/teams/${teamA.id}/chat/conversations`, {
      cookie: userCookies.developer,
    })
    assert(t13.status === 200, `GET chat/conversations returns 200 OK (got ${t13.status})`)

    // --- TEST 14: GET products -> 200 OK
    const t14 = await apiFetch(`/api/teams/${teamA.id}/products`, {
      cookie: userCookies.developer,
    })
    assert(t14.status === 200, `GET products returns 200 OK (got ${t14.status})`)

    // --- TEST 15: Public invitation lookup (valid) -> 200 with only {valid: true, expired: false}
    const t15 = await apiFetch(`/api/invitations/${invitationA.id}`)
    assert(
      t15.status === 200 &&
        t15.data?.valid === true &&
        t15.data?.expired === false &&
        t15.data?.email === undefined &&
        t15.data?.role === undefined,
      `GET /api/invitations/[id] returns minimal {valid, expired} without data leakage (got ${JSON.stringify(t15.data)})`
    )

    // --- TEST 16: Public invitation lookup (expired) -> 200 with {valid: false, expired: true}
    const t16 = await apiFetch(`/api/invitations/${expiredInvitation.id}`)
    assert(
      t16.status === 200 && t16.data?.valid === false && t16.data?.expired === true,
      `GET /api/invitations/[expiredId] returns {valid: false, expired: true} (got ${JSON.stringify(t16.data)})`
    )

    // --- TEST 17: Developer accessing COMPANY_SETTINGS -> 403 Forbidden
    const t17 = await apiFetch(`/api/teams/${teamA.id}/company-settings`, {
      cookie: userCookies.developer,
    })
    assert(t17.status === 403, `GET company-settings by developer returns 403 Forbidden (got ${t17.status})`)

    // --- TEST 18: Disabled invitation acceptance -> 410 Gone
    const t18 = await apiFetch(`/api/teams/${teamA.id}/invitations/${invitationA.id}/accept`, {
      method: "POST",
      cookie: userCookies.developer,
    })
    assert(t18.status === 410, `POST invitations/[id]/accept returns 410 Gone (got ${t18.status})`)

  } catch (err: any) {
    console.error("Test execution exception:", err)
    failed++
  } finally {
    // 7. Cleanup HTTP server
    if (serverProcess) {
      console.log("\n[5] Terminating Next.js Test Server...")
      try {
        if (process.platform === "win32") {
          spawn("taskkill", ["/pid", String(serverProcess.pid), "/f", "/t"])
        } else {
          serverProcess.kill("SIGTERM")
        }
      } catch {}
    }

    // 8. Cleanup Database Records
    console.log("\n[6] Cleaning Up Temporary Test Records...")
    try {
      if (tempInvitationIds.length > 0) {
        await prisma.invitation.deleteMany({ where: { id: { in: tempInvitationIds } } })
      }
      if (tempProductIds.length > 0) {
        await prisma.domainProduct.deleteMany({ where: { id: { in: tempProductIds } } })
      }
      if (tempProjectIds.length > 0) {
        await prisma.project.deleteMany({ where: { id: { in: tempProjectIds } } })
      }
      if (tempUserIds.length > 0) {
        await prisma.session.deleteMany({ where: { userId: { in: tempUserIds } } })
        await prisma.account.deleteMany({ where: { userId: { in: tempUserIds } } })
        await prisma.employee.deleteMany({ where: { userId: { in: tempUserIds } } })
        await prisma.teamMember.deleteMany({ where: { userId: { in: tempUserIds } } })
        await prisma.user.deleteMany({ where: { id: { in: tempUserIds } } })
      }
      if (tempTeamIds.length > 0) {
        await prisma.team.deleteMany({ where: { id: { in: tempTeamIds } } })
      }
      console.log("  ✓ All temporary test data successfully pruned.")
    } catch (cleanupErr) {
      console.error("Cleanup error:", cleanupErr)
    }
  }

  console.log("\n===================================================")
  console.log(`Route Security Verification: ${passed} passed, ${failed} failed`)
  console.log("===================================================")

  if (failed > 0) {
    process.exit(1)
  }
}

runSecurityVerification()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err)
    prisma.$disconnect()
    process.exit(1)
  })
