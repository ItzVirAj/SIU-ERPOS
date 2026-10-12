import { AppModule, AccessLevel } from '@/lib/prisma-client'
import { hasAccess } from '@/lib/permissions'
import { AUDIT_ACTIONS, writeAudit } from '@/lib/audit'
import { db } from '@/lib/db'

export interface ToolRequirement {
  module: AppModule
  level: AccessLevel
}

/**
 * Single source of truth for AI tool authorization requirements.
 */
export const TOOL_REQUIREMENTS: Record<string, ToolRequirement | ToolRequirement[]> = {
  // WORK VIEW tools
  listIssues: { module: AppModule.WORK, level: AccessLevel.VIEW },
  getIssue: { module: AppModule.WORK, level: AccessLevel.VIEW },
  listProjects: { module: AppModule.WORK, level: AccessLevel.VIEW },
  listProjectMembers: { module: AppModule.WORK, level: AccessLevel.VIEW },
  getTeamStats: { module: AppModule.WORK, level: AccessLevel.VIEW },
  listTeamMembers: { module: AppModule.WORK, level: AccessLevel.VIEW },

  // WORK WRITE tools
  createIssue: { module: AppModule.WORK, level: AccessLevel.WRITE },
  createIssues: { module: AppModule.WORK, level: AccessLevel.WRITE },
  updateIssue: { module: AppModule.WORK, level: AccessLevel.WRITE },
  updateIssues: { module: AppModule.WORK, level: AccessLevel.WRITE },
  createProject: { module: AppModule.WORK, level: AccessLevel.WRITE },
  createProjects: { module: AppModule.WORK, level: AccessLevel.WRITE },
  updateProject: { module: AppModule.WORK, level: AccessLevel.WRITE },
  addProjectMember: { module: AppModule.WORK, level: AccessLevel.WRITE },
}

/**
 * Destructive tools disabled for now (not offered to the model; rejected at execution time).
 */
export const DISABLED_TOOLS = [
  'deleteIssue',
  'deleteIssues',
  'deleteProject',
  'removeProjectMember',
] as const

/**
 * Legacy tools permanently removed from the system.
 */
export const REMOVED_TOOLS = [
  'inviteTeamMember',
  'inviteTeamMembers',
  'revokeInvitation',
  'removeTeamMember',
] as const

export interface RequestToolState {
  totalCalls: number
  writeCalls: number
}

export function createRequestToolState(): RequestToolState {
  return { totalCalls: 0, writeCalls: 0 }
}

export interface ToolGuardOptions {
  actor?: {
    id: string
    name?: string | null
    roleKey?: string | null
  }
  teamId?: string
  state?: RequestToolState
}

export function isWriteTool(name: string): boolean {
  const req = TOOL_REQUIREMENTS[name]
  if (!req) return false
  const reqs = Array.isArray(req) ? req : [req]
  return reqs.some((r) => r.level === AccessLevel.WRITE || r.level === AccessLevel.MANAGE)
}

/**
 * Filters TOOL_REQUIREMENTS against the actor's permissions.
 * Tools in DISABLED_TOOLS or lacking required access are excluded.
 */
export function allowedToolNames(
  access: Record<AppModule, AccessLevel> | undefined | null
): string[] {
  if (!access) return []
  return Object.entries(TOOL_REQUIREMENTS)
    .filter(([name, req]) => {
      if ((DISABLED_TOOLS as readonly string[]).includes(name)) {
        return false
      }
      const reqs = Array.isArray(req) ? req : [req]
      return reqs.every((r) => hasAccess(access, r.module, r.level))
    })
    .map(([name]) => name)
}

/**
 * Truncates strings in argument summary to at most 200 characters and drops sensitive keys.
 */
