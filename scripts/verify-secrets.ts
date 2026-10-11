import dotenv from 'dotenv'
import path from 'path'
import { spawn, spawnSync, ChildProcess } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import { PrismaClient, EmployeeStatus } from '../lib/prisma-client'
import { hashPassword } from 'better-auth/crypto'
import { encryptSecret, decryptSecret, isEncrypted } from '../lib/secrets'

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

// ==============================================================================
// TEST 1: Crypto Round-Trip, Tampering, Rotation, isEncrypted
// ==============================================================================
async function testCrypto() {
  console.log('\n=============================================================')
  console.log('TEST 1: Cryptographic Invariants (AES-256-GCM)')
  console.log('=============================================================')

  const testKey1 = crypto.randomBytes(32).toString('base64')
  const testKey2 = crypto.randomBytes(32).toString('base64')

  process.env.APP_ENCRYPTION_KEY = testKey1
  delete process.env.APP_ENCRYPTION_KEY_PREVIOUS

  // 1.1 Round trip
  const plain = 'gsk_TEST_SECRET_KEY_abc123_xyz789'
  const ciphertext = encryptSecret(plain)
  assert(ciphertext.startsWith('v1:'), 'Ciphertext starts with "v1:" format prefix')
  assert(isEncrypted(ciphertext), 'isEncrypted returns true for encrypted value')
  assert(!isEncrypted('gsk_PLAIN_KEY'), 'isEncrypted returns false for plaintext value')

  const decrypted = decryptSecret(ciphertext)
  assert(decrypted === plain, 'Round trip decryption yields exact plaintext')

  // 1.2 Tampered ciphertext throws
  const parts = ciphertext.split(':')
  // Tamper with the ciphertext payload
  const tamperedCipher = `${parts[0]}:${parts[1]}:${parts[2]}:tampered_${parts[3]}`
  let threwOnTamper = false
  try {
    decryptSecret(tamperedCipher)
  } catch {
    threwOnTamper = true
  }
  assert(threwOnTamper, 'Tampered ciphertext throws decryption error')

  // Tamper with tag
  const badTag = crypto.randomBytes(16).toString('base64url')
  const tamperedTag = `${parts[0]}:${parts[1]}:${badTag}:${parts[3]}`
  let threwOnBadTag = false
  try {
    decryptSecret(tamperedTag)
  } catch {
    threwOnBadTag = true
  }
  assert(threwOnBadTag, 'Tampered auth tag throws decryption error')

  // 1.3 Key rotation with APP_ENCRYPTION_KEY_PREVIOUS
  // Now rotate active key to testKey2, moving testKey1 to previous
  process.env.APP_ENCRYPTION_KEY = testKey2
  process.env.APP_ENCRYPTION_KEY_PREVIOUS = testKey1

  const decryptedWithPrevious = decryptSecret(ciphertext)
  assert(
    decryptedWithPrevious === plain,
    'Decryption with APP_ENCRYPTION_KEY_PREVIOUS succeeds after key rotation'
  )

  // Decryption with completely wrong key fails
  process.env.APP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64')
  process.env.APP_ENCRYPTION_KEY_PREVIOUS = crypto.randomBytes(32).toString('base64')
  let threwOnWrongKeys = false
  try {
    decryptSecret(ciphertext)
  } catch {
    threwOnWrongKeys = true
  }
  assert(threwOnWrongKeys, 'Decryption with mismatched keys throws error')

  // Restore testKey1 for subsequent tests
  process.env.APP_ENCRYPTION_KEY = testKey1
  delete process.env.APP_ENCRYPTION_KEY_PREVIOUS
}

