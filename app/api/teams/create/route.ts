import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession, handleRouteError } from '@/lib/authz'
import { db } from '@/lib/db'

const createTeamSchema = z.object({
  displayName: z.string().min(1).max(100),
}).strict()

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession()
    const user = session.user
    const userId = user.id

    const rawBody = await request.json()
    const { displayName } = createTeamSchema.parse(rawBody)

    // Generate unique team key
    const baseKey = displayName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'A').padEnd(3, 'A')
    const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase()
    const teamKey = `${baseKey}${randomSuffix}`

    const defaultWorkflowStates = [
      { name: 'Backlog', type: 'backlog', color: '#64748b', position: 0 },
      { name: 'Todo', type: 'unstarted', color: '#3b82f6', position: 1 },
      { name: 'In Progress', type: 'started', color: '#f59e0b', position: 2 },
      { name: 'Done', type: 'completed', color: '#10b981', position: 3 },
    ]

    const defaultLabels = [
      { name: 'Bug', color: '#ef4444' },
      { name: 'Feature', color: '#8b5cf6' },
      { name: 'Enhancement', color: '#06b6d4' },
      { name: 'Documentation', color: '#84cc16' },
    ]

    // Entire team bootstrap executed atomically inside a transaction
    const team = await db.$transaction(async (tx) => {
      const createdTeam = await tx.team.create({
        data: {
          name: displayName,
          key: teamKey,
          members: {
            create: {
              userId,
              userName: user.name || user.email || 'Admin',
              userEmail: user.email || '',
              role: 'admin',
            },
          },
        },
      })

      for (const state of defaultWorkflowStates) {
        await tx.workflowState.create({
          data: {
            ...state,
            teamId: createdTeam.id,
          },
        })
      }

      for (const label of defaultLabels) {
        await tx.label.create({
          data: {
            ...label,
            teamId: createdTeam.id,
          },
        })
      }

      return createdTeam
    })

    return NextResponse.json(team, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
