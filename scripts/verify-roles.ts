import dotenv from 'dotenv'
import path from 'path'

// Load .env.local then .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import { PrismaClient } from '../lib/prisma-client'
import {
  MODULES,
  ROLE_DEFINITIONS,
  ROLES_BY_KEY,
  AppModule,
  AccessLevel,
} from '../lib/role-definitions'
import {
  hasAccess,
  canManageLevel,
  toLegacyTeamRole,
  loadRoleAccess,
  clearRoleCache,
  LEVEL_RANK,
} from '../lib/permissions'
import { seedRoles, validateRoleDefinitions } from '../prisma/seed-roles'

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

async function runVerification() {
  console.log('===================================================')
  console.log('Running Role & Permissions Test Suite')
  console.log('===================================================')

  const prisma = new PrismaClient()

  try {
    // 1. Definition Validation & Completeness
    console.log('\n[1] Role Definitions & Matrix Completeness:')
    assert(ROLE_DEFINITIONS.length === 13, 'Contains exactly 13 roles')
    assert(MODULES.length === 12, 'Contains exactly 12 modules')

    let allModulesDefined = true
    for (const role of ROLE_DEFINITIONS) {
      for (const mod of MODULES) {
        if (!role.access[mod]) {
          allModulesDefined = false
        }
      }
    }
    assert(allModulesDefined, 'Every role defines all 12 modules')

    // 2. Owner Rules
    console.log('\n[2] Owner Rules & Constraints:')
    const owner = ROLES_BY_KEY['owner']
    assert(owner.level === 100, 'Owner level is 100')
    assert(owner.legacyTeamRole === 'admin', 'Owner legacyTeamRole is admin')

    let ownerManageAll = true
    for (const mod of MODULES) {
      if (mod === AppModule.AUDIT_LOGS) {
        if (owner.access[mod] !== AccessLevel.VIEW) ownerManageAll = false
      } else {
        if (owner.access[mod] !== AccessLevel.MANAGE) ownerManageAll = false
      }
    }
    assert(ownerManageAll, 'Owner has MANAGE on all modules except AUDIT_LOGS which is VIEW')

    // 3. Audit Log Cap
    console.log('\n[3] Audit Log Cap (Never above VIEW):')
    let auditLogCapped = true
    for (const role of ROLE_DEFINITIONS) {
      const access = role.access[AppModule.AUDIT_LOGS]
      if (access === AccessLevel.WRITE || access === AccessLevel.MANAGE) {
        auditLogCapped = false
      }
    }
    assert(auditLogCapped, 'No role has AUDIT_LOGS above VIEW')

    // 4. hasAccess Cases
    console.log('\n[4] hasAccess() Checks:')
    const hr = ROLES_BY_KEY['hr']
    const viewer = ROLES_BY_KEY['viewer']
    const developer = ROLES_BY_KEY['developer']

    assert(
      hasAccess(hr.access, AppModule.EMPLOYEES, AccessLevel.MANAGE) === true,
      'hr EMPLOYEES >= MANAGE is true'
    )
    assert(
      hasAccess(hr.access, AppModule.FINANCE, AccessLevel.VIEW) === false,
      'hr FINANCE >= VIEW is false'
    )
    assert(
      hasAccess(viewer.access, AppModule.WORK, AccessLevel.WRITE) === false,
      'viewer WORK >= WRITE is false'
    )
    assert(
      hasAccess(developer.access, AppModule.DEV_SETTINGS, AccessLevel.WRITE) === true,
      'developer DEV_SETTINGS >= WRITE is true'
    )
    assert(
      hasAccess(owner.access, AppModule.ROLES, AccessLevel.MANAGE) === true,
      'owner ROLES >= MANAGE is true'
    )
    assert(
      hasAccess(ROLES_BY_KEY['ceo'].access, AppModule.ROLES, AccessLevel.MANAGE) === false,
      'ceo ROLES >= MANAGE is false (ceo has VIEW)'
    )

    // 5. Hierarchy Helper: canManageLevel
    console.log('\n[5] canManageLevel() Hierarchy:')
    assert(canManageLevel(100, 90) === true, '100 > 90 is true')
    assert(canManageLevel(80, 70) === true, '80 > 70 is true')
    assert(canManageLevel(70, 70) === false, '70 > 70 is false')
    assert(canManageLevel(40, 60) === false, '40 > 60 is false')

    // 6. legacyTeamRole Mapping
    console.log('\n[6] toLegacyTeamRole() Mapping:')
    const expectedLegacyRoles: Record<string, string> = {
      owner: 'admin',
      ceo: 'admin',
      cto: 'admin',
      hr: 'admin',
      finance_manager: 'developer',
      admin: 'admin',
      project_manager: 'developer',
      sales_manager: 'developer',
      team_lead: 'developer',
      developer: 'developer',
      sales_executive: 'developer',
      accountant: 'developer',
      viewer: 'viewer',
    }

    let allLegacyMatched = true
    for (const [key, expected] of Object.entries(expectedLegacyRoles)) {
      const actual = toLegacyTeamRole(key)
      if (actual !== expected) {
        allLegacyMatched = false
        console.error(`  Mismatch for ${key}: expected ${expected}, got ${actual}`)
      }
    }
    assert(allLegacyMatched, 'All 13 roles map to the expected legacyTeamRole')

    // Object lookup test
    assert(
      toLegacyTeamRole({ legacyTeamRole: 'admin' }) === 'admin',
      'toLegacyTeamRole({ legacyTeamRole: "admin" }) returns "admin"'
    )

    // 7. Database Seeding & Idempotence Verification
    console.log('\n[7] Database Seeding & Idempotency:')
    console.log('Running seed run 1...')
    await seedRoles(prisma)
    const rolesCount1 = await prisma.role.count()
    const accessCount1 = await prisma.roleAccess.count()
    assert(rolesCount1 === 13, `Seed Run 1: Role count is exactly 13 (got ${rolesCount1})`)
    assert(accessCount1 === 156, `Seed Run 1: RoleAccess count is exactly 156 (got ${accessCount1})`)

    console.log('Running seed run 2...')
    await seedRoles(prisma)
    const rolesCount2 = await prisma.role.count()
    const accessCount2 = await prisma.roleAccess.count()
    assert(rolesCount2 === 13, `Seed Run 2 (Idempotency): Role count is still 13 (got ${rolesCount2})`)
    assert(accessCount2 === 156, `Seed Run 2 (Idempotency): RoleAccess count is still 156 (got ${accessCount2})`)

    // 8. DB Query & Cache verification
    console.log('\n[8] loadRoleAccess & Cache Verification:')
    clearRoleCache()
    const dbOwnerAccess = await loadRoleAccess('owner')
    assert(dbOwnerAccess[AppModule.WORK] === AccessLevel.MANAGE, 'loadRoleAccess loads owner WORK = MANAGE')
    assert(dbOwnerAccess[AppModule.AUDIT_LOGS] === AccessLevel.VIEW, 'loadRoleAccess loads owner AUDIT_LOGS = VIEW')

    const dbHrAccess = await loadRoleAccess('hr')
    assert(dbHrAccess[AppModule.EMPLOYEES] === AccessLevel.MANAGE, 'loadRoleAccess loads hr EMPLOYEES = MANAGE')

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

runVerification().catch((e) => {
  console.error('Test execution failed:', e)
  process.exit(1)
})