// ==============================================================================
// TEST 2: Production Configuration Guard Subprocess Tests
// ==============================================================================
async function testProductionGuard() {
  console.log('\n=============================================================')
  console.log('TEST 2: Production Configuration Guard (Subprocess Matrix)')
  console.log('=============================================================')

  const validKey = crypto.randomBytes(32).toString('base64')
  const validSecret = crypto.randomBytes(32).toString('hex') // 64 chars

  const cases = [
    {
      name: 'Case 1: All valid parameters',
      expectPass: true,
      env: {
        NODE_ENV: 'production',
        BETTER_AUTH_SECRET: validSecret,
        BETTER_AUTH_URL: 'https://erpos.sketchitup.in',
        NEXT_PUBLIC_APP_URL: 'https://erpos.sketchitup.in',
        APP_ENCRYPTION_KEY: validKey,
        DEFAULT_PASSWORD: 'ValidPassword#2026!',
        ALLOW_HARD_DELETE: '0',
      },
    },
    {
      name: 'Case 2: DEFAULT_PASSWORD="Pass@123"',
      expectPass: false,
      expectedSnippet: 'Pass@123',
      env: {
        NODE_ENV: 'production',
        BETTER_AUTH_SECRET: validSecret,
        BETTER_AUTH_URL: 'https://erpos.sketchitup.in',
        NEXT_PUBLIC_APP_URL: 'https://erpos.sketchitup.in',
        APP_ENCRYPTION_KEY: validKey,
        DEFAULT_PASSWORD: 'Pass@123',
      },
    },
    {
      name: 'Case 3: DEFAULT_PASSWORD missing',
      expectPass: false,
      expectedSnippet: 'DEFAULT_PASSWORD is missing',
      env: {
        NODE_ENV: 'production',
        BETTER_AUTH_SECRET: validSecret,
        BETTER_AUTH_URL: 'https://erpos.sketchitup.in',
        NEXT_PUBLIC_APP_URL: 'https://erpos.sketchitup.in',
        APP_ENCRYPTION_KEY: validKey,
        DEFAULT_PASSWORD: '',
      },
    },
    {
      name: 'Case 4: APP_ENCRYPTION_KEY missing',
      expectPass: false,
      expectedSnippet: 'APP_ENCRYPTION_KEY is missing',
      env: {
        NODE_ENV: 'production',
        BETTER_AUTH_SECRET: validSecret,
        BETTER_AUTH_URL: 'https://erpos.sketchitup.in',
        NEXT_PUBLIC_APP_URL: 'https://erpos.sketchitup.in',
        APP_ENCRYPTION_KEY: '',
        DEFAULT_PASSWORD: 'ValidPassword#2026!',
      },
    },
    {
      name: 'Case 5: BETTER_AUTH_SECRET under 32 chars',
      expectPass: false,
      expectedSnippet: 'BETTER_AUTH_SECRET',
      env: {
        NODE_ENV: 'production',
        BETTER_AUTH_SECRET: 'short-secret-123',
        BETTER_AUTH_URL: 'https://erpos.sketchitup.in',
        NEXT_PUBLIC_APP_URL: 'https://erpos.sketchitup.in',
        APP_ENCRYPTION_KEY: validKey,
        DEFAULT_PASSWORD: 'ValidPassword#2026!',
      },
    },
  ]

  const isWindows = process.platform === 'win32'
  const tsxCmd = isWindows ? 'npx.cmd' : 'npx'

  for (const c of cases) {
    const result = spawnSync(
      tsxCmd,
      ['tsx', 'scripts/run-production-guard.ts'],
      {
        cwd: process.cwd(),
        shell: true,
        env: {
          ...process.env,
          ...c.env,
        } as NodeJS.ProcessEnv,
        encoding: 'utf8',
      }
    )

    const passedCheck = c.expectPass ? result.status === 0 : result.status !== 0
    let messageMatches = true
    if (!c.expectPass && c.expectedSnippet) {
      const errOut = (result.stderr || '') + (result.stdout || '')
      messageMatches = errOut.includes(c.expectedSnippet)
    }

    assert(
      passedCheck && messageMatches,
      `${c.name} -> ${c.expectPass ? 'PASSED (0)' : `REJECTED (${result.status})`}`
    )
  }
}

// ==============================================================================
// TEST 3: HTTP Server Leak Test Against Real Routes
// ==============================================================================
const TEST_PORT = 3588
const BASE_URL = `http://localhost:${TEST_PORT}`
const TEST_PASSWORD = 'TestPassword#2026!Sec'

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