export function summarizeToolArgs(args: any): any {
  if (args === null || args === undefined) return args
  if (typeof args === 'string') {
    return args.slice(0, 200)
  }
  if (typeof args !== 'object') return args
  if (Array.isArray(args)) {
    return args.map(summarizeToolArgs)
  }
  const summary: Record<string, any> = {}
  for (const [key, value] of Object.entries(args)) {
    if (/pass(word)?|token|secret|hash|authorization|cookie/i.test(key)) {
      continue
    }
    summary[key] = summarizeToolArgs(value)
  }
  return summary
}

async function recordAudit(
  actor: { id: string; name?: string | null; roleKey?: string | null } | undefined,
  teamId: string | undefined,
  toolName: string,
  outcome: 'success' | 'denied' | 'error',
  args: any
): Promise<void> {
  if (!actor?.id || !teamId) return
  try {
    const argSummary = summarizeToolArgs(args)
    await writeAudit(db, {
      actor: {
        id: actor.id,
        name: actor.name ?? null,
        role: actor.roleKey ? { key: actor.roleKey } : null,
      },
      teamId,
      action: AUDIT_ACTIONS.AI_TOOL_CALL,
      after: {
        tool: toolName,
        outcome,
        argSummary,
      },
    })
  } catch (err) {
    console.error('[AI_AUDIT_ERROR] Failed to write audit row:', err)
  }
}

/**
 * Defense-in-depth wrapper for AI tool execution:
 * 1. Checks DISABLED_TOOLS
 * 2. Re-checks permissions at runtime
 * 3. Enforces total tool calls (max 12) and write chain calls (max 5)
 * 4. Audits mutating calls (WRITE) and all denied calls
 * 5. Sanitizes caught exceptions
 */
export function guardTool<TArgs = any, TResult = any>(
  name: string,
  access: Record<AppModule, AccessLevel> | undefined | null,
  executeFn: (args: TArgs) => Promise<TResult>,
  options?: ToolGuardOptions
): (args: TArgs) => Promise<any> {
  const fallbackState: RequestToolState = { totalCalls: 0, writeCalls: 0 }

  return async (args: TArgs): Promise<any> => {
    const state = options?.state ?? fallbackState
    const isWrite = isWriteTool(name)

    // 1. Destructive tool check
    if ((DISABLED_TOOLS as readonly string[]).includes(name)) {
      await recordAudit(options?.actor, options?.teamId, name, 'denied', args)
      return { success: false, error: "You don't have permission to do that." }
    }

    // 2. Permission re-check at execution time
    const req = TOOL_REQUIREMENTS[name]
    const reqs = req ? (Array.isArray(req) ? req : [req]) : []
    const hasPerm =
      reqs.length > 0 && reqs.every((r) => hasAccess(access, r.module, r.level))

    if (!hasPerm) {
      await recordAudit(options?.actor, options?.teamId, name, 'denied', args)
      return { success: false, error: "You don't have permission to do that." }
    }

    // 3. Request-wide execution limits
    if (state.totalCalls >= 12) {
      await recordAudit(options?.actor, options?.teamId, name, 'denied', args)
      return { success: false, error: 'Tool execution limit exceeded for this request.' }
    }

    if (isWrite && state.writeCalls >= 5) {
      await recordAudit(options?.actor, options?.teamId, name, 'denied', args)
      return {
        success: false,
        error: 'I stopped after several changes. Please confirm what else you want.',
      }
    }

    // Increment call counters
    state.totalCalls++
    if (isWrite) {
      state.writeCalls++
    }

    // 4. Execution
    try {
      const result = await executeFn(args)
      const isFailure =
        result && typeof result === 'object' && (result as any).success === false

      if (isWrite) {
        await recordAudit(
          options?.actor,
          options?.teamId,
          name,
          isFailure ? 'error' : 'success',
          args
        )
      }

      return result
    } catch (err) {
      console.error(`[AI_TOOL_ERROR] Error executing tool ${name}:`, err)
      if (isWrite) {
        await recordAudit(options?.actor, options?.teamId, name, 'error', args)
      }
      return {
        success: false,
        error: 'An unexpected error occurred while executing the tool.',
      }
    }
  }
}
