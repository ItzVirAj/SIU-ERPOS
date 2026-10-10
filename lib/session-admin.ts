import { Prisma, PrismaClient } from './prisma-client'

type PrismaOrTx = PrismaClient | Prisma.TransactionClient

/**
 * Revokes all active sessions for a given user.
 * Returns the number of sessions deleted.
 */
export async function revokeAllSessions(
  tx: PrismaOrTx,
  userId: string
): Promise<number> {
  const result = await tx.session.deleteMany({
    where: { userId },
  })
  return result.count
}

/**
 * Revokes a single session, ensuring it belongs to the specified user.
 * Returns true if a session was deleted, false otherwise.
 */
export async function revokeSession(
  tx: PrismaOrTx,
  userId: string,
  sessionId: string
): Promise<boolean> {
  const result = await tx.session.deleteMany({
    where: {
      id: sessionId,
      userId,
    },
  })
  return result.count > 0
}
