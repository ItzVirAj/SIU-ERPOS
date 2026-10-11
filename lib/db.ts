import { PrismaClient } from '@/lib/prisma-client'

function createPrismaClient() {
  return new PrismaClient({
    omit: {
      team: {
        groqApiKey: true,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

// In development, save Prisma client to global to avoid multiple instances
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
