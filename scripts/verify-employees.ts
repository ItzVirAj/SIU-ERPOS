import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import { PrismaClient } from '../lib/prisma-client'
import { normalizeEmail } from '../lib/employee-sync'

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

async function verifyEmployees() {
  console.log('===================================================')
  console.log('Verifying Employees, Invariants & Role Access')
  console.log('===================================================')

  const prisma = new PrismaClient()

  try {
    // 1. Roles & RoleAccess count check (13 roles, 156 role_access)
    console.log('\n[1] Checking Roles & RoleAccess Integrity:')
    const rolesCount = await prisma.role.count()
    const roleAccessCount = await prisma.roleAccess.count()
    assert(rolesCount === 13, `Roles count is exactly 13 (got ${rolesCount})`)
    assert(roleAccessCount === 156, `RoleAccess count is exactly 156 (got ${roleAccessCount})`)

    // 2. Users without an employee row (expect 0)
    console.log('\n[2] Checking Users Without an Employee Row:')
    const usersWithoutEmployee = await prisma.user.findMany({
      where: {
        employee: null,
      },
      select: { id: true, email: true },
    })
    assert(
      usersWithoutEmployee.length === 0,
      `Users without an employee row is 0 (found ${usersWithoutEmployee.length})`
    )
    if (usersWithoutEmployee.length > 0) {
      console.error('Users without employee:', usersWithoutEmployee)
    }

    // 3. Employees whose email differs from user.email (expect 0)
    console.log('\n[3] Checking Email Synchronization (employee.email vs user.email):')
    const allEmployees = await prisma.employee.findMany({
      include: {
        user: true,
        role: true,
      },
    })

    let emailMismatches = 0
    for (const emp of allEmployees) {
      if (normalizeEmail(emp.email) !== normalizeEmail(emp.user.email)) {
        emailMismatches++
        console.error(`  Email mismatch: Employee email "${emp.email}" vs User email "${emp.user.email}"`)
      }
    }
    assert(
      emailMismatches === 0,
      `Employees whose email differs from user.email is 0 (found ${emailMismatches})`
    )

    // 4. Duplicate lower(email) in employees table (expect 0)
    console.log('\n[4] Checking Duplicate Lowercase Emails in Employees:')
    const emailCounts: Record<string, number> = {}
    for (const emp of allEmployees) {
      const lower = normalizeEmail(emp.email)
      emailCounts[lower] = (emailCounts[lower] || 0) + 1
    }
    const duplicateEmails = Object.entries(emailCounts).filter(([_, count]) => count > 1)
    assert(
      duplicateEmails.length === 0,
      `Duplicate lower(email) in employees is 0 (found ${duplicateEmails.length})`
    )
    if (duplicateEmails.length > 0) {
      console.error('Duplicate emails:', duplicateEmails)
    }

    // 5. Employees with a null role (expect 0)
    console.log('\n[5] Checking Employees With a Null Role:')
    let nullRoles = 0
    for (const emp of allEmployees) {
      if (!emp.roleId || !emp.role) {
        nullRoles++
      }
    }
    assert(nullRoles === 0, `Employees with a null role is 0 (found ${nullRoles})`)

    // 6. Print database records
    console.log('\n[6] Employee Directory Snapshot:')
    const summary = allEmployees.map((e) => ({
      id: e.id,
      userId: e.userId,
      email: e.email,
      fullName: e.fullName,
      employeeCode: e.employeeCode,
      role: e.role.key,
      legacyTeamRole: e.role.legacyTeamRole,
      teamId: e.teamId,
      status: e.status,
    }))
    console.table(summary)

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

verifyEmployees().catch((err) => {
  console.error('Fatal verification error:', err)
  process.exit(1)
})
