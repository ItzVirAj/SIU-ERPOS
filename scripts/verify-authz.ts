import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import crypto from 'crypto'
import { z } from 'zod'
import { PrismaClient, EmployeeStatus, Prisma } from '../lib/prisma-client'
import { auth } from '../lib/auth'
import { hashPassword } from 'better-auth/crypto'
import {
  HttpError,
  assertCanManage,
  assertCanAssignRole,
  assertNotLastOwner,
  handleRouteError,
  ManageAction,
} from '../lib/authz'
import { sanitizeAuditData, maskIp } from '../lib/audit'
import { rateLimit, enforceRateLimit, clearRateLimitStore } from '../lib/rate-limit'
import { revokeAllSessions, revokeSession } from '../lib/session-admin'
import { ROLE_DEFINITIONS, ROLES_BY_KEY } from '../lib/role-definitions'

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

async function runAuthzVerification() {
  console.log('===================================================')
  console.log('Authorization, Audit & Session Verification Suite')
  console.log('===================================================')

  // Environment & Database host guard
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set')
  }
  const dbHost = new URL(databaseUrl).hostname
  console.log(`Database Host: ${dbHost}`)

  const isDevOrLocal =
    dbHost === 'localhost' ||
    dbHost === '127.0.0.1' ||
    dbHost.includes('neon.tech') ||
    dbHost.includes('supabase.co') ||
    dbHost.includes('dev')

  if (!isDevOrLocal && process.env.ALLOW_PROD_SEED !== '1') {
    throw new Error(`Execution blocked: host "${dbHost}" is not a recognized dev database`)
  }

  const prisma = new PrismaClient()

  try {
    // -------------------------------------------------------------
    // 1. assertCanManage Matrix Verification
    // -------------------------------------------------------------
    console.log('\n[1] Testing assertCanManage Matrix Rules:')

    const roles = {
      owner: { id: 'u-owner', role: { key: 'owner', level: 100 }, status: EmployeeStatus.ACTIVE },
      ceo: { id: 'u-ceo', role: { key: 'ceo', level: 90 }, status: EmployeeStatus.ACTIVE },
      cto: { id: 'u-cto', role: { key: 'cto', level: 80 }, status: EmployeeStatus.ACTIVE },
      hr: { id: 'u-hr', role: { key: 'hr', level: 70 }, status: EmployeeStatus.ACTIVE },
      finance_manager: { id: 'u-fin', role: { key: 'finance_manager', level: 70 }, status: EmployeeStatus.ACTIVE },
      developer: { id: 'u-dev', role: { key: 'developer', level: 40 }, status: EmployeeStatus.ACTIVE },
    }

    const testManage = (
      actor: { id: string; role: { key: string; level: number }; status?: EmployeeStatus },
      target: { id: string; role: { key: string; level: number }; status: EmployeeStatus },
      action: ManageAction,
      expectedAllowed: boolean
    ) => {
      let allowed = false
      try {
        assertCanManage(actor, target, action)
        allowed = true
      } catch (e) {
        allowed = false
      }
      return allowed === expectedAllowed
    }

    // A. owner -> ceo (allowed for update/delete)
    assert(testManage(roles.owner, roles.ceo, 'update', true), 'owner -> ceo: update ALLOWED')
    assert(testManage(roles.owner, roles.ceo, 'delete', true), 'owner -> ceo: delete ALLOWED')

    // B. ceo -> owner (denied)
    assert(testManage(roles.ceo, roles.owner, 'update', false), 'ceo -> owner: update DENIED')
    assert(testManage(roles.ceo, roles.owner, 'delete', false), 'ceo -> owner: delete DENIED')

    // C. cto -> hr (allowed)
    assert(testManage(roles.cto, roles.hr, 'update', true), 'cto -> hr: update ALLOWED')
    assert(testManage(roles.cto, roles.hr, 'delete', true), 'cto -> hr: delete ALLOWED')

    // D. hr -> cto (denied: level 70 cannot touch 80)
    assert(testManage(roles.hr, roles.cto, 'update', false), 'hr -> cto: update DENIED')
    assert(testManage(roles.hr, roles.cto, 'delete', false), 'hr -> cto: delete DENIED')

    // E. hr -> hr (denied: same level 70 cannot touch 70)
    const hrTarget = { id: 'u-hr-target', role: { key: 'hr', level: 70 }, status: EmployeeStatus.ACTIVE }
    assert(testManage(roles.hr, hrTarget, 'update', false), 'hr -> other hr: update DENIED')

    // F. hr -> finance_manager (denied: level 70 cannot touch 70)
    assert(testManage(roles.hr, roles.finance_manager, 'update', false), 'hr -> finance_manager: update DENIED')

    // G. hr -> developer (update, suspend, reset_password: ALLOWED)
    assert(testManage(roles.hr, roles.developer, 'update', true), 'hr -> developer: update ALLOWED')
    assert(testManage(roles.hr, roles.developer, 'suspend', true), 'hr -> developer: suspend ALLOWED')
    assert(testManage(roles.hr, roles.developer, 'reset_password', true), 'hr -> developer: reset_password ALLOWED')

    // H. hr -> developer delete:
    // HR has EMPLOYEES=MANAGE and level 70 > 40, so ALLOWED per matrix
    assert(testManage(roles.hr, roles.developer, 'delete', true), 'hr -> developer: delete ALLOWED (HR has EMPLOYEES=MANAGE)')

    // I. developer -> anyone denied for write/manage actions
    assert(testManage(roles.developer, roles.hr, 'update', false), 'developer -> hr: update DENIED')
    assert(testManage(roles.developer, roles.hr, 'delete', false), 'developer -> hr: delete DENIED')
    assert(testManage(roles.developer, roles.owner, 'suspend', false), 'developer -> owner: suspend DENIED')

    // J. Self-protection: actors managing themselves
    const selfActions: ManageAction[] = ['suspend', 'delete', 'hard_delete', 'change_role', 'revoke_sessions', 'reset_password']
    let allSelfDenied = true
    for (const act of selfActions) {
      if (testManage(roles.owner, roles.owner, act, false) === false) allSelfDenied = false
      if (testManage(roles.hr, roles.hr, act, false) === false) allSelfDenied = false
    }
    assert(allSelfDenied, 'Self-management for suspend/delete/role/sessions/password DENIED for all actors')

    // K. Terminated targets can ONLY be viewed
    const terminatedDev = { id: 'u-dev-term', role: { key: 'developer', level: 40 }, status: EmployeeStatus.TERMINATED }
    assert(testManage(roles.owner, terminatedDev, 'view', true), 'owner -> terminated target: view ALLOWED')
    assert(testManage(roles.owner, terminatedDev, 'update', false), 'owner -> terminated target: update DENIED')
    assert(testManage(roles.owner, terminatedDev, 'delete', false), 'owner -> terminated target: delete DENIED')

    // Print Actor x Target Matrix Table
    console.log('\n--- Tested Authorization Matrix Snapshot ---')
    const matrixRows = [
      { Actor: 'owner (100)', Target: 'ceo (90)', Update: 'ALLOWED', Delete: 'ALLOWED', Reason: '100 > 90, EMPLOYEES=MANAGE' },
      { Actor: 'ceo (90)', Target: 'owner (100)', Update: 'DENIED', Delete: 'DENIED', Reason: '90 <= 100 hierarchy violation' },
      { Actor: 'cto (80)', Target: 'hr (70)', Update: 'ALLOWED', Delete: 'ALLOWED', Reason: '80 > 70, EMPLOYEES=MANAGE' },
      { Actor: 'hr (70)', Target: 'cto (80)', Update: 'DENIED', Delete: 'DENIED', Reason: '70 <= 80 hierarchy violation' },
      { Actor: 'hr (70)', Target: 'hr (70)', Update: 'DENIED', Delete: 'DENIED', Reason: '70 <= 70 equal level rule' },
      { Actor: 'hr (70)', Target: 'fin_mgr (70)', Update: 'DENIED', Delete: 'DENIED', Reason: '70 <= 70 equal level rule' },
      { Actor: 'hr (70)', Target: 'dev (40)', Update: 'ALLOWED', Delete: 'ALLOWED', Reason: '70 > 40, EMPLOYEES=MANAGE' },
      { Actor: 'dev (40)', Target: 'anyone', Update: 'DENIED', Delete: 'DENIED', Reason: 'EMPLOYEES=VIEW only' },
      { Actor: 'any', Target: 'self', Suspend: 'DENIED', Delete: 'DENIED', Reason: 'Self-protection invariant' },
      { Actor: 'any', Target: 'terminated', Update: 'DENIED', View: 'ALLOWED', Reason: 'Terminated target invariant' },
    ]
    console.table(matrixRows)

    // -------------------------------------------------------------
    // 2. assertCanAssignRole Verification
    // -------------------------------------------------------------
    console.log('\n[2] Testing assertCanAssignRole Rules:')
    const testAssign = (
      actor: { id: string; role: { key: string; level: number } },
      newRole: { key: string; level: number },
      confirm?: boolean
    ) => {
      try {
        assertCanAssignRole(actor, newRole, { confirmSecondOwner: confirm })
        return true
      } catch {
        return false
      }
    }

    assert(testAssign(roles.hr, { key: 'cto', level: 80 }) === false, 'HR cannot assign CTO role (70 <= 80)')
    assert(testAssign(roles.cto, { key: 'hr', level: 70 }) === true, 'CTO can assign HR role (80 > 70)')
    assert(testAssign(roles.owner, { key: 'owner', level: 100 }, false) === false, 'Owner assigning Owner WITHOUT confirmSecondOwner is REJECTED')
    assert(testAssign(roles.owner, { key: 'owner', level: 100 }, true) === true, 'Owner assigning Owner WITH confirmSecondOwner is ALLOWED')

    // -------------------------------------------------------------
    // 3. assertNotLastOwner with Real DB Transaction (Rolled Back)
    // -------------------------------------------------------------
    console.log('\n[3] Testing assertNotLastOwner (Single Owner Safety):')
    const primaryTeam = await prisma.team.findFirst({ select: { id: true, name: true } })
    if (primaryTeam) {
      try {
        await prisma.$transaction(async (tx) => {
          const ownerEmp = await tx.employee.findFirst({
            where: {
              teamId: primaryTeam.id,
              role: { key: 'owner' },
              status: EmployeeStatus.ACTIVE,
            },
            include: { role: true },
          })

          if (ownerEmp) {
            let threw = false
            try {
              await assertNotLastOwner(tx, ownerEmp)
            } catch (err: any) {
              threw = true
              assert(err instanceof HttpError && err.status === 409, 'assertNotLastOwner throws HttpError(409) when 1 owner exists')
            }
            assert(threw, 'Single owner in team is strictly guarded against removal')
          }
          // Intentionally throw to rollback transaction
          throw new Error('ROLLBACK_INTENTIONAL')
        })
      } catch (err: any) {
        if (err.message !== 'ROLLBACK_INTENTIONAL') throw err
      }
    }

    // -------------------------------------------------------------
    // 4. Suspended Login Block Verification
    // -------------------------------------------------------------
    console.log('\n[4] Testing Suspended Employee Login Block via Better Auth:')
    const tempUserId = `test-temp-${Date.now()}`
    const tempEmail = `temp.user.${Date.now()}@sketchitup.in`
    const tempPass = 'TestPass@123'
    const hashedPass = await hashPassword(tempPass)

    const devRole = await prisma.role.findUnique({ where: { key: 'developer' } })
    if (!devRole || !primaryTeam) {
      throw new Error('Precondition failed: missing dev role or team')
    }

    // Create temp user, credential account, and SUSPENDED employee
    await prisma.user.create({
      data: {
        id: tempUserId,
        email: tempEmail,
        name: 'Temp Suspended User',
        emailVerified: true,
      },
    })

    await prisma.account.create({
      data: {
        id: `acc-${tempUserId}`,
        accountId: tempUserId,
        userId: tempUserId,
        providerId: 'credential',
        password: hashedPass,
      },
    })

    const tempEmp = await prisma.employee.create({
      data: {
        userId: tempUserId,
        email: tempEmail,
        fullName: 'Temp Suspended User',
        roleId: devRole.id,
        teamId: primaryTeam.id,
        status: EmployeeStatus.SUSPENDED,
      },
    })

    // Attempt sign-in with SUSPENDED status (must fail)
    let suspendedBlocked = false
    try {
      await auth.api.signInEmail({
        body: { email: tempEmail, password: tempPass },
      })
    } catch (e: any) {
      suspendedBlocked = true
      console.log(`  ✓ Blocked login message: ${e?.message || e}`)
    }
    assert(suspendedBlocked, 'Sign in with status SUSPENDED was strictly blocked')

    // Change status to ACTIVE and re-test (must succeed)
    await prisma.employee.update({
      where: { id: tempEmp.id },
      data: { status: EmployeeStatus.ACTIVE },
    })

    let activeSignInSuccess = false
    try {
      const res = await auth.api.signInEmail({
        body: { email: tempEmail, password: tempPass },
      })
      activeSignInSuccess = !!res?.user
    } catch (e) {
      activeSignInSuccess = false
    }
    assert(activeSignInSuccess, 'Sign in with status ACTIVE succeeded')

    // Clean up temporary data
    await prisma.session.deleteMany({ where: { userId: tempUserId } })
    await prisma.employee.delete({ where: { id: tempEmp.id } })
    await prisma.account.deleteMany({ where: { userId: tempUserId } })
    await prisma.user.delete({ where: { id: tempUserId } })
    console.log('  ✓ Cleaned up temporary test user, account, employee, and sessions')

    // Verify existing users (owner & demo) remain intact
    const ownerCheck = await prisma.user.findUnique({ where: { email: 'owner@sketchitup.in' } })
    const demoCheck = await prisma.user.findUnique({ where: { email: 'demo@siu.in' } })
    assert(!!ownerCheck && !!demoCheck, 'Owner and Demo accounts remain intact')

    // -------------------------------------------------------------
    // 5. handleRouteError Mapping Verification
    // -------------------------------------------------------------
    console.log('\n[5] Testing handleRouteError Mappings:')
    const http403 = new HttpError(403, 'Forbidden', 'FORBIDDEN')
    const res403 = handleRouteError(http403)
    assert(res403.status === 403, 'HttpError maps to status 403')

    const schema = z.object({ name: z.string().min(3) })
    let zodError: any
    try {
      schema.parse({ name: 'a' })
    } catch (e) {
      zodError = e
    }
    const resZod = handleRouteError(zodError)
    assert(resZod.status === 400, 'ZodError maps to status 400')

    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '6.18.0',
    })
    const resP2002 = handleRouteError(p2002)
    assert(resP2002.status === 409, 'Prisma P2002 error maps to status 409')

    const res500 = handleRouteError(new Error('Unknown catastrophic failure'))
    assert(res500.status === 500, 'Unknown error maps to generic status 500')

    // -------------------------------------------------------------
    // 6. Audit Sanitizer & IP Masking Verification
    // -------------------------------------------------------------
    console.log('\n[6] Testing Audit Data Sanitizer & IP Masking:')
    const dirtyData = {
      user: 'alice',
      password: 'SuperSecretPassword!123',
      nested: {
        token: 'eyJhGciOiJIUzI1NiJ9...',
        hash: '$2a$12$abcdef...',
        secret_key: 'my_secret',
        safeProperty: 'hello world',
      },
      longText: 'A'.repeat(600),
    }

    const cleanData = sanitizeAuditData(dirtyData)
    assert(!('password' in cleanData), 'Sensitive key "password" removed')
    assert(!('token' in cleanData.nested), 'Sensitive nested key "token" removed')
    assert(!('hash' in cleanData.nested), 'Sensitive nested key "hash" removed')
    assert(!('secret_key' in cleanData.nested), 'Sensitive nested key "secret_key" removed')
    assert(cleanData.nested.safeProperty === 'hello world', 'Safe property retained')
    assert(cleanData.longText.endsWith('...[TRUNCATED]'), 'Long text (> 500 chars) truncated')

    const ipv4Masked = maskIp('192.168.1.150')
    const ipv6Masked = maskIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334')
    assert(ipv4Masked === '192.168.1.xxx', 'IPv4 properly masked to first 3 octets')
    assert(ipv6Masked === '2001:0db8:85a3::xxxx', 'IPv6 properly masked to /48 prefix')

    // -------------------------------------------------------------
    // 7. Rate Limiter Verification
    // -------------------------------------------------------------
    console.log('\n[7] Testing In-Memory Sliding Window Rate Limiter:')
    clearRateLimitStore()
    const r1 = rateLimit('test-key', { limit: 2, windowMs: 10_000 })
    const r2 = rateLimit('test-key', { limit: 2, windowMs: 10_000 })
    const r3 = rateLimit('test-key', { limit: 2, windowMs: 10_000 })
    assert(r1.ok === true && r2.ok === true, 'First 2 requests within limit pass')
    assert(r3.ok === false && typeof r3.retryAfter === 'number', '3rd request exceeds limit and returns retryAfter')

    let rateLimitedThrew = false
    try {
      enforceRateLimit('actor-1', 'reset_password')
      for (let i = 0; i < 15; i++) {
        enforceRateLimit('actor-1', 'reset_password')
      }
    } catch (e: any) {
      if (e instanceof HttpError && e.status === 429) rateLimitedThrew = true
    }
    assert(rateLimitedThrew, 'enforceRateLimit throws HttpError(429) when threshold exceeded')

    // -------------------------------------------------------------
    // 8. Session Admin Helpers Verification
    // -------------------------------------------------------------
    console.log('\n[8] Testing Session Admin Helpers (revokeSession & revokeAllSessions):')
    // Safe transactional test that rolls back
    try {
      await prisma.$transaction(async (tx) => {
        const dummyUserId = `dummy-${Date.now()}`
        await tx.user.create({
          data: { id: dummyUserId, email: `dummy.${Date.now()}@test.in`, name: 'Dummy' },
        })
        const s1 = await tx.session.create({
          data: { id: `s1-${dummyUserId}`, token: `tok1-${dummyUserId}`, userId: dummyUserId, expiresAt: new Date(Date.now() + 60_000) },
        })
        const s2 = await tx.session.create({
          data: { id: `s2-${dummyUserId}`, token: `tok2-${dummyUserId}`, userId: dummyUserId, expiresAt: new Date(Date.now() + 60_000) },
        })

        const revokedOne = await revokeSession(tx, dummyUserId, s1.id)
        assert(revokedOne === true, 'revokeSession successfully revokes single target session')

        const revokedAllCount = await revokeAllSessions(tx, dummyUserId)
        assert(revokedAllCount === 1, 'revokeAllSessions successfully deleted remaining 1 session')

        throw new Error('SESSION_TEST_ROLLBACK')
      })
    } catch (e: any) {
      if (e.message !== 'SESSION_TEST_ROLLBACK') throw e
    }

    console.log('\n===================================================')
    console.log(`Results: ${passed} Passed, ${failed} Failed`)
    console.log('===================================================')

    if (failed > 0) {
      process.exit(1)
    }
  } finally {
    await prisma.$disconnect()
  }
}

runAuthzVerification().catch((e) => {
  console.error('Fatal verification error:', e)
  process.exit(1)
})
