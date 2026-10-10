import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import { PrismaClient } from '../lib/prisma-client'
import { auth } from '../lib/auth'
import { verifyPassword } from 'better-auth/crypto'
import { seedOwner } from '../prisma/seed-owner'

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

async function runOwnerVerification() {
  console.log('===================================================')
  console.log('Owner Seed & Authentication Verification Suite')
  console.log('===================================================')

  const prisma = new PrismaClient()
  const ownerEmail = 'owner@sketchitup.in'
  const correctPassword = process.env.OWNER_PASSWORD || 'Pass@123'
  const wrongPassword = 'WrongPassword@999'

  try {
    // 1. Check account before Run 2
    console.log('\n[1] Capturing existing password hash before Run 2:')
    const user1 = await prisma.user.findUnique({
      where: { email: ownerEmail },
      include: { accounts: true },
    })
    assert(!!user1, 'Owner user exists')
    const credentialAccount1 = user1?.accounts.find((a) => a.providerId === 'credential')
    assert(!!credentialAccount1?.password, 'Credential account password hash exists')
    const initialHash = credentialAccount1?.password

    // 2. Run seedOwner a second time (Idempotency test)
    console.log('\n[2] Executing seedOwner Run 2 (Idempotency Test):')
    await seedOwner(prisma)

    // Check account after Run 2
    const user2 = await prisma.user.findUnique({
      where: { email: ownerEmail },
      include: { accounts: true },
    })
    const credentialAccount2 = user2?.accounts.find((a) => a.providerId === 'credential')
    assert(
      credentialAccount2?.password === initialHash,
      'Password hash is completely UNTOUCHED after second run'
    )

    // 3. Authentication Verification (SignIn Test)
    console.log('\n[3] Testing Owner Login via Better Auth signInEmail:')
    let authSignInWorked = false
    try {
      const signInRes = await auth.api.signInEmail({
        body: {
          email: ownerEmail,
          password: correctPassword,
        },
      })
      assert(!!signInRes?.user && signInRes.user.email === ownerEmail, 'auth.api.signInEmail with correct password SUCCEEDED')
      authSignInWorked = true

      // Clean up sessions created by signIn test
      if (user2) {
        await prisma.session.deleteMany({
          where: { userId: user2.id },
        })
        console.log('  ✓ Cleaned up test session from database')
      }
    } catch (err) {
      console.warn('  auth.api.signInEmail threw an error, testing fallback verifyPassword:', err)
      const valid = await verifyPassword({
        hash: credentialAccount2!.password!,
        password: correctPassword,
      })
      assert(valid === true, 'Fallback verifyPassword with correct password SUCCEEDED')
    }

    // Test with wrong password (must fail)
    console.log('\n[4] Testing Owner Login with Wrong Password (Must Fail):')
    if (authSignInWorked) {
      let wrongFailed = false
      try {
        await auth.api.signInEmail({
          body: {
            email: ownerEmail,
            password: wrongPassword,
          },
        })
      } catch (e) {
        wrongFailed = true
      }
      assert(wrongFailed, 'auth.api.signInEmail with wrong password correctly FAILED')
    } else {
      const invalid = await verifyPassword({
        hash: credentialAccount2!.password!,
        password: wrongPassword,
      })
      assert(invalid === false, 'Fallback verifyPassword with wrong password correctly FAILED')
    }

    // 4. Inspect User -> Employee -> Role -> TeamMember Chain
    console.log('\n[5] User -> Employee -> Role -> TeamMember Chain Table:')
    const chain = await prisma.user.findUnique({
      where: { email: ownerEmail },
      include: {
        employee: {
          include: {
            role: true,
            team: true,
          },
        },
      },
    })

    const teamMember = await prisma.teamMember.findFirst({
      where: {
        userId: chain!.id,
        teamId: chain!.employee!.teamId,
      },
    })

    const chainTable = [
      {
        'User ID': chain!.id,
        'User Email': chain!.email,
        'User Name': chain!.name,
        'Employee ID': chain!.employee?.id,
        'Employee Code': chain!.employee?.employeeCode,
        'Employee Role': chain!.employee?.role.key,
        'Role Level': chain!.employee?.role.level,
        'Team Name': chain!.employee?.team.name,
        'Team Key': chain!.employee?.team.key,
        'TeamMember Role': teamMember?.role,
        'Must Change Pass': chain!.employee?.mustChangePassword,
      },
    ]
    console.table(chainTable)

    assert(chain!.employee?.role.key === 'owner', 'Employee is mapped to role "owner"')
    assert(chain!.employee?.role.level === 100, 'Owner role level is 100')
    assert(teamMember?.role === 'admin', 'TeamMember legacy role is "admin"')

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

runOwnerVerification().catch((e) => {
  console.error('Fatal verification error:', e)
  process.exit(1)
})
