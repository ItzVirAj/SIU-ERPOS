import { db } from '@/lib/db'
import { TeamContext, CreateChatConversationData, SaveChatMessagesData } from '@/lib/types/chat'
import { getSystemPrompt } from '@/lib/prompts/assistant-prompt'
import { encryptSecret, decryptSecret } from '@/lib/secrets'

export async function getTeamContext(teamId: string): Promise<TeamContext> {
  // Fetch all team-related data in parallel for efficiency
  const [projects, workflowStates, labels, activeEmployees] = await Promise.all([
    db.project.findMany({
      where: { teamId },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { issues: true },
        },
      },
    }),
    db.workflowState.findMany({
      where: { teamId },
      orderBy: { position: 'asc' },
    }),
    db.label.findMany({
      where: { teamId },
      orderBy: { name: 'asc' },
    }),
    db.employee.findMany({
      where: { teamId, status: 'ACTIVE' },
      select: {
        userId: true,
        fullName: true,
        email: true,
        role: {
          select: {
            legacyTeamRole: true,
          },
        },
      },
      orderBy: { fullName: 'asc' },
    }),
  ])

  let members = activeEmployees.map((e) => ({
    userId: e.userId,
    userName: e.fullName,
    userEmail: e.email,
    role: e.role.legacyTeamRole,
  }))

  if (members.length === 0) {
    const fallbackMembers = await db.teamMember.findMany({
      where: { teamId },
      select: {
        userId: true,
        userName: true,
        userEmail: true,
        role: true,
      },
    })
    members = fallbackMembers.map((m) => ({
      userId: m.userId,
      userName: m.userName,
      userEmail: m.userEmail,
      role: m.role,
    }))
  }

  return {
    projects,
    workflowStates,
    labels,
    members,
  }
}

export function formatTeamContextForAI(context: TeamContext): string {
  const systemPrompt = getSystemPrompt(context)
  return systemPrompt
}

export async function createChatConversation(data: CreateChatConversationData) {
  return await db.chatConversation.create({
    data,
  })
}

export async function saveChatMessages(data: SaveChatMessagesData) {
  // Delete existing messages for this conversation (we'll replace them all)
  await db.chatMessage.deleteMany({
    where: { conversationId: data.conversationId },
  })

  // Insert new messages
  return await db.chatMessage.createMany({
    data: data.messages.map((msg) => ({
      conversationId: data.conversationId,
      role: msg.role,
      content: msg.content,
      toolCalls: msg.toolCalls ? JSON.parse(JSON.stringify(msg.toolCalls)) : null,
    })),
  })
}

export async function getChatConversation(conversationId: string) {
  return await db.chatConversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })
}

export async function getChatConversations(teamId: string, userId: string) {
  return await db.chatConversation.findMany({
    where: { teamId, userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: {
        select: { messages: true },
      },
    },
  })
}

export async function deleteChatConversation(conversationId: string) {
  return await db.chatConversation.delete({
    where: { id: conversationId },
  })
}

export function generateConversationTitle(firstMessage: string): string {
  // Limit title to 50 characters, clean up the text
  let title = firstMessage.trim().slice(0, 50)
  
  // If truncated, add ellipsis (but make sure we don't exceed 50)
  if (firstMessage.length > 50) {
    title = title.slice(0, 47) + '...'
  }
  
  return title
}

export async function updateConversationTitle(conversationId: string, title: string) {
  return await db.chatConversation.update({
    where: { id: conversationId },
    data: { title, updatedAt: new Date() },
  })
}

export async function getTeamSettings(teamId: string) {
  const team = await db.team.findUnique({
    where: { id: teamId },
    select: {
      groqApiKey: true,
    },
  })

  let last4: string | null = null
  if (team?.groqApiKey) {
    try {
      const decrypted = decryptSecret(team.groqApiKey)
      last4 = decrypted.length >= 4 ? decrypted.slice(-4) : decrypted
    } catch {
      last4 = null
    }
  }

  return {
    hasKey: !!team?.groqApiKey,
    last4,
  }
}

export async function updateTeamSettings(teamId: string, settings: { groqApiKey?: string | null }) {
  const data: { groqApiKey?: string | null } = { ...settings }
  if (data.groqApiKey) {
    data.groqApiKey = encryptSecret(data.groqApiKey)
  }
  return await db.team.update({
    where: { id: teamId },
    data,
  })
}