async function testLeakCheck() {
  console.log('\n=============================================================')
  console.log('TEST 3: HTTP Route Leak Checks (Live Next.js Server)')
  console.log('=============================================================')

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is missing')
  const dbHost = new URL(databaseUrl).hostname
  console.log(`Database Host: ${dbHost}`)

  // Verify dev database
  const isDevOrLocal =
    dbHost === 'localhost' ||
    dbHost === '127.0.0.1' ||
    dbHost.includes('neon.tech') ||
    dbHost.includes('dev')
  if (!isDevOrLocal && process.env.ALLOW_PROD_SEED !== '1') {
    throw new Error(`Refusing to run tests against suspected production host: ${dbHost}`)
  }

  // Find a target team
  const targetTeam = await prisma.team.findFirst({
    select: { id: true, name: true, key: true, groqApiKey: true },
  })
  if (!targetTeam) {
    throw new Error('No team found in database for leak check')
  }

  const originalGroqApiKey = targetTeam.groqApiKey
  const fakeSecretValue = 'gsk_TESTLEAKCHECK123456'

  // Ensure APP_ENCRYPTION_KEY is configured
  const encryptionKey = process.env.APP_ENCRYPTION_KEY || crypto.randomBytes(32).toString('base64')
  process.env.APP_ENCRYPTION_KEY = encryptionKey
  const encryptedFakeSecret = encryptSecret(fakeSecretValue)

  const tempUserIds: string[] = []
  let serverProcess: ChildProcess | null = null

  try {
    // 3.1 Temporarily set the team's groqApiKey to encrypted fake secret
    console.log(`[LeakTest] Temporarily applying encrypted secret to team "${targetTeam.name}" (${targetTeam.id})...`)
    await prisma.team.update({
      where: { id: targetTeam.id },
      data: { groqApiKey: encryptedFakeSecret },
    })

    // Fetch Viewer and CTO roles
    const viewerRole = await prisma.role.findUniqueOrThrow({ where: { key: 'viewer' } })
    const ctoRole = await prisma.role.findUniqueOrThrow({ where: { key: 'cto' } })

    const hashedPassword = await hashPassword(TEST_PASSWORD)

    // Create 1 temporary Viewer employee
    const viewerUserId = crypto.randomUUID()
    const viewerEmail = `temp-leak-viewer-${Date.now()}@test.internal`
    await prisma.user.create({
      data: {
        id: viewerUserId,
        email: viewerEmail,
        name: 'Temp Leak Viewer',
        emailVerified: true,
      },
    })
    tempUserIds.push(viewerUserId)

    await prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        userId: viewerUserId,
        accountId: viewerUserId,
        providerId: 'credential',
        password: hashedPassword,
      },
    })

    await prisma.employee.create({
      data: {
        userId: viewerUserId,
        teamId: targetTeam.id,
        roleId: viewerRole.id,
        fullName: 'Temp Leak Viewer',
        email: viewerEmail,
        status: EmployeeStatus.ACTIVE,
        mustChangePassword: false,
      },
    })

    await prisma.teamMember.create({
      data: {
        teamId: targetTeam.id,
        userId: viewerUserId,
        role: viewerRole.legacyTeamRole,
        userName: 'Temp Leak Viewer',
        userEmail: viewerEmail,
      },
    })

    // Create 1 temporary CTO employee
    const ctoUserId = crypto.randomUUID()
    const ctoEmail = `temp-leak-cto-${Date.now()}@test.internal`
    await prisma.user.create({
      data: {
        id: ctoUserId,
        email: ctoEmail,
        name: 'Temp Leak CTO',
        emailVerified: true,
      },
    })
    tempUserIds.push(ctoUserId)

    await prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        userId: ctoUserId,
        accountId: ctoUserId,
        providerId: 'credential',
        password: hashedPassword,
      },
    })

    await prisma.employee.create({
      data: {
        userId: ctoUserId,
        teamId: targetTeam.id,
        roleId: ctoRole.id,
        fullName: 'Temp Leak CTO',
        email: ctoEmail,
        status: EmployeeStatus.ACTIVE,
        mustChangePassword: false,
      },
    })

    await prisma.teamMember.create({
      data: {
        teamId: targetTeam.id,
        userId: ctoUserId,
        role: ctoRole.legacyTeamRole,
        userName: 'Temp Leak CTO',
        userEmail: ctoEmail,
      },
    })

    // 3.2 Launch Next.js Production Server on TEST_PORT
    console.log(`[LeakTest] Launching Next.js Production Server on Port ${TEST_PORT}...`)
    const isWindows = process.platform === 'win32'
    const nextCmd = isWindows ? 'npx.cmd' : 'npx'

    serverProcess = spawn(nextCmd, ['next', 'start', '-p', String(TEST_PORT)], {
      cwd: process.cwd(),
      shell: true,
      env: {
        ...process.env,
        PORT: String(TEST_PORT),
        BETTER_AUTH_URL: BASE_URL,
        NEXT_PUBLIC_APP_URL: BASE_URL,
        NODE_ENV: 'production',
        APP_ENCRYPTION_KEY: encryptionKey,
        DEFAULT_PASSWORD: 'ValidPassword#2026!',
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || 'a-strong-32-character-secret-key-for-test!',
      },
      stdio: 'pipe',
    })

    const ready = await waitForServer(BASE_URL)
    if (!ready) {
      throw new Error(`Server failed to start on port ${TEST_PORT}`)
    }
    console.log(`  ✓ Server ready at ${BASE_URL}`)

    // 3.3 Sign in Viewer
    const viewerSignInRes = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: BASE_URL,
      },
      body: JSON.stringify({ email: viewerEmail, password: TEST_PASSWORD }),
    })
    assert(viewerSignInRes.ok, `Viewer sign-in successful (status ${viewerSignInRes.status})`)

    const viewerSetCookies = (viewerSignInRes.headers as any).getSetCookie
      ? (viewerSignInRes.headers as any).getSetCookie()
      : [viewerSignInRes.headers.get('set-cookie')].filter(Boolean)
    const viewerCookie = viewerSetCookies.map((c: string) => c.split(';')[0]).join('; ')

    // 3.4 Sign in CTO
    const ctoSignInRes = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: BASE_URL,
      },
      body: JSON.stringify({ email: ctoEmail, password: TEST_PASSWORD }),
    })
    assert(ctoSignInRes.ok, `CTO sign-in successful (status ${ctoSignInRes.status})`)

    const ctoSetCookies = (ctoSignInRes.headers as any).getSetCookie
      ? (ctoSignInRes.headers as any).getSetCookie()
      : [ctoSignInRes.headers.get('set-cookie')].filter(Boolean)
    const ctoCookie = ctoSetCookies.map((c: string) => c.split(';')[0]).join('; ')

    // 3.5 Test routes as Viewer
    const viewerHeaders = {
      Cookie: viewerCookie,
      Origin: BASE_URL,
    }

    // A. GET /api/teams
    const teamsRes = await fetch(`${BASE_URL}/api/teams`, { headers: viewerHeaders })
    const teamsText = await teamsRes.text()
    assert(teamsRes.status === 200, `GET /api/teams status: ${teamsRes.status}`)
    assert(
      !teamsText.includes('groqApiKey') &&
        !teamsText.includes('gsk_TESTLEAKCHECK') &&
        !teamsText.includes('v1:'),
      'GET /api/teams does not contain groqApiKey, gsk_TESTLEAKCHECK, or v1:'
    )

    // B. GET /api/teams/{teamId}/issues
    const issuesRes = await fetch(`${BASE_URL}/api/teams/${targetTeam.id}/issues`, {
      headers: viewerHeaders,
    })
    const issuesText = await issuesRes.text()
    assert(issuesRes.status === 200, `GET /api/teams/{teamId}/issues status: ${issuesRes.status}`)
    assert(
      !issuesText.includes('groqApiKey') &&
        !issuesText.includes('gsk_TESTLEAKCHECK') &&
        !issuesText.includes('v1:'),
      'GET /api/teams/{teamId}/issues does not contain groqApiKey, gsk_TESTLEAKCHECK, or v1:'
    )

    // C. GET /api/teams/{teamId}/projects
    const projectsRes = await fetch(`${BASE_URL}/api/teams/${targetTeam.id}/projects`, {
      headers: viewerHeaders,
    })
    const projectsText = await projectsRes.text()
    assert(projectsRes.status === 200, `GET /api/teams/{teamId}/projects status: ${projectsRes.status}`)
    assert(
      !projectsText.includes('groqApiKey') &&
        !projectsText.includes('gsk_TESTLEAKCHECK') &&
        !projectsText.includes('v1:'),
      'GET /api/teams/{teamId}/projects does not contain groqApiKey, gsk_TESTLEAKCHECK, or v1:'
    )

    // D. GET /api/teams/{teamId}/api-key as Viewer (expect 403 Forbidden)
    const viewerApiKeyRes = await fetch(`${BASE_URL}/api/teams/${targetTeam.id}/api-key`, {
      headers: viewerHeaders,
    })
    const viewerApiKeyText = await viewerApiKeyRes.text()
    assert(
      viewerApiKeyRes.status === 403,
      `GET /api/teams/{teamId}/api-key as Viewer returns 403 (got ${viewerApiKeyRes.status})`
    )
    assert(
      !viewerApiKeyText.includes('groqApiKey') &&
        !viewerApiKeyText.includes('gsk_TESTLEAKCHECK') &&
        !viewerApiKeyText.includes('v1:'),
      'GET /api/teams/{teamId}/api-key as Viewer does not leak secret in body'
    )

    // 3.6 Test GET /api/teams/{teamId}/api-key as CTO (expect 200 and { hasKey, last4 })
    const ctoHeaders = {
      Cookie: ctoCookie,
      Origin: BASE_URL,
    }

    const ctoApiKeyRes = await fetch(`${BASE_URL}/api/teams/${targetTeam.id}/api-key`, {
      headers: ctoHeaders,
    })
    const ctoApiKeyJson = await ctoApiKeyRes.json()
    assert(ctoApiKeyRes.status === 200, `GET /api/teams/{teamId}/api-key as CTO returns 200`)
    assert(
      ctoApiKeyJson.hasKey === true && ctoApiKeyJson.last4 === '3456',
      `CTO receives only { hasKey: true, last4: "3456" } (got: ${JSON.stringify(ctoApiKeyJson)})`
    )
    assert(
      !('groqApiKey' in ctoApiKeyJson) &&
        !('apiKey' in ctoApiKeyJson) &&
        JSON.stringify(ctoApiKeyJson).indexOf('gsk_TESTLEAKCHECK') === -1 &&
        JSON.stringify(ctoApiKeyJson).indexOf('v1:') === -1,
      'CTO response does not contain groqApiKey, apiKey masked string, or raw ciphertext'
    )
  } finally {
    // 3.7 Kill server process
    if (serverProcess) {
      try {
        if (process.platform === 'win32') {
          spawnSync('taskkill', ['/pid', String(serverProcess.pid), '/f', '/t'])
        } else {
          serverProcess.kill('SIGTERM')
        }
      } catch {}
    }

    // 3.8 Delete temporary users and records
    if (tempUserIds.length > 0) {
      await prisma.session.deleteMany({ where: { userId: { in: tempUserIds } } }).catch(() => {})
      await prisma.account.deleteMany({ where: { userId: { in: tempUserIds } } }).catch(() => {})
      await prisma.employee.deleteMany({ where: { userId: { in: tempUserIds } } }).catch(() => {})
      await prisma.teamMember.deleteMany({ where: { userId: { in: tempUserIds } } }).catch(() => {})
      await prisma.user.deleteMany({ where: { id: { in: tempUserIds } } }).catch(() => {})
    }

    // 3.9 RESTORE ORIGINAL TEAM ROW EXACTLY
    console.log(`[LeakTest] Restoring original team row...`)
    await prisma.team.update({
      where: { id: targetTeam.id },
      data: { groqApiKey: originalGroqApiKey },
    })

    const verifyRestored = await prisma.team.findUnique({
      where: { id: targetTeam.id },
      select: { groqApiKey: true },
    })

    const isByteForByteRestored = verifyRestored?.groqApiKey === originalGroqApiKey
    assert(
      isByteForByteRestored,
      `Team row byte-for-byte restored: "${originalGroqApiKey ?? 'null'}" === "${verifyRestored?.groqApiKey ?? 'null'}"`
    )
  }
}

// ==============================================================================
// MAIN RUNNER
// ==============================================================================
async function main() {
  const startTime = Date.now()
  console.log('Starting verify-secrets suite (Budget: <60 seconds total)...')

  await testCrypto()
  await testProductionGuard()
  await testLeakCheck()

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('\n=============================================================')
  console.log(`verify-secrets completed in ${elapsed}s: ${passed} passed, ${failed} failed`)
  console.log('=============================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

main()
  .catch((err) => {
    console.error('Test suite failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
