import dotenv from 'dotenv'
import path from 'path'
import { spawn, spawnSync, ChildProcess } from 'child_process'
import crypto from 'crypto'
import { NextRequest } from 'next/server'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import { PrismaClient, EmployeeStatus } from '../lib/prisma-client'
import { hashPassword } from 'better-auth/crypto'
import { computeClientIpFromForwarded, getClientIp } from '../lib/client-ip'
import { isSessionTooOld } from '../lib/authz'
import { auth } from '../lib/auth'
import { checkLock, recordFailure, unlock, hashEmailKey } from '../lib/login-throttle'
import { unlockEmployee, updateEmployee } from '../lib/employee-service'
import { middleware } from '../middleware'
import { loadRoleAccess } from '../lib/permissions'

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

const TEST_PORT = 3456
const BASE_URL = `http://localhost:${TEST_PORT}`
const TEST_PASSWORD = 'ValidPassword#2026!'

async function waitForServer(url: string, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${url}/api/auth/ok`, { method: 'GET' }).catch(() => null)
      if (res && res.status < 500) return true
      const resRoot = await fetch(url).catch(() => null)
      if (resRoot && resRoot.status < 500) return true
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  return false
}

async function runVerification() {
  console.log('=============================================================')
  console.log('STEP 6: Login Hardening & Account Lockout Verification')
  console.log('=============================================================')

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is missing')
  const dbHost = new URL(databaseUrl).hostname
  console.log(`Database Host: ${dbHost}`)

  const tempUserIds: string[] = []
  const tempEmails: string[] = []
  let serverProcess: ChildProcess | null = null

  try {
    // -------------------------------------------------------------------------
    // 1. Client IP unit table & spoof resistance
    // -------------------------------------------------------------------------
    console.log('\n[1] Client IP Extraction Unit Table')
    assert(
      computeClientIpFromForwarded('1.2.3.4', 1) === '1.2.3.4',
      'Single IP "1.2.3.4" with hops=1 -> 1.2.3.4'
    )
    assert(
      computeClientIpFromForwarded('9.9.9.9, 1.2.3.4', 1) === '1.2.3.4',
      'Spoofed left "9.9.9.9, 1.2.3.4" with hops=1 -> 1.2.3.4 (spoofed left value ignored)'
    )
    assert(
      computeClientIpFromForwarded('9.9.9.9, 1.2.3.4', 2) === '9.9.9.9',
      'Multiple hops "9.9.9.9, 1.2.3.4" with hops=2 -> 9.9.9.9'
    )
    assert(
      computeClientIpFromForwarded('2001:db8::1', 1) === '2001:db8::1',
      'IPv6 "2001:db8::1" with hops=1 -> 2001:db8::1'
    )
    assert(
      computeClientIpFromForwarded('2001:db8::1, 1.2.3.4', 2) === '2001:db8::1',
      'IPv6 "2001:db8::1, 1.2.3.4" with hops=2 -> 2001:db8::1'
    )
    assert(
      computeClientIpFromForwarded('garbage_value', 1) === 'unknown',
      'Garbage "garbage_value" -> "unknown"'
    )
    assert(
      computeClientIpFromForwarded('', 1) === 'unknown',
      'Empty string -> "unknown"'
    )
    assert(
      computeClientIpFromForwarded(null, 1) === 'unknown',
      'Null -> "unknown"'
    )

    // Middleware unit-style call: strips incoming spoofed x-siu-client-ip
    const reqWithSpoof = new NextRequest('http://localhost:3000/api/auth/sign-in/email', {
      method: 'POST',
      headers: {
        'x-forwarded-for': '5.5.5.5, 203.0.113.195',
        'x-siu-client-ip': '1.1.1.1', // Spoofed client header
      },
    })
    const mwRes = await middleware(reqWithSpoof)
    const stampedIp = mwRes.headers.get('x-middleware-request-x-siu-client-ip') || mwRes.headers.get('x-siu-client-ip')
    assert(
      stampedIp === '203.0.113.195',
      `Middleware overwrites spoofed header: stamped "${stampedIp}" instead of spoofed "1.1.1.1"`
    )

    // -------------------------------------------------------------------------
    // 4. Session lifetime static assertions & isSessionTooOld unit cases
    // -------------------------------------------------------------------------
    console.log('\n[2] Session Lifetime & Expiration Assertions')
    const authOpts = (auth as any).options
    assert(authOpts.session.expiresIn === 12 * 60 * 60, 'session.expiresIn is exactly 12 hours (43200s)')
    assert(authOpts.session.updateAge === 60 * 60, 'session.updateAge is exactly 1 hour (3600s)')
    assert(authOpts.session.cookieCache.maxAge === 5 * 60, 'cookieCache.maxAge is exactly 5 minutes (300s)')
    assert(
      authOpts.advanced.ipAddress.ipAddressHeaders[0] === 'x-siu-client-ip',
      'advanced.ipAddress.ipAddressHeaders reads ["x-siu-client-ip"]'
    )

    const now = new Date('2026-10-12T12:00:00Z')
    const sixDaysOld = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
    const sevenDaysOld = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const eightDaysOld = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000)

    assert(!isSessionTooOld(sixDaysOld, now, 7), '6-day session is NOT too old (maxDays=7)')
    assert(!isSessionTooOld(sevenDaysOld, now, 7), 'Exactly 7-day session is NOT too old (boundary)')
    assert(isSessionTooOld(eightDaysOld, now, 7), '8-day session IS too old (maxDays=7)')
    assert(!isSessionTooOld('invalid-date', now, 7), 'Invalid date returns false safely')

    // -------------------------------------------------------------------------
    // 3. Concurrency test: 8 parallel wrong attempts for fresh email
    // -------------------------------------------------------------------------
    console.log('\n[3] Concurrency Lockout Test (Atomic Postgres FOR UPDATE)')
    const concurrentEmail = `concurrent-test-${Date.now()}@internal.test`
    tempEmails.push(concurrentEmail)

    const attempts = Array.from({ length: 8 }).map(() => recordFailure(concurrentEmail))
    await Promise.all(attempts)

    const concurrentStatus = await checkLock(concurrentEmail)
    assert(concurrentStatus.locked === true, '8 parallel wrong attempts successfully locked the account')
    assert((concurrentStatus.retryAfterSeconds ?? 0) > 0, 'Retry-After duration is positive')

    // -------------------------------------------------------------------------
    // Spawn live production server for HTTP verification
    // -------------------------------------------------------------------------
    console.log(`\n[4] Starting Live Next.js Production Server on port ${TEST_PORT}...`)
    const isWindows = process.platform === 'win32'
    const nextCmd = isWindows ? 'npx.cmd' : 'npx'

    const appEncryptionKey = process.env.APP_ENCRYPTION_KEY || crypto.randomBytes(32).toString('base64')

    serverProcess = spawn(nextCmd, ['next', 'start', '-p', String(TEST_PORT)], {
      cwd: process.cwd(),
      shell: true,
      env: {
        ...process.env,
        PORT: String(TEST_PORT),
        BETTER_AUTH_URL: BASE_URL,
        NEXT_PUBLIC_APP_URL: BASE_URL,
        NODE_ENV: 'production',
        DEFAULT_PASSWORD: TEST_PASSWORD,
        TRUSTED_PROXY_HOPS: '1',
        APP_ENCRYPTION_KEY: appEncryptionKey,
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || 'a-strong-32-character-secret-key-for-test!',
      },
      stdio: 'pipe',
    })

    serverProcess.stderr?.on('data', (d) => {
      console.error(`  [Server STDERR]: ${d.toString().trim()}`)
    })
    serverProcess.stdout?.on('data', (d) => {
      console.log(`  [Server STDOUT]: ${d.toString().trim()}`)
    })

    const ready = await waitForServer(BASE_URL, 45)
    if (!ready) {
      throw new Error(`Production server failed to start on port ${TEST_PORT}`)
    }
    console.log(`  ✓ Production server listening at ${BASE_URL}`)

    // -------------------------------------------------------------------------
    // Create Temporary Teams & Users (HR user and Developer user)
    // -------------------------------------------------------------------------
    console.log('\n[5] Setting up temporary test accounts')
    const targetTeam = await prisma.team.findFirst()
    if (!targetTeam) throw new Error('No team found in dev database')

    const hrRole = await prisma.role.findUnique({ where: { key: 'hr' } })
    const devRole = await prisma.role.findUnique({ where: { key: 'developer' } })
    if (!hrRole || !devRole) throw new Error('Roles hr and developer must exist')

    const hashedPassword = await hashPassword(TEST_PASSWORD)

    // 1. Temporary HR employee
    const hrUserId = crypto.randomUUID()
    const hrEmail = `temp-hr-${Date.now()}@test.internal`
    tempUserIds.push(hrUserId)
    tempEmails.push(hrEmail)

    await prisma.user.create({
      data: {
        id: hrUserId,
        email: hrEmail,
        name: 'Temp Test HR',
        emailVerified: true,
      },
    })
    await prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        userId: hrUserId,
        accountId: hrUserId,
        providerId: 'credential',
        password: hashedPassword,
      },
    })
    const hrEmp = await prisma.employee.create({
      data: {
        userId: hrUserId,
        teamId: targetTeam.id,
        roleId: hrRole.id,
        fullName: 'Temp Test HR',
        email: hrEmail,
        employeeCode: `HR-${Date.now().toString().slice(-4)}`,
        status: EmployeeStatus.ACTIVE,
      },
    })
    await prisma.teamMember.create({
      data: {
        teamId: targetTeam.id,
        userId: hrUserId,
        role: hrRole.legacyTeamRole,
        userName: 'Temp Test HR',
        userEmail: hrEmail,
      },
    })

    // 2. Temporary Developer employee
    const devUserId = crypto.randomUUID()
    const devEmail = `temp-dev-${Date.now()}@test.internal`
    tempUserIds.push(devUserId)
    tempEmails.push(devEmail)

    await prisma.user.create({
      data: {
        id: devUserId,
        email: devEmail,
        name: 'Temp Test Developer',
        emailVerified: true,
      },
    })
    await prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        userId: devUserId,
        accountId: devUserId,
        providerId: 'credential',
        password: hashedPassword,
      },
    })
    const devEmp = await prisma.employee.create({
      data: {
        userId: devUserId,
        teamId: targetTeam.id,
        roleId: devRole.id,
        fullName: 'Temp Test Developer',
        email: devEmail,
        employeeCode: `DEV-${Date.now().toString().slice(-4)}`,
        status: EmployeeStatus.ACTIVE,
      },
    })
    await prisma.teamMember.create({
      data: {
        teamId: targetTeam.id,
        userId: devUserId,
        role: devRole.legacyTeamRole,
        userName: 'Temp Test Developer',
        userEmail: devEmail,
      },
    })

    // -------------------------------------------------------------------------
    // HTTP Lockout with Rotating Spoofed XFF
    // -------------------------------------------------------------------------
    console.log('\n[6] HTTP Lockout with rotating spoofed X-Forwarded-For')
    const ipSeed = (Date.now() % 200) + 10
    const realClientIp = `198.51.100.${ipSeed}`
    const nonExistentClientIp = `198.51.100.${ipSeed + 1}`
    const unlockClientIp = `198.51.100.${ipSeed + 2}`

    // Fire 5 wrong password requests with rotating left XFF
    for (let i = 1; i <= 5; i++) {
      const spoofedLeft = `10.0.0.${i}`
      const xffHeader = `${spoofedLeft}, ${realClientIp}`

      const res = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: BASE_URL,
          'X-Forwarded-For': xffHeader,
        },
        body: JSON.stringify({
          email: devEmail,
          password: 'WrongPassword999!',
        }),
      })

      assert(
        res.status === 401 || (i === 5 && res.status === 401),
        `Attempt ${i}: wrong password rejected (status ${res.status}) with XFF: ${xffHeader}`
      )
    }

    // 6th attempt with CORRECT password must be rejected (429 Too Many Requests / locked)
    const sixthRes = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: BASE_URL,
        'X-Forwarded-For': `10.0.0.99, ${realClientIp}`,
      },
      body: JSON.stringify({
        email: devEmail,
        password: TEST_PASSWORD, // Correct password!
      }),
    })

    const retryAfterHeader =
      sixthRes.headers.get('retry-after') ||
      sixthRes.headers.get('Retry-After') ||
      sixthRes.headers.get('x-retry-after') ||
      sixthRes.headers.get('X-Retry-After')
    const sixthBody = await sixthRes.json().catch(() => null)

    assert(sixthRes.status === 429, `6th attempt with correct password rejected with 429 (got ${sixthRes.status})`)
    assert(Boolean(retryAfterHeader), `Retry-After header present: ${retryAfterHeader}`)
    assert(
      Boolean(
        sixthBody?.message &&
          (sixthBody.message.includes('Too many attempts') ||
            sixthBody.message.includes('Too many requests'))
      ),
      `Locked message matches: "${sixthBody?.message}"`
    )

    // Non-existent email lockout response comparison
    const nonExistentEmail = `nonexistent-${Date.now()}@test.internal`
    for (let i = 1; i <= 5; i++) {
      await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: BASE_URL,
          'X-Forwarded-For': `172.16.0.${i}, ${nonExistentClientIp}`,
        },
        body: JSON.stringify({
          email: nonExistentEmail,
          password: 'WrongPassword999!',
        }),
      })
    }

    const nonExistentLockedRes = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: BASE_URL,
        'X-Forwarded-For': `172.16.0.99, ${nonExistentClientIp}`,
      },
      body: JSON.stringify({
        email: nonExistentEmail,
        password: 'AnyPassword!',
      }),
    })
    const nonExistentBody = await nonExistentLockedRes.json().catch(() => null)

    console.log('\n--- Side-by-Side Lockout Responses ---')
    console.log('Existing Account Lockout (429):    ', JSON.stringify(sixthBody))
    console.log('Non-Existent Account Lockout (429):', JSON.stringify(nonExistentBody))
    assert(
      nonExistentLockedRes.status === 429 && nonExistentBody?.message === sixthBody?.message,
      'Non-existent account returns exact same 429 status and message shape (zero enumeration)'
    )

    // -------------------------------------------------------------------------
    // Admin Unlock & Hierarchy Checks
    // -------------------------------------------------------------------------
    console.log('\n[7] Admin Unlock Service & Access Hierarchy')

    const hrAccess = await loadRoleAccess(hrRole.key)
    const devAccess = await loadRoleAccess(devRole.key)

    const devActor = {
      session: { user: { id: devUserId, email: devEmail, name: 'Temp Dev' } },
      employee: {
        id: devEmp.id,
        teamId: targetTeam.id,
        userId: devUserId,
        email: devEmail,
        status: EmployeeStatus.ACTIVE,
      },
      role: { key: devRole.key, level: devRole.level },
      access: devAccess,
    }

    const hrActor = {
      session: { user: { id: hrUserId, email: hrEmail, name: 'Temp HR' } },
      employee: {
        id: hrEmp.id,
        teamId: targetTeam.id,
        userId: hrUserId,
        email: hrEmail,
        status: EmployeeStatus.ACTIVE,
      },
      role: { key: hrRole.key, level: hrRole.level },
      access: hrAccess,
    }

    // Lower-level dev cannot unlock higher/peer user
    let devUnlockDenied = false
    try {
      await unlockEmployee(devActor, hrEmp.id)
    } catch {
      devUnlockDenied = true
    }
    assert(devUnlockDenied, 'Lower-level developer cannot unlock another account (assertCanManage enforces hierarchy)')

    // HR user unlocks the developer account
    const unlockResult = await unlockEmployee(hrActor, devEmp.id)
    assert(unlockResult.success === true, 'HR actor unlocks developer account via service')

    // Correct password now succeeds
    const unlockSignInRes = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: BASE_URL,
        'X-Forwarded-For': `10.0.0.100, ${unlockClientIp}`,
      },
      body: JSON.stringify({
        email: devEmail,
        password: TEST_PASSWORD,
      }),
    })
    assert(unlockSignInRes.ok, `Sign-in with correct password succeeds immediately after unlock (status ${unlockSignInRes.status})`)

    // Verify successful login reset throttle counter
    const statusAfterSuccess = await checkLock(devEmail)
    assert(statusAfterSuccess.locked === false, 'Successful sign-in reset lockout and throttle state')

    // -------------------------------------------------------------------------
    // Password Recovery Endpoints Disabled
    // -------------------------------------------------------------------------
    console.log('\n[8] Password Recovery Disabled Verification')
    const resetReq1 = await fetch(`${BASE_URL}/api/auth/request-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
      body: JSON.stringify({ email: devEmail }),
    })
    assert(resetReq1.status >= 400, `/api/auth/request-password-reset returns client error (status ${resetReq1.status})`)

    const resetReq2 = await fetch(`${BASE_URL}/api/auth/forget-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
      body: JSON.stringify({ email: devEmail }),
    })
    assert(resetReq2.status >= 400, `/api/auth/forget-password returns client error (status ${resetReq2.status})`)

    // -------------------------------------------------------------------------
    // Email Change keeps verification & sign-in works with new email only
    // -------------------------------------------------------------------------
    console.log('\n[9] Employee Email Change & Verification Retention')
    const newDevEmail = `new-email-${Date.now()}@test.internal`
    tempEmails.push(newDevEmail)

    await updateEmployee(hrActor, devEmp.id, { email: newDevEmail })

    const updatedUser = await prisma.user.findUnique({ where: { id: devUserId } })
    assert(updatedUser?.email === newDevEmail, 'User email updated to new address')
    assert(updatedUser?.emailVerified === true, 'emailVerified remains true after admin email update')

    // Old email cannot sign in
    const oldEmailSignIn = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
      body: JSON.stringify({ email: devEmail, password: TEST_PASSWORD }),
    })
    assert(!oldEmailSignIn.ok, `Old email cannot sign in (status ${oldEmailSignIn.status})`)

    // New email can sign in
    const newEmailSignIn = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
      body: JSON.stringify({ email: newDevEmail, password: TEST_PASSWORD }),
    })
    assert(newEmailSignIn.ok, `New email signs in successfully (status ${newEmailSignIn.status})`)
  } finally {
    // -------------------------------------------------------------------------
    // Cleanup: Kill server, delete temp users, sessions, throttle rows
    // -------------------------------------------------------------------------
    console.log('\n[10] Cleanup Temporary Test Artifacts')
    if (serverProcess) {
      try {
        if (process.platform === 'win32') {
          spawnSync('taskkill', ['/pid', String(serverProcess.pid), '/f', '/t'])
        } else {
          serverProcess.kill('SIGTERM')
        }
      } catch {}
    }

    if (tempUserIds.length > 0) {
      await prisma.session.deleteMany({ where: { userId: { in: tempUserIds } } }).catch(() => {})
      await prisma.account.deleteMany({ where: { userId: { in: tempUserIds } } }).catch(() => {})
      await prisma.employee.deleteMany({ where: { userId: { in: tempUserIds } } }).catch(() => {})
      await prisma.teamMember.deleteMany({ where: { userId: { in: tempUserIds } } }).catch(() => {})
      await prisma.user.deleteMany({ where: { id: { in: tempUserIds } } }).catch(() => {})
    }

    for (const email of tempEmails) {
      const key = hashEmailKey(email)
      await prisma.loginThrottle.deleteMany({ where: { key } }).catch(() => {})
    }

    await prisma.rateLimit.deleteMany({
      where: { key: { contains: '198.51.100.' } },
    }).catch(() => {})

    await prisma.$disconnect()
  }

  console.log('\n=============================================================')
  console.log(`Results: ${passed} passed, ${failed} failed`)
  console.log('=============================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

runVerification().catch((err) => {
  console.error('FATAL TEST ERROR:', err)
  process.exit(1)
})
