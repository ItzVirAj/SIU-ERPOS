import dotenv from 'dotenv'
import path from 'path'
import crypto from 'crypto'
import { hashPassword } from 'better-auth/crypto'

// Load .env.local then .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import { PrismaClient, EmployeeStatus, User } from '../lib/prisma-client'
import { seedRoles } from './seed-roles'
import { normalizeEmail, syncTeamMemberRole } from '../lib/employee-sync'
import { generateEmployeeCode } from '../lib/employee-code'

export async function seedOwner(prismaClient?: PrismaClient) {
  const prisma = prismaClient ?? new PrismaClient()

  // 1. Environment Guard
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not defined.')
  }

  const parsedUrl = new URL(databaseUrl)
  const host = parsedUrl.hostname.toLowerCase()
  const isDevHost =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.includes('neon.tech') ||
    host.includes('dev') ||
    host.includes('local')

  const isProduction = process.env.NODE_ENV === 'production'
  const allowProdSeed = process.env.ALLOW_PROD_SEED === '1'

  if ((isProduction || !isDevHost) && !allowProdSeed) {
    console.error(
      '❌ ENVIRONMENT GUARD BLOCKED EXECUTION:\n' +
        `Target database host "${host}" or NODE_ENV="${process.env.NODE_ENV}" appears to be a production environment.\n` +
        'To seed on production, set ALLOW_PROD_SEED=1 and specify a strong OWNER_PASSWORD.\n' +
        'Example: ALLOW_PROD_SEED=1 OWNER_PASSWORD="<strong password>" npm run db:seed:owner'
    )
    process.exit(1)
  }

  console.log(`[seed-owner] Environment guard passed (Host: ${host})`)

  // 2. Call seedRoles first and verify 'owner' role exists
  console.log('[seed-owner] Ensuring system roles are seeded...')
  await seedRoles(prisma)

  const ownerRole = await prisma.role.findUnique({
    where: { key: 'owner' },
  })

  if (!ownerRole) {
    throw new Error('Fatal error: Role with key "owner" does not exist even after running seedRoles().')
  }

  const ownerEmail = normalizeEmail(process.env.OWNER_EMAIL || 'owner@sketchitup.in')
  const ownerName = process.env.OWNER_NAME || 'Owner'
  const ownerPassword = process.env.OWNER_PASSWORD || 'Pass@123'
  const isDefaultPassword = ownerPassword === 'Pass@123'
  const shouldResetPassword = process.env.RESET_PASSWORD === '1'

  const { userRecord, resolvedTeam, employeeRecord, passwordSetThisRun } =
    await prisma.$transaction(
      async (tx) => {
        let passwordSetThisRun = false
        let resolvedTeam: { id: string; name: string; key: string }
        let userRecord: User
        let employeeRecord: { id: string; mustChangePassword: boolean; status: EmployeeStatus }
      // 3. Resolve the company team
      const envTeamKey = process.env.TEAM_KEY
      if (envTeamKey) {
        resolvedTeam = await tx.team.upsert({
          where: { key: envTeamKey },
          update: {},
          create: {
            key: envTeamKey,
            name: process.env.TEAM_NAME || 'SketchItUp',
          },
          select: { id: true, name: true, key: true },
        })
        console.log(`[seed-owner] Resolved team via TEAM_KEY="${envTeamKey}": ${resolvedTeam.name} (${resolvedTeam.key})`)
      } else {
        const existingTeams = await tx.team.findMany({
          select: { id: true, name: true, key: true },
        })

        if (existingTeams.length === 1) {
          resolvedTeam = existingTeams[0]
          console.log(`[seed-owner] Using existing single team: ${resolvedTeam.name} (${resolvedTeam.key})`)
        } else if (existingTeams.length > 1) {
          const teamList = existingTeams.map((t) => `${t.name} (key: ${t.key})`).join(', ')
          throw new Error(
            `Ambiguous team configuration: More than one team exists [${teamList}]. Please specify TEAM_KEY in your environment.`
          )
        } else {
          resolvedTeam = await tx.team.create({
            data: {
              key: 'SKT',
              name: process.env.TEAM_NAME || 'SketchItUp',
            },
            select: { id: true, name: true, key: true },
          })
          console.log(`[seed-owner] Created default team: ${resolvedTeam.name} (${resolvedTeam.key})`)
        }
      }

      // 4. Resolve User
      let existingUser = await tx.user.findUnique({
        where: { email: ownerEmail },
      })

      if (!existingUser) {
        // Generate Better Auth compatible ID
        const generatedUserId = crypto.randomBytes(24).toString('base64url').slice(0, 32)
        const localPart = ownerEmail.split('@')[0]

        // Ensure unique username
        let usernameCandidate = localPart
        let suffix = 1
        while (await tx.user.findUnique({ where: { username: usernameCandidate } })) {
          usernameCandidate = `${localPart}${suffix}`
          suffix++
        }

        // Generate unique employee code
        let empCode: string
        let attempts = 0
        do {
          empCode = generateEmployeeCode()
          attempts++
          const inUsers = await tx.user.findUnique({ where: { employeeCode: empCode } })
          const inEmps = await tx.employee.findUnique({ where: { employeeCode: empCode } })
          if (!inUsers && !inEmps) break
        } while (attempts < 100)

        existingUser = await tx.user.create({
          data: {
            id: generatedUserId,
            email: ownerEmail,
            name: ownerName,
            emailVerified: true,
            username: usernameCandidate,
            position: 'Owner',
            department: 'Management',
            joiningDate: new Date(),
            employeeCode: empCode,
          },
        })
        console.log(`[seed-owner] Created user record for ${ownerEmail}`)
      } else {
        // Fill only empty fields, never overwrite edited values
        const updateData: Record<string, unknown> = {}
        if (!existingUser.position) updateData.position = 'Owner'
        if (!existingUser.department) updateData.department = 'Management'
        if (!existingUser.joiningDate) updateData.joiningDate = new Date()

        if (!existingUser.employeeCode) {
          let empCode: string
          let attempts = 0
          do {
            empCode = generateEmployeeCode()
            attempts++
            const inUsers = await tx.user.findUnique({ where: { employeeCode: empCode } })
            const inEmps = await tx.employee.findUnique({ where: { employeeCode: empCode } })
            if (!inUsers && !inEmps) break
          } while (attempts < 100)
          updateData.employeeCode = empCode
        }

        if (Object.keys(updateData).length > 0) {
          existingUser = await tx.user.update({
            where: { id: existingUser.id },
            data: updateData,
          })
          console.log(`[seed-owner] Updated missing user fields for ${ownerEmail}`)
        }
      }

      userRecord = existingUser

      // 5. Credential Account
      const existingAccount = await tx.account.findFirst({
        where: {
          userId: userRecord.id,
          providerId: 'credential',
        },
      })

      if (!existingAccount) {
        const hashedPassword = await hashPassword(ownerPassword)
        const accountId = crypto.randomBytes(24).toString('base64url').slice(0, 32)
        await tx.account.create({
          data: {
            id: accountId,
            accountId: userRecord.id,
            userId: userRecord.id,
            providerId: 'credential',
            password: hashedPassword,
          },
        })
        passwordSetThisRun = true
        console.log('[seed-owner] Created credential account for owner')
      } else if (shouldResetPassword) {
        const hashedPassword = await hashPassword(ownerPassword)
        await tx.account.update({
          where: { id: existingAccount.id },
          data: { password: hashedPassword },
        })
        await tx.session.deleteMany({
          where: { userId: userRecord.id },
        })
        passwordSetThisRun = true
        console.log('[seed-owner] RESET_PASSWORD=1 detected: updated password and revoked existing sessions')
      }

      // 6. Employee Row
      let existingEmployee = await tx.employee.findUnique({
        where: { userId: userRecord.id },
        include: { role: true },
      })

      const mustChangePass = isDefaultPassword

      if (!existingEmployee) {
        existingEmployee = await tx.employee.create({
          data: {
            userId: userRecord.id,
            email: normalizeEmail(userRecord.email),
            fullName: userRecord.name,
            employeeCode: userRecord.employeeCode,
            position: userRecord.position || 'Owner',
            department: userRecord.department || 'Management',
            joiningDate: userRecord.joiningDate || new Date(),
            roleId: ownerRole.id,
            teamId: resolvedTeam.id,
            status: EmployeeStatus.ACTIVE,
            mustChangePassword: mustChangePass,
          },
          include: { role: true },
        })
        console.log('[seed-owner] Created employee row with role "owner"')
      } else {
        const updateEmployeeData: Record<string, unknown> = {
          email: normalizeEmail(userRecord.email),
          fullName: userRecord.name,
          employeeCode: userRecord.employeeCode,
          teamId: resolvedTeam.id,
          status: EmployeeStatus.ACTIVE,
        }

        if (existingEmployee.roleId !== ownerRole.id) {
          console.log(
            `[seed-owner] Employee role was "${existingEmployee.role?.key}", overriding to "owner"`
          )
          updateEmployeeData.roleId = ownerRole.id
        }

        if (passwordSetThisRun) {
          updateEmployeeData.mustChangePassword = mustChangePass
        }

        existingEmployee = await tx.employee.update({
          where: { id: existingEmployee.id },
          data: updateEmployeeData,
          include: { role: true },
        })
      }

      employeeRecord = existingEmployee

      // 7. Team member link
      await syncTeamMemberRole(tx, employeeRecord.id)
      await tx.teamMember.updateMany({
        where: {
          userId: userRecord.id,
          teamId: resolvedTeam.id,
        },
        data: {
          userEmail: userRecord.email,
          userName: userRecord.name,
        },
      })
      console.log('[seed-owner] Synchronized team_members row to legacy role "admin"')

      // 8. Single-owner safety check
      const activeOwners = await tx.employee.findMany({
        where: {
          teamId: resolvedTeam.id,
          roleId: ownerRole.id,
          status: EmployeeStatus.ACTIVE,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      })

      if (activeOwners.length > 1) {
        console.warn(
          `\n⚠️  WARNING: Multiple active owner employees found in team "${resolvedTeam.name}":`
        )
        for (const o of activeOwners) {
          console.warn(`   - ID: ${o.id}, Email: ${o.email}, Name: ${o.fullName}`)
        }
      }

      return {
        userRecord,
        resolvedTeam,
        employeeRecord,
        passwordSetThisRun,
      }
    },
    {
      timeout: 60000,
      maxWait: 15000,
    }
  )

  // 9. Summary Table
  console.log('\n--- Owner Provisioning Summary ---')
  console.table([
    {
      UserId: userRecord.id,
      Email: userRecord.email,
      EmployeeCode: userRecord.employeeCode,
      Role: 'owner',
      Team: `${resolvedTeam.name} (${resolvedTeam.key})`,
      LegacyRole: 'admin',
      PasswordSetThisRun: passwordSetThisRun,
      MustChangePassword: employeeRecord.mustChangePassword,
    },
  ])

  if (isDefaultPassword) {
    console.warn('\n⚠️  SECURITY WARNING:')
    console.warn('   Initial default password "Pass@123" is currently set for the owner account.')
    console.warn('   The owner must change this password immediately after the first login.')
    console.warn(
      '   Exact command for production deployment:\n' +
        '   ALLOW_PROD_SEED=1 OWNER_PASSWORD="<strong password>" npm run db:seed:owner\n'
    )
  }
}

// Run directly
if (
  process.argv[1]?.includes('seed-owner') ||
  process.env.npm_lifecycle_event === 'db:seed:owner'
) {
  const prisma = new PrismaClient()
  seedOwner(prisma)
    .catch((err) => {
      console.error('Fatal error during seed-owner:', err)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
