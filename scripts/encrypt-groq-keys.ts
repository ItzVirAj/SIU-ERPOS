/**
 * Migration script: Encrypt plaintext Groq API keys in the database.
 * 
 * Usage:
 *   Dry run (default):
 *     npx tsx scripts/encrypt-groq-keys.ts
 * 
 *   Apply migration:
 *     npx tsx scripts/encrypt-groq-keys.ts --apply
 */

import 'dotenv/config'
import { PrismaClient } from '../lib/prisma-client'
import { encryptSecret, isEncrypted } from '../lib/secrets'

const prisma = new PrismaClient()

async function main() {
  const isApply = process.argv.includes('--apply')

  console.log(`=== Groq API Key Encryption Migration ===`)
  console.log(`Mode: ${isApply ? 'APPLY (live database update)' : 'DRY RUN (no changes will be written)'}\n`)

  const teams = await prisma.team.findMany({
    select: {
      id: true,
      name: true,
      groqApiKey: true,
    },
  })

  let alreadyEncryptedCount = 0
  let noKeyCount = 0
  let plaintextCount = 0
  let updatedCount = 0

  for (const team of teams) {
    if (!team.groqApiKey) {
      noKeyCount++
      continue
    }

    if (isEncrypted(team.groqApiKey)) {
      alreadyEncryptedCount++
      continue
    }

    plaintextCount++

    if (isApply) {
      const encrypted = encryptSecret(team.groqApiKey)
      await prisma.team.update({
        where: { id: team.id },
        data: { groqApiKey: encrypted },
      })
      updatedCount++
      console.log(`  ✓ Encrypted key for team "${team.name}" (ID: ${team.id})`)
    }
  }

  console.log('\n--- Summary ---')
  console.log(`Total teams: ${teams.length}`)
  console.log(`Teams without Groq key: ${noKeyCount}`)
  console.log(`Teams already encrypted: ${alreadyEncryptedCount}`)
  console.log(`Teams with plaintext keys: ${plaintextCount}`)

  if (isApply) {
    console.log(`\nSuccessfully applied encryption to ${updatedCount} team(s).`)
  } else {
    if (plaintextCount > 0) {
      console.log(`\n[DRY RUN] ${plaintextCount} key(s) require encryption. Run with --apply to apply changes.`)
    } else {
      console.log('\n[DRY RUN] All existing keys are already encrypted or empty. No changes needed.')
    }
  }
}

main()
  .catch((err) => {
    console.error('Migration failed:', err.message)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
