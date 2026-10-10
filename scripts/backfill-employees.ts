import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import { PrismaClient } from '../lib/prisma-client'
import { generateEmployeeCode } from '../lib/employee-code'
import { normalizeEmail } from '../lib/employee-sync'

async function main() {
  const isApply = process.argv.includes('--apply')
  const prisma = new PrismaClient()

  console.log('===================================================')
  console.log(`Employee Backfill Script (${isApply ? 'APPLY MODE' : 'DRY RUN MODE'})`)
  console.log('===================================================')

  try {
    // 1. Load roles and teams
    const allRoles = await prisma.role.findMany()
    const roleByKey = new Map(allRoles.map((r) => [r.key, r]))

    const allTeams = await prisma.team.findMany()
    const envTeamKey = process.env.TEAM_KEY || 'SKT'
    const fallbackTeam =
      allTeams.find((t) => t.key === envTeamKey) ||
      (allTeams.length === 1 ? allTeams[0] : null)

    // 2. Load all users and existing employees
    const allUsers = await prisma.user.findMany()
    const existingEmployees = await prisma.employee.findMany()
    const existingEmployeeUserIds = new Set(existingEmployees.map((e) => e.userId))
    const existingEmployeeEmails = new Set(existingEmployees.map((e) => normalizeEmail(e.email)))
    const existingEmployeeCodes = new Set(
      existingEmployees.map((e) => e.employeeCode).filter(Boolean) as string[]
    )

    // 3. Load all team members sorted by createdAt asc
    const allMembers = await prisma.teamMember.findMany({
      orderBy: { createdAt: 'asc' },
    })
    const membersByUserId = new Map<string, typeof allMembers>()
    for (const m of allMembers) {
      const list = membersByUserId.get(m.userId) || []
      list.push(m)
      membersByUserId.set(m.userId, list)
    }

    // 4. Report multi-team users
    const multiTeamUsers: Array<{ email: string; teamCount: number; teams: string[] }> = []
    for (const user of allUsers) {
      const userMembers = membersByUserId.get(user.id) || []
      if (userMembers.length > 1) {
        multiTeamUsers.push({
          email: user.email,
          teamCount: userMembers.length,
          teams: userMembers.map((m) => m.teamId),
        })
      }
    }

    if (multiTeamUsers.length > 0) {
      console.log(`\nMulti-team users identified (${multiTeamUsers.length}):`)
      for (const m of multiTeamUsers) {
        console.log(`  - ${m.email}: belongs to ${m.teamCount} teams (earliest will be used)`)
      }
    }

    // 5. Track used codes and emails for conflict detection
    const usedEmails = new Set<string>(existingEmployeeEmails)
    const usedCodes = new Set<string>(
      allUsers.map((u) => u.employeeCode).filter(Boolean) as string[]
    )
    for (const code of existingEmployeeCodes) {
      usedCodes.add(code)
    }

    let createdCount = 0
    let skippedCount = 0
    const conflicts: string[] = []

    interface PendingEmployee {
      userId: string
      email: string
      fullName: string
      employeeCode: string
      position: string | null
      department: string | null
      phone: string | null
      joiningDate: Date | null
      roleId: string
      teamId: string
      generatedNewCode: boolean
    }

    const pendingCreations: PendingEmployee[] = []

    for (const user of allUsers) {
      if (existingEmployeeUserIds.has(user.id)) {
        skippedCount++
        continue
      }

      const lowerEmail = normalizeEmail(user.email)

      // Conflict: Duplicate lowercase email
      if (usedEmails.has(lowerEmail)) {
        conflicts.push(`Duplicate email found: "${lowerEmail}" for user ${user.id}`)
      } else {
        usedEmails.add(lowerEmail)
      }

      // Determine team
      const userMembers = membersByUserId.get(user.id) || []
      let teamId: string | null = null
      let memberRole: string = 'viewer'

      if (userMembers.length > 0) {
        const earliest = userMembers[0]
        teamId = earliest.teamId
        memberRole = earliest.role
      } else if (fallbackTeam) {
        teamId = fallbackTeam.id
        memberRole = 'viewer'
      } else {
        console.warn(`User ${user.email} (${user.id}) has no team membership and no single/fallback team exists. Skipping.`)
        skippedCount++
        continue
      }

      // Map role
      let roleKey = 'viewer'
      if (memberRole === 'admin') roleKey = 'admin'
      else if (memberRole === 'developer') roleKey = 'developer'

      const role = roleByKey.get(roleKey)
      if (!role) {
        conflicts.push(`Role not found for key: "${roleKey}"`)
        continue
      }

      // Determine employeeCode
      let code = user.employeeCode
      let generatedNewCode = false

      if (!code) {
        // Generate a unique employeeCode
        let attempts = 0
        do {
          code = generateEmployeeCode()
          attempts++
          if (attempts > 100) {
            conflicts.push(`Failed to generate unique employee code for user: ${user.id}`)
            break
          }
        } while (usedCodes.has(code))

        usedCodes.add(code)
        generatedNewCode = true
      } else {
        // Check for duplicate employeeCode among pending/existing
        const codeUpper = code.trim().toUpperCase()
        code = codeUpper
      }

      pendingCreations.push({
        userId: user.id,
        email: lowerEmail,
        fullName: user.name,
        employeeCode: code,
        position: user.position,
        department: user.department,
        phone: user.phone,
        joiningDate: user.joiningDate,
        roleId: role.id,
        teamId,
        generatedNewCode,
      })
    }

    // Check for conflicts
    if (conflicts.length > 0) {
      console.error('\n❌ Conflicts detected during backfill evaluation:')
      for (const err of conflicts) {
        console.error(`  - ${err}`)
      }
      process.exit(1)
    }

    console.log(`\nEvaluation result:`)
    console.log(`  - Users evaluated: ${allUsers.length}`)
    console.log(`  - Already had Employee: ${skippedCount}`)
    console.log(`  - Pending creation: ${pendingCreations.length}`)

    if (isApply && pendingCreations.length > 0) {
      console.log('\nApplying changes to database in transaction...')
      await prisma.$transaction(
        async (tx) => {
          for (const item of pendingCreations) {
            if (item.generatedNewCode) {
              await tx.user.update({
                where: { id: item.userId },
                data: { employeeCode: item.employeeCode },
              })
            }

            await tx.employee.create({
              data: {
                userId: item.userId,
                email: item.email,
                fullName: item.fullName,
                employeeCode: item.employeeCode,
                position: item.position,
                department: item.department,
                phone: item.phone,
                joiningDate: item.joiningDate,
                roleId: item.roleId,
                teamId: item.teamId,
              },
            })
            createdCount++
          }
        },
        {
          timeout: 60000,
          maxWait: 15000,
        }
      )
      console.log(`✓ Successfully created ${createdCount} employee rows.`)
    } else if (!isApply) {
      console.log('\nDry-run completed. No changes were written to the database.')
      console.log('Run with --apply to write these changes.')
    }

    console.log('\n--- Final Summary ---')
    console.log(`Created: ${isApply ? createdCount : pendingCreations.length} (mode: ${isApply ? 'APPLIED' : 'DRY RUN'})`)
    console.log(`Skipped: ${skippedCount}`)
    console.log(`Conflicts: ${conflicts.length}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('Fatal backfill error:', err)
  process.exit(1)
})
