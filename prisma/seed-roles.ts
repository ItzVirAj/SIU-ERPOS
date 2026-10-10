import dotenv from 'dotenv'
import path from 'path'

// Load .env.local then .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import { PrismaClient } from '../lib/prisma-client'
import {
  MODULES,
  ROLE_DEFINITIONS,
  AppModule,
  AccessLevel,
} from '../lib/role-definitions'

export function validateRoleDefinitions(): void {
  const validLegacyRoles = new Set(['admin', 'developer', 'viewer'])

  for (const role of ROLE_DEFINITIONS) {
    if (!Number.isInteger(role.level)) {
      throw new Error(`Validation Error: Role "${role.key}" level must be an integer, got: ${role.level}`)
    }

    if (!validLegacyRoles.has(role.legacyTeamRole)) {
      throw new Error(
        `Validation Error: Role "${role.key}" legacyTeamRole must be 'admin' | 'developer' | 'viewer', got: ${role.legacyTeamRole}`
      )
    }

    // Check all 12 modules defined
    for (const mod of MODULES) {
      if (!role.access[mod]) {
        throw new Error(`Validation Error: Role "${role.key}" is missing module access for "${mod}"`)
      }
    }

    // Owner checks: MANAGE on all except AUDIT_LOGS (VIEW)
    if (role.key === 'owner') {
      for (const mod of MODULES) {
        if (mod === AppModule.AUDIT_LOGS) {
          if (role.access[mod] !== AccessLevel.VIEW) {
            throw new Error(`Validation Error: Owner must have VIEW on AUDIT_LOGS, got: ${role.access[mod]}`)
          }
        } else {
          if (role.access[mod] !== AccessLevel.MANAGE) {
            throw new Error(`Validation Error: Owner must have MANAGE on ${mod}, got: ${role.access[mod]}`)
          }
        }
      }
    }

    // No role above VIEW on AUDIT_LOGS
    const auditAccess = role.access[AppModule.AUDIT_LOGS]
    if (auditAccess === AccessLevel.WRITE || auditAccess === AccessLevel.MANAGE) {
      throw new Error(
        `Validation Error: Role "${role.key}" cannot have access level above VIEW on AUDIT_LOGS, got: ${auditAccess}`
      )
    }
  }
}

export async function seedRoles(prisma: PrismaClient) {
  console.log('Validating role definitions...')
  validateRoleDefinitions()
  console.log('✓ Role definitions are valid.')

  console.log('Seeding roles and role access entries in transaction...')
  await prisma.$transaction(
    async (tx) => {
      for (const roleDef of ROLE_DEFINITIONS) {
        const role = await tx.role.upsert({
          where: { key: roleDef.key },
          update: {
            name: roleDef.name,
            description: roleDef.description,
            level: roleDef.level,
            legacyTeamRole: roleDef.legacyTeamRole,
            isSystem: true,
          },
          create: {
            key: roleDef.key,
            name: roleDef.name,
            description: roleDef.description,
            level: roleDef.level,
            legacyTeamRole: roleDef.legacyTeamRole,
            isSystem: true,
          },
        })

        await Promise.all(
          MODULES.map((mod) =>
            tx.roleAccess.upsert({
              where: {
                roleId_module: {
                  roleId: role.id,
                  module: mod,
                },
              },
              update: {
                level: roleDef.access[mod],
              },
              create: {
                roleId: role.id,
                module: mod,
                level: roleDef.access[mod],
              },
            })
          )
        )
      }

      // Check for any rows not in definitions and warn without deleting
      const definedKeys = new Set(ROLE_DEFINITIONS.map((r) => r.key))
      const existingRoles = await tx.role.findMany({ select: { key: true } })
      for (const r of existingRoles) {
        if (!definedKeys.has(r.key)) {
          console.warn(`[WARN] Role "${r.key}" exists in database but is not defined in lib/role-definitions.ts`)
        }
      }
    },
    {
      maxWait: 15000,
      timeout: 60000,
    }
  )

  console.log('✓ Successfully seeded roles and role access!')

  // Print final matrix as a table
  const tableData = ROLE_DEFINITIONS.map((role) => ({
    Role: role.name,
    Key: role.key,
    Level: role.level,
    Legacy: role.legacyTeamRole,
    Work: role.access[AppModule.WORK],
    Collab: role.access[AppModule.COLLAB],
    CRM: role.access[AppModule.CRM],
    Finance: role.access[AppModule.FINANCE],
    Products: role.access[AppModule.PRODUCTS],
    Reports: role.access[AppModule.REPORTS],
    Automations: role.access[AppModule.AUTOMATIONS],
    Employees: role.access[AppModule.EMPLOYEES],
    Roles: role.access[AppModule.ROLES],
    DevSettings: role.access[AppModule.DEV_SETTINGS],
    CompanySettings: role.access[AppModule.COMPANY_SETTINGS],
    AuditLogs: role.access[AppModule.AUDIT_LOGS],
  }))

  console.log('\n--- Role Access Matrix ---')
  console.table(tableData)
}

// Run directly when executed
if (
  process.argv[1]?.includes('seed-roles') ||
  process.env.npm_lifecycle_event === 'db:seed:roles'
) {
  const prisma = new PrismaClient()
  seedRoles(prisma)
    .catch((err) => {
      console.error('Failed to seed roles:', err)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
