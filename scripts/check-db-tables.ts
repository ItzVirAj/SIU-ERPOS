import dotenv from "dotenv"
dotenv.config()
import { PrismaClient } from "../lib/prisma-client"

const prisma = new PrismaClient()

async function main() {
  const columns = await prisma.$queryRaw<Array<{ column_name: string; data_type: string }>>`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'rateLimit' 
    ORDER BY ordinal_position;
  `
  console.log("Columns of rateLimit:")
  console.log(columns)

  const migrations = await prisma.$queryRaw<Array<{ migration_name: string; checksum: string; finished_at: string }>>`
    SELECT migration_name, checksum, finished_at FROM _prisma_migrations ORDER BY finished_at ASC;
  `
  console.log("Applied migrations in _prisma_migrations:")
  console.table(migrations)
}

main().finally(() => prisma.$disconnect())
