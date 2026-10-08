import 'dotenv/config'
import { PrismaClient } from '../lib/prisma-client'
import { hashPassword, verifyPassword } from 'better-auth/crypto'
import crypto from 'crypto'

const prisma = new PrismaClient()

async function main() {
  const email = 'demo@siu.in'
  const rawPassword = 'Pass@123'
  const name = 'Demo User'

  console.log(`Checking existing user for ${email}...`)
  let existingUser = await prisma.user.findUnique({
    where: { email },
    include: { accounts: true },
  })

  const hashedPassword = await hashPassword(rawPassword)

  let userId: string

  if (existingUser) {
    console.log(`Found existing user with ID: ${existingUser.id}`)
    userId = existingUser.id
    await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        emailVerified: true,
      },
    })

    const credentialAccount = existingUser.accounts.find((a) => a.providerId === 'credential')
    if (credentialAccount) {
      console.log(`Updating existing credential account password...`)
      await prisma.account.update({
        where: { id: credentialAccount.id },
        data: {
          password: hashedPassword,
          updatedAt: new Date(),
        },
      })
    } else {
      console.log(`Creating credential account for existing user...`)
      await prisma.account.create({
        data: {
          id: crypto.randomUUID(),
          accountId: userId,
          providerId: 'credential',
          userId: userId,
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })
    }
  } else {
    console.log(`Creating new user ${email}...`)
    userId = crypto.randomUUID()
    const user = await prisma.user.create({
      data: {
        id: userId,
        email,
        name,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })

    console.log(`Creating credential account with password...`)
    await prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        accountId: userId,
        providerId: 'credential',
        userId: userId,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
  }

  // Ensure "Demo's Workspace" team exists and user is admin
  let team = await prisma.team.findFirst({
    where: { name: "Demo's Workspace" },
  })

  if (!team) {
    console.log(`Creating "Demo's Workspace" team...`)
    team = await prisma.team.create({
      data: {
        name: "Demo's Workspace",
        key: "DEM",
      },
    })
  }

  // Ensure team membership
  const existingMember = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId: team.id,
        userId: userId,
      },
    },
  })

  if (!existingMember) {
    console.log(`Adding user to team ${team.name} as admin...`)
    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: userId,
        userEmail: email,
        userName: name,
        role: 'admin',
      },
    })
  } else {
    console.log(`Updating user's role in team to admin...`)
    await prisma.teamMember.update({
      where: { id: existingMember.id },
      data: {
        role: 'admin',
        userName: name,
        userEmail: email,
      },
    })
  }

  // Verify the password hash works with better-auth/crypto
  const account = await prisma.account.findFirst({
    where: { userId, providerId: 'credential' },
  })
  if (account?.password) {
    const isValid = await verifyPassword({
      hash: account.password,
      password: rawPassword,
    })
    console.log(`Verification check: Password 'Pass@123' validates correctly? -> ${isValid}`)
  }

  console.log('\n🎉 Successfully provisioned demo account:')
  console.log(`   Email: ${email}`)
  console.log(`   Password: ${rawPassword}`)
  console.log(`   User ID: ${userId}`)
  console.log(`   Team: ${team.name} (${team.id})`)
}

main()
  .catch((e) => {
    console.error('Error seeding demo user:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
