import { Prisma } from '@/lib/prisma-client'

export const publicTeamSelect = {
  id: true,
  name: true,
  key: true,
  createdAt: true,
  updatedAt: true,
} as const

export type PublicTeam = Prisma.TeamGetPayload<{ select: typeof publicTeamSelect }>
