import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth-server-helpers'
import { getChatConversation, deleteChatConversation } from '@/lib/api/chat'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; conversationId: string }> }
) {
  try {
    const { conversationId } = await params
    const userId = await getUserId()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const conversation = await getChatConversation(conversationId)

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Verify user has access to this conversation
    if (conversation.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    return NextResponse.json(conversation)
  } catch (error) {
    console.error('Error fetching conversation:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; conversationId: string }> }
) {
  try {
    const { conversationId } = await params
    const userId = await getUserId()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const conversation = await getChatConversation(conversationId)

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Verify user has access to this conversation
    if (conversation.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    await deleteChatConversation(conversationId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting conversation:', error)
    return NextResponse.json(
      { error: 'Failed to delete conversation' },
      { status: 500 }
    )
  }
}
