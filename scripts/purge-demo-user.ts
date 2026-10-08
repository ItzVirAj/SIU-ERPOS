/**
 * Security Maintenance Script: Purge Demo & Temporary User Accounts
 * 
 * Target: Removes `temp@doable.local` and any temporary test accounts (`temp*@doable.local`).
 * Purges associated Sessions, Accounts, Team Memberships, Chat Conversations, and Inbox data.
 *
 * Usage:
 *   Dry run:
 *     npx tsx scripts/purge-demo-user.ts --dry-run
 * 
 *   Execute purge:
 *     npx tsx scripts/purge-demo-user.ts
 *
 * Running in Production (e.g., Render / Server):
 *   DATABASE_URL="postgresql://..." npx tsx scripts/purge-demo-user.ts
 */

import 'dotenv/config'
import { PrismaClient } from '../lib/prisma-client'

const prisma = new PrismaClient()

const TARGET_EMAILS = [
  'temp@doable.local',
]

async function purgeDemoUser() {
  const isDryRun = process.argv.includes('--dry-run')

  console.log('====================================================')
  console.log('🔒 SIU-ERPOS Security: Demo User Account Purge Tool')
  console.log('====================================================')
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (no data will be altered)' : '⚠️ LIVE PURGE'}\n`)

  try {
    // Search for explicit target emails or temporary demo accounts
    const targetUsers = await prisma.user.findMany({
      where: {
        OR: [
          { email: { in: TARGET_EMAILS } },
          { email: { startsWith: 'temp' } },
        ],
      },
      include: {
        accounts: true,
        sessions: true,
      },
    })

    if (targetUsers.length === 0) {
      console.log('✅ No demo users (temp*@doable.local) found in the database. Nothing to purge.')
      return
    }

    console.log(`Found ${targetUsers.length} target demo user(s):`)
    for (const u of targetUsers) {
      console.log(`  - ID: ${u.id} | Email: ${u.email} | Name: ${u.name} | Sessions: ${u.sessions.length} | Accounts: ${u.accounts.length}`)
    }
    console.log('')

    if (isDryRun) {
      console.log('🔍 Dry run complete. To execute deletion, run without --dry-run flag.')
      return
    }

    const userIds = targetUsers.map((u) => u.id)
    const userEmails = targetUsers.map((u) => u.email)

    console.log('Executing database transaction...')

    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete associated team and project memberships
      const deletedTeamMembers = await tx.teamMember.deleteMany({
        where: { userId: { in: userIds } },
      })

      const deletedProjectMembers = await tx.projectMember.deleteMany({
        where: { userId: { in: userIds } },
      })

      // 2. Delete team channel memberships
      const deletedChannelMembers = await tx.teamChannelMember.deleteMany({
        where: { userId: { in: userIds } },
      })

      // 3. Delete personal chat conversations
      const deletedChats = await tx.chatConversation.deleteMany({
        where: { userId: { in: userIds } },
      })

      // 4. Delete inbox messages
      const deletedInbox = await tx.inboxMessage.deleteMany({
        where: { userId: { in: userIds } },
      })

      // 5. Delete standup entries
      const deletedStandups = await tx.standupEntry.deleteMany({
        where: { userId: { in: userIds } },
      })

      // 6. Delete invitations for these emails
      const deletedInvites = await tx.invitation.deleteMany({
        where: { email: { in: userEmails } },
      })

      // 7. Delete sessions & accounts (handled by cascade, but explicitly cleaned for safety)
      const deletedSessions = await tx.session.deleteMany({
        where: { userId: { in: userIds } },
      })

      const deletedAccounts = await tx.account.deleteMany({
        where: { userId: { in: userIds } },
      })

      // 8. Delete user records
      const deletedUsers = await tx.user.deleteMany({
        where: { id: { in: userIds } },
      })

      return {
        deletedUsers: deletedUsers.count,
        deletedSessions: deletedSessions.count,
        deletedAccounts: deletedAccounts.count,
        deletedTeamMembers: deletedTeamMembers.count,
        deletedProjectMembers: deletedProjectMembers.count,
        deletedChannelMembers: deletedChannelMembers.count,
        deletedChats: deletedChats.count,
        deletedInbox: deletedInbox.count,
        deletedStandups: deletedStandups.count,
        deletedInvites: deletedInvites.count,
      }
    })

    console.log('\n✅ Successfully purged demo user data:')
    console.log(`  - Users deleted: ${result.deletedUsers}`)
    console.log(`  - Sessions deleted: ${result.deletedSessions}`)
    console.log(`  - Accounts deleted: ${result.deletedAccounts}`)
    console.log(`  - Team memberships removed: ${result.deletedTeamMembers}`)
    console.log(`  - Project memberships removed: ${result.deletedProjectMembers}`)
    console.log(`  - Channel memberships removed: ${result.deletedChannelMembers}`)
    console.log(`  - Chat conversations removed: ${result.deletedChats}`)
    console.log(`  - Inbox messages removed: ${result.deletedInbox}`)
    console.log(`  - Standup entries removed: ${result.deletedStandups}`)
    console.log(`  - Pending invitations removed: ${result.deletedInvites}`)
    console.log('\n🔒 Demo user cleanup completed.')
  } catch (error) {
    console.error('❌ Error while purging demo users:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

purgeDemoUser()
