import { tool } from 'ai'
import { z } from 'zod'
import { db } from '@/lib/db'
import { TeamActorContext } from '@/lib/route-guards'
import { TeamContext } from '@/lib/types/chat'
import { createIssue, updateIssue, getIssues, getIssueById, deleteIssue } from '@/lib/api/issues'
import { createProject, updateProject, deleteProject } from '@/lib/api/projects'
import {
  resolveWorkflowState,
  resolveProject,
  resolveAssignee,
  resolveLabelIds,
  validateIssueFields,
  formatValidationError,
} from '@/lib/api/chat-helpers'
import {
  guardTool,
  allowedToolNames,
  RequestToolState,
} from '@/lib/ai/tool-guards'

export function buildChatTools(
  teamId: string,
  actor: TeamActorContext,
  requestToolState: RequestToolState,
  teamContext: TeamContext
) {
  const guard = (name: string, fn: (args: any) => Promise<any>) =>
    guardTool(name, actor.access, fn, {
      actor: { id: actor.userId, name: actor.user.name, roleKey: actor.member.roleKey },
      teamId,
      state: requestToolState,
    })

  const allTools = {
    // ==========================================
    // WORK VIEW TOOLS
    // ==========================================
    listIssues: tool({
      description: 'List issues in the workspace. Returns issues with title and description inside untrustedText.',
      inputSchema: z.object({
        limit: z.number().int().min(1).max(100).nullable().optional().describe('Maximum number of issues to return'),
      }),
      execute: guard('listIssues', async ({ limit }) => {
        try {
          const rawIssues = await getIssues(teamId)
          const issuesToReturn = limit ? rawIssues.slice(0, limit) : rawIssues

          return {
            success: true,
            issues: issuesToReturn.map((issue) => ({
              id: issue.id,
              number: issue.number,
              priority: issue.priority,
              estimate: issue.estimate,
              createdAt: issue.createdAt,
              workflowState: issue.workflowState
                ? { id: issue.workflowState.id, name: issue.workflowState.name }
                : null,
              project: issue.project
                ? { id: issue.project.id, key: issue.project.key, name: issue.project.name }
                : null,
              assignee: issue.assigneeId ? { id: issue.assigneeId } : null,
              untrustedText: {
                title: (issue.title || '').slice(0, 500),
                description: (issue.description || '').slice(0, 500),
              },
            })),
          }
        } catch (error) {
          console.error('[AI_TOOL] Error in listIssues:', error)
          return { success: false, error: 'Failed to list issues' }
        }
      }),
    }),

    getIssue: tool({
      description: 'Get full details of a single issue by ID. Returns title and description inside untrustedText.',
      inputSchema: z.object({
        issueId: z.string().max(100).describe('The ID of the issue'),
      }),
      execute: guard('getIssue', async ({ issueId }) => {
        try {
          const issue = await getIssueById(teamId, issueId)
          if (!issue) {
            return { success: false, error: 'Issue not found' }
          }

          return {
            success: true,
            issue: {
              id: issue.id,
              number: issue.number,
              priority: issue.priority,
              estimate: issue.estimate,
              createdAt: issue.createdAt,
              workflowState: issue.workflowState
                ? { id: issue.workflowState.id, name: issue.workflowState.name }
                : null,
              project: issue.project
                ? { id: issue.project.id, key: issue.project.key, name: issue.project.name }
                : null,
              assignee: issue.assigneeId ? { id: issue.assigneeId } : null,
              untrustedText: {
                title: (issue.title || '').slice(0, 2000),
                description: (issue.description || '').slice(0, 2000),
                comments: (issue.comments || []).map((c: any) => ({
                  id: c.id,
                  createdAt: c.createdAt,
                  untrustedText: {
                    content: (c.content || '').slice(0, 2000),
                  },
                })),
              },
            },
          }
        } catch (error) {
          console.error('[AI_TOOL] Error in getIssue:', error)
          return { success: false, error: 'Failed to get issue' }
        }
      }),
    }),

    listProjects: tool({
      description: 'List all projects for the current workspace.',
      inputSchema: z.object({}),
      execute: guard('listProjects', async () => {
        try {
          return {
            success: true,
            projects: teamContext.projects.map((p) => ({
              id: p.id,
              key: p.key,
              status: p.status,
              color: p.color,
              untrustedText: {
                name: (p.name || '').slice(0, 500),
                description: (p.description || '').slice(0, 500),
              },
            })),
          }
        } catch (error) {
          console.error('[AI_TOOL] Error in listProjects:', error)
          return { success: false, error: 'Failed to list projects' }
        }
      }),
    }),

    listProjectMembers: tool({
      description: 'List members assigned to a project by project ID or name.',
      inputSchema: z.object({
        projectId: z.string().max(100).optional().describe('The ID of the project'),
        projectName: z.string().max(200).optional().describe('The name of the project'),
      }),
      execute: guard('listProjectMembers', async ({ projectId, projectName }) => {
        try {
          let resolvedProjectId = projectId
          if (!resolvedProjectId && projectName) {
            const matched = teamContext.projects.find(
              (p) => p.name.toLowerCase() === projectName.toLowerCase()
            )
            resolvedProjectId = matched?.id
          }

          if (!resolvedProjectId) {
            return { success: false, error: 'Project not found' }
          }

          const project = await db.project.findFirst({
            where: { id: resolvedProjectId, teamId },
          })
          if (!project) {
            return { success: false, error: 'Project not found' }
          }

          const members = await db.projectMember.findMany({
            where: { projectId: resolvedProjectId },
          })

          return {
            success: true,
            members: members.map((m) => ({
              id: m.id,
              userId: m.userId,
              untrustedText: {
                userName: (m.userName || '').slice(0, 500),
                userEmail: (m.userEmail || '').slice(0, 500),
              },
            })),
          }
        } catch (error) {
          console.error('[AI_TOOL] Error in listProjectMembers:', error)
          return { success: false, error: 'Failed to list project members' }
        }
      }),
    }),

    getTeamStats: tool({
      description: 'Get summary statistics for the workspace.',
      inputSchema: z.object({}),
      execute: guard('getTeamStats', async () => {
        try {
          const [issues, projects, teamMembers] = await Promise.all([
            db.issue.count({ where: { teamId } }),
            db.project.count({ where: { teamId } }),
            db.teamMember.count({ where: { teamId } }),
          ])
          return {
            success: true,
            stats: { issues, projects, teamMembers },
          }
        } catch (error) {
          console.error('[AI_TOOL] Error in getTeamStats:', error)
          return { success: false, error: 'Failed to get team stats' }
        }
      }),
    }),

    listTeamMembers: tool({
      description: 'List members of the workspace.',
      inputSchema: z.object({}),
      execute: guard('listTeamMembers', async () => {
        try {
          return {
            success: true,
            members: teamContext.members.map((m) => ({
              userId: m.userId,
              role: m.role,
              untrustedText: {
                userName: (m.userName || '').slice(0, 500),
                userEmail: (m.userEmail || '').slice(0, 500),
              },
            })),
          }
        } catch (error) {
          console.error('[AI_TOOL] Error in listTeamMembers:', error)
          return { success: false, error: 'Failed to list team members' }
        }
      }),
    }),

    // ==========================================
    // WORK WRITE TOOLS
    // ==========================================
    createIssue: tool({
      description:
        'Create a single new issue. CRITICAL: Do NOT call if title, workflowStateId, priority, or projectId is missing.',
      inputSchema: z
        .object({
          title: z.string().max(200).nullish().describe('Title of the issue (REQUIRED)'),
          description: z.string().max(5000).nullish().describe('Description of the issue'),
          projectId: z.string().max(100).nullish().describe('Project ID, key, or name (REQUIRED)'),
          workflowStateId: z.string().max(100).nullish().describe('Workflow state ID or name (REQUIRED)'),
          assigneeId: z.string().max(100).nullish().describe('User ID or name to assign to'),
          priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).nullish().describe('Priority level (REQUIRED)'),
          estimate: z.number().nullish().describe('Story points or hours estimate'),
          labelIds: z.array(z.string().max(100)).nullish().describe('Array of label names or IDs'),
          status: z.string().max(100).nullish().optional().describe('Alias for workflowStateId'),
          project: z.string().max(100).nullish().optional().describe('Alias for projectId'),
        })
        .passthrough(),
      execute: guard('createIssue', async (params) => {
        try {
          const {
            title,
            description,
            projectId: paramProjectId,
            workflowStateId: paramWorkflowStateId,
            status,
            project,
            assigneeId,
            priority,
            estimate,
            labelIds,
          } = params

          const effectiveProjectId = paramProjectId || project
          const effectiveWorkflowStateId = paramWorkflowStateId || status

          // Check duplicate title
          const existing = await db.issue.findFirst({
            where: {
              teamId,
              title: { equals: title || '', mode: 'insensitive' },
            },
          })
          if (existing) {
            return {
              success: false,
              error: `An issue with title "${title}" already exists.`,
            }
          }

          const validation = validateIssueFields({
            title,
            workflowStateId: effectiveWorkflowStateId,
            priority,
            projectId: effectiveProjectId,
          })
          if (!validation.isValid) {
            return {
              success: false,
              error: formatValidationError(validation.missingFields, teamContext),
            }
          }

          const resolvedWorkflowStateId = resolveWorkflowState(teamContext, effectiveWorkflowStateId)
          const resolvedProject = resolveProject(teamContext, effectiveProjectId)
          const resolvedAssignee = resolveAssignee(teamContext, assigneeId)
          const resolvedLabelIds = resolveLabelIds(teamContext, labelIds)

          if (!resolvedWorkflowStateId) {
            return { success: false, error: `Workflow state "${effectiveWorkflowStateId}" not found.` }
          }
          if (!resolvedProject) {
            return { success: false, error: `Project "${effectiveProjectId}" not found.` }
          }
          if (assigneeId && !resolvedAssignee) {
            return { success: false, error: `Assignee "${assigneeId}" not found in team.` }
          }

          const issue = await createIssue(
            teamId,
            {
              title: title!.trim(),
              description: description ?? undefined,
              projectId: resolvedProject.id,
              workflowStateId: resolvedWorkflowStateId,
              assigneeId: resolvedAssignee?.userId,
              assignee: resolvedAssignee?.userName,
              priority: priority || 'none',
              estimate: estimate ?? undefined,
              labelIds: resolvedLabelIds,
            },
            actor.userId,
            actor.user.name || 'User'
          )

          return {
            success: true,
            message: `Issue "${issue.title}" created successfully as #${issue.number}`,
            issue: { id: issue.id, number: issue.number },
          }
        } catch (error) {
          console.error('[AI_TOOL] Error in createIssue:', error)
          return { success: false, error: 'Failed to create issue' }
        }
      }),
    }),

    createIssues: tool({
      description: 'Create multiple issues at once (max 10 issues per batch).',
      inputSchema: z.object({
        issues: z
          .array(
            z
              .object({
                title: z.string().max(200).nullish(),
                description: z.string().max(5000).nullish(),
                projectId: z.string().max(100).nullish(),
                workflowStateId: z.string().max(100).nullish(),
                assigneeId: z.string().max(100).optional(),
                priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).nullish(),
                estimate: z.number().optional(),
                labelIds: z.array(z.string().max(100)).optional(),
                status: z.string().max(100).nullish().optional(),
                project: z.string().max(100).nullish().optional(),
              })
              .passthrough()
          )
          .min(1)
          .max(10)
          .describe('Array of issues to create (max 10)'),
      }),
      execute: guard('createIssues', async ({ issues }) => {
        try {
          const created: any[] = []
          for (const item of issues) {
            const pId = item.projectId || item.project
            const wId = item.workflowStateId || item.status
            const resolvedProject = resolveProject(teamContext, pId)
            const resolvedState = resolveWorkflowState(teamContext, wId)
            const resolvedAssignee = resolveAssignee(teamContext, item.assigneeId)
            const resolvedLabels = resolveLabelIds(teamContext, item.labelIds)

            if (!item.title || !resolvedProject || !resolvedState) {
              continue
            }

            const iss = await createIssue(
              teamId,
              {
                title: item.title.trim(),
                description: item.description ?? undefined,
                projectId: resolvedProject.id,
                workflowStateId: resolvedState,
                assigneeId: resolvedAssignee?.userId,
                assignee: resolvedAssignee?.userName,
                priority: item.priority || 'none',
                estimate: item.estimate,
                labelIds: resolvedLabels,
              },
              actor.userId,
              actor.user.name || 'User'
            )
            created.push({ id: iss.id, number: iss.number, title: iss.title })
          }

          return {
            success: true,
            message: `Created ${created.length} issues successfully`,
            issues: created,
          }
        } catch (error) {
          console.error('[AI_TOOL] Error in createIssues:', error)
          return { success: false, error: 'Failed to create issues batch' }
        }
      }),
    }),

    updateIssue: tool({
      description: 'Update an existing issue by issue ID or title.',
      inputSchema: z.object({
        issueId: z.string().max(100).optional(),
        title: z.string().max(200).optional(),
        newTitle: z.string().max(200).optional(),
        description: z.string().max(5000).optional(),
        workflowStateId: z.string().max(100).optional(),
        assigneeId: z.string().max(100).nullish(),
        priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).nullish(),
        estimate: z.number().nullish(),
        labelIds: z.array(z.string().max(100)).nullish(),
      }),
      execute: guard('updateIssue', async (params) => {
        try {
          let targetIssue = null
          if (params.issueId) {
            targetIssue = await db.issue.findFirst({
              where: { id: params.issueId, teamId },
            })
          } else if (params.title) {
            targetIssue = await db.issue.findFirst({
              where: { title: { equals: params.title, mode: 'insensitive' }, teamId },
            })
          }

          if (!targetIssue) {
            return { success: false, error: 'Issue not found' }
          }

          const updateData: any = {}
          if (params.newTitle) updateData.title = params.newTitle.trim()
          if (params.description !== undefined) updateData.description = params.description
          if (params.priority !== undefined) updateData.priority = params.priority
          if (params.estimate !== undefined) updateData.estimate = params.estimate

          if (params.workflowStateId) {
            const resolvedState = resolveWorkflowState(teamContext, params.workflowStateId)
            if (!resolvedState) return { success: false, error: 'Workflow state not found' }
            updateData.workflowStateId = resolvedState
          }

          if (params.assigneeId !== undefined) {
            if (params.assigneeId === null) {
              updateData.assigneeId = null
              updateData.assignee = null
            } else {
              const resolvedAssignee = resolveAssignee(teamContext, params.assigneeId)
              if (!resolvedAssignee) return { success: false, error: 'Assignee not found in team' }
              updateData.assigneeId = resolvedAssignee.userId
              updateData.assignee = resolvedAssignee.userName
            }
          }

          if (params.labelIds !== undefined) {
            updateData.labelIds = resolveLabelIds(teamContext, params.labelIds)
          }

          const updated = await updateIssue(teamId, targetIssue.id, updateData)
          return {
            success: true,
            message: `Issue #${updated.number} updated successfully`,
            issue: { id: updated.id, number: updated.number },
          }
        } catch (error) {
          console.error('[AI_TOOL] Error in updateIssue:', error)
          return { success: false, error: 'Failed to update issue' }
        }
      }),
    }),

    updateIssues: tool({
      description: 'Update multiple issues at once (max 10 issues per batch).',
      inputSchema: z.object({
        updates: z
          .array(
            z.object({
              issueId: z.string().max(100).optional(),
              title: z.string().max(200).optional(),
              newTitle: z.string().max(200).optional(),
              description: z.string().max(5000).nullish(),
              workflowStateId: z.string().max(100).optional(),
              assigneeId: z.string().max(100).nullish(),
              priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).optional(),
              estimate: z.number().nullish(),
              labelIds: z.array(z.string().max(100)).optional(),
            })
          )
          .min(1)
          .max(10)
          .describe('Array of updates to execute (max 10)'),
      }),
      execute: guard('updateIssues', async ({ updates }) => {
        try {
          let count = 0
          for (const item of updates) {
            const target = item.issueId
              ? await db.issue.findFirst({ where: { id: item.issueId, teamId } })
              : item.title
              ? await db.issue.findFirst({ where: { title: { equals: item.title, mode: 'insensitive' }, teamId } })
              : null

            if (!target) continue

            const updateData: any = {}
            if (item.newTitle) updateData.title = item.newTitle.trim()
            if (item.description !== undefined) updateData.description = item.description
            if (item.priority !== undefined) updateData.priority = item.priority
            if (item.estimate !== undefined) updateData.estimate = item.estimate

            if (item.workflowStateId) {
              const state = resolveWorkflowState(teamContext, item.workflowStateId)
              if (state) updateData.workflowStateId = state
            }
            if (item.assigneeId !== undefined) {
              if (item.assigneeId === null) {
                updateData.assigneeId = null
                updateData.assignee = null
              } else {
                const assignee = resolveAssignee(teamContext, item.assigneeId)
                if (assignee) {
                  updateData.assigneeId = assignee.userId
                  updateData.assignee = assignee.userName
                }
              }
            }
            if (item.labelIds) {
              updateData.labelIds = resolveLabelIds(teamContext, item.labelIds)
            }

            await updateIssue(teamId, target.id, updateData)
            count++
          }

          return {
            success: true,
            message: `Updated ${count} issues successfully`,
          }
        } catch (error) {
          console.error('[AI_TOOL] Error in updateIssues:', error)
          return { success: false, error: 'Failed to update issues' }
        }
      }),
    }),

    createProject: tool({
      description: 'Create a new project in the workspace.',
      inputSchema: z.object({
        name: z.string().max(200).nullish().describe('The name of the project (REQUIRED)'),
        description: z.string().max(5000).optional(),
        key: z.string().min(2).max(10).nullish().describe('Project key (e.g., PRJ) (REQUIRED)'),
        color: z.string().max(50).optional(),
        icon: z.string().max(50).optional(),
        leadId: z.string().max(100).optional(),
        status: z.enum(['active', 'completed', 'canceled']).optional(),
      }),
      execute: guard('createProject', async (params) => {
        try {
          if (!params.name || !params.key) {
            return { success: false, error: 'Both project name and key are required' }
          }

          const existing = await db.project.findFirst({
            where: {
              teamId,
              OR: [
                { key: { equals: params.key.toUpperCase(), mode: 'insensitive' } },
                { name: { equals: params.name, mode: 'insensitive' } },
              ],
            },
          })
          if (existing) {
            return { success: false, error: 'A project with that key or name already exists' }
          }

          let leadName: string | undefined
          if (params.leadId) {
            const member = teamContext.members.find((m) => m.userId === params.leadId)
            if (!member) {
              return { success: false, error: 'Project lead not found in team' }
            }
            leadName = member.userName
          }

          const project = await createProject(teamId, {
            name: params.name.trim(),
            description: params.description,
            key: params.key.toUpperCase().trim(),
            color: params.color || '#3b82f6',
            icon: params.icon,
            leadId: params.leadId,
            lead: leadName,
            status: params.status || 'active',
          })

          return {
            success: true,
            message: `Project "${project.name}" (${project.key}) created successfully`,
            project: { id: project.id, key: project.key },
          }
        } catch (error) {
          console.error('[AI_TOOL] Error in createProject:', error)
          return { success: false, error: 'Failed to create project' }
        }
      }),
    }),

    createProjects: tool({
      description: 'Create multiple projects at once (max 10 projects per batch).',
      inputSchema: z.object({
        projects: z
          .array(
            z.object({
              name: z.string().max(200).nullish(),
              description: z.string().max(5000).nullish(),
              key: z.string().min(2).max(10).nullish(),
              color: z.string().max(50).optional(),
              icon: z.string().max(50).optional(),
              leadId: z.string().max(100).optional(),
              status: z.enum(['active', 'completed', 'canceled']).nullish(),
            })
          )
          .min(1)
          .max(10)
          .describe('Array of projects to create (max 10)'),
      }),
      execute: guard('createProjects', async ({ projects }) => {
        try {
          const created: any[] = []
          for (const item of projects) {
            if (!item.name || !item.key) continue
            const p = await createProject(teamId, {
              name: item.name.trim(),
              description: item.description ?? undefined,
              key: item.key.toUpperCase().trim(),
              color: item.color || '#3b82f6',
              icon: item.icon ?? undefined,
              leadId: item.leadId ?? undefined,
              status: item.status || 'active',
            })
            created.push({ id: p.id, key: p.key, name: p.name })
          }

          return {
            success: true,
            message: `Created ${created.length} projects successfully`,
            projects: created,
          }
        } catch (error) {
          console.error('[AI_TOOL] Error in createProjects:', error)
          return { success: false, error: 'Failed to create projects' }
        }
      }),
    }),

    updateProject: tool({
      description: 'Update project details by project ID or name.',
      inputSchema: z.object({
        projectId: z.string().max(100).optional(),
        name: z.string().max(200).optional(),
        newName: z.string().max(200).optional(),
        description: z.string().max(5000).optional(),
        status: z.enum(['active', 'completed', 'canceled']).optional(),
        color: z.string().max(50).optional(),
        icon: z.string().max(50).optional(),
        leadId: z.string().max(100).optional(),
      }),
      execute: guard('updateProject', async (params) => {
        try {
          const target = params.projectId
            ? await db.project.findFirst({ where: { id: params.projectId, teamId } })
            : params.name
            ? await db.project.findFirst({ where: { name: { equals: params.name, mode: 'insensitive' }, teamId } })
            : null

          if (!target) {
            return { success: false, error: 'Project not found' }
          }

          const updateData: any = {}
          if (params.newName) updateData.name = params.newName.trim()
          if (params.description !== undefined) updateData.description = params.description
          if (params.status !== undefined) updateData.status = params.status
          if (params.color !== undefined) updateData.color = params.color
          if (params.icon !== undefined) updateData.icon = params.icon
          if (params.leadId !== undefined) {
            const member = teamContext.members.find((m) => m.userId === params.leadId)
            if (!member) return { success: false, error: 'Lead not found in team' }
            updateData.leadId = member.userId
            updateData.lead = member.userName
          }

          const updated = await updateProject(teamId, target.id, updateData)
          return {
            success: true,
            message: `Project "${updated.name}" updated successfully`,
          }
        } catch (error) {
          console.error('[AI_TOOL] Error in updateProject:', error)
          return { success: false, error: 'Failed to update project' }
        }
      }),
    }),

    addProjectMember: tool({
      description: 'Add an existing team member to a project.',
      inputSchema: z.object({
        projectId: z.string().max(100).optional(),
        projectName: z.string().max(200).optional(),
        userId: z.string().max(100).optional(),
        userEmail: z.string().max(200).optional(),
        userName: z.string().max(200).optional(),
      }),
      execute: guard('addProjectMember', async ({ projectId, projectName, userId, userEmail, userName }) => {
        try {
          const project = projectId
            ? await db.project.findFirst({ where: { id: projectId, teamId } })
            : projectName
            ? await db.project.findFirst({ where: { name: { equals: projectName, mode: 'insensitive' }, teamId } })
            : null

          if (!project) {
            return { success: false, error: 'Project not found' }
          }

          const member = teamContext.members.find(
            (m) =>
              (userId && m.userId === userId) ||
              (userEmail && m.userEmail.toLowerCase() === userEmail.toLowerCase()) ||
              (userName && m.userName.toLowerCase().includes(userName.toLowerCase()))
          )

          if (!member) {
            return { success: false, error: 'Team member not found in workspace' }
          }

          const existing = await db.projectMember.findFirst({
            where: { projectId: project.id, userId: member.userId },
          })
          if (existing) {
            return { success: false, error: 'Member is already assigned to this project' }
          }

          await db.projectMember.create({
            data: {
              projectId: project.id,
              userId: member.userId,
              userName: member.userName,
              userEmail: member.userEmail,
            },
          })

          return {
            success: true,
            message: `Added "${member.userName}" to project "${project.name}" successfully`,
          }
        } catch (error) {
          console.error('[AI_TOOL] Error in addProjectMember:', error)
          return { success: false, error: 'Failed to add project member' }
        }
      }),
    }),

    // ==========================================
    // DESTRUCTIVE TOOLS (DISABLED FOR NOW)
    // Kept in allTools behind DISABLED_TOOLS check
    // ==========================================
    deleteIssue: tool({
      description: 'Delete an issue by ID or title.',
      inputSchema: z.object({
        issueId: z.string().max(100).optional(),
        title: z.string().max(200).optional(),
      }),
      execute: guard('deleteIssue', async ({ issueId, title }) => {
        try {
          const target = issueId
            ? await db.issue.findFirst({ where: { id: issueId, teamId } })
            : title
            ? await db.issue.findFirst({ where: { title: { equals: title, mode: 'insensitive' }, teamId } })
            : null

          if (!target) return { success: false, error: 'Issue not found' }
          await deleteIssue(teamId, target.id)
          return { success: true, message: `Issue #${target.number} deleted successfully` }
        } catch (error) {
          console.error('[AI_TOOL] Error in deleteIssue:', error)
          return { success: false, error: 'Failed to delete issue' }
        }
      }),
    }),

    deleteIssues: tool({
      description: 'Delete multiple issues by IDs or titles.',
      inputSchema: z.object({
        issues: z
          .array(
            z.object({
              issueId: z.string().max(100).optional(),
              title: z.string().max(200).optional(),
            })
          )
          .min(1)
          .max(10),
      }),
      execute: guard('deleteIssues', async ({ issues }) => {
        try {
          let count = 0
          for (const item of issues) {
            const target = item.issueId
              ? await db.issue.findFirst({ where: { id: item.issueId, teamId } })
              : item.title
              ? await db.issue.findFirst({ where: { title: { equals: item.title, mode: 'insensitive' }, teamId } })
              : null
            if (target) {
              await deleteIssue(teamId, target.id)
              count++
            }
          }
          return { success: true, message: `Deleted ${count} issues successfully` }
        } catch (error) {
          console.error('[AI_TOOL] Error in deleteIssues:', error)
          return { success: false, error: 'Failed to delete issues' }
        }
      }),
    }),

    deleteProject: tool({
      description: 'Delete a project by ID or name.',
      inputSchema: z.object({
        projectId: z.string().max(100).optional(),
        name: z.string().max(200).optional(),
      }),
      execute: guard('deleteProject', async ({ projectId, name }) => {
        try {
          const target = projectId
            ? await db.project.findFirst({ where: { id: projectId, teamId } })
            : name
            ? await db.project.findFirst({ where: { name: { equals: name, mode: 'insensitive' }, teamId } })
            : null

          if (!target) return { success: false, error: 'Project not found' }
          await deleteProject(teamId, target.id)
          return { success: true, message: `Project "${target.name}" deleted successfully` }
        } catch (error) {
          console.error('[AI_TOOL] Error in deleteProject:', error)
          return { success: false, error: 'Failed to delete project' }
        }
      }),
    }),

    removeProjectMember: tool({
      description: 'Remove a member from a project.',
      inputSchema: z.object({
        projectId: z.string().max(100).optional(),
        projectName: z.string().max(200).optional(),
        userId: z.string().max(100).optional(),
        userEmail: z.string().max(200).optional(),
        userName: z.string().max(200).optional(),
      }),
      execute: guard('removeProjectMember', async ({ projectId, projectName, userId, userEmail, userName }) => {
        try {
          const project = projectId
            ? await db.project.findFirst({ where: { id: projectId, teamId } })
            : projectName
            ? await db.project.findFirst({ where: { name: { equals: projectName, mode: 'insensitive' }, teamId } })
            : null

          if (!project) return { success: false, error: 'Project not found' }

          const member = teamContext.members.find(
            (m) =>
              (userId && m.userId === userId) ||
              (userEmail && m.userEmail.toLowerCase() === userEmail.toLowerCase()) ||
              (userName && m.userName.toLowerCase().includes(userName.toLowerCase()))
          )

          if (!member) return { success: false, error: 'Member not found in team' }

          const existing = await db.projectMember.findFirst({
            where: { projectId: project.id, userId: member.userId },
          })
          if (!existing) return { success: false, error: 'User is not a member of this project' }

          await db.projectMember.delete({ where: { id: existing.id } })
          return { success: true, message: `Removed "${member.userName}" from project "${project.name}"` }
        } catch (error) {
          console.error('[AI_TOOL] Error in removeProjectMember:', error)
          return { success: false, error: 'Failed to remove project member' }
        }
      }),
    }),
  }

  // Build offered toolset passed to the model
  const offeredNames = allowedToolNames(actor.access)
  const offeredTools: Record<string, any> = {}
  for (const name of offeredNames) {
    if ((allTools as Record<string, any>)[name]) {
      offeredTools[name] = (allTools as Record<string, any>)[name]
    }
  }

  return { allTools, offeredTools }
}
