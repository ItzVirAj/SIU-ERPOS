import { NextRequest, NextResponse } from "next/server";
import { getSessionOrNull, isTeamMember } from "@/lib/auth-server-helpers";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; channelId: string }> }
) {
  try {
    const session = await getSessionOrNull();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId, channelId } = await params;
    const userId = session.user.id;

    // Security check: Only team members
    const isMember = await isTeamMember(teamId, userId);
    if (!isMember) {
      return NextResponse.json(
        { error: "Access denied. Only team members can read channel messages." },
        { status: 403 }
      );
    }

    // Verify channel belongs to this team
    const channel = await db.teamChannel.findFirst({
      where: { id: channelId, teamId },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found in this team" }, { status: 404 });
    }

    // Fetch messages (excluding replies from top-level list, or including parent)
    const messages = await db.teamChatMessage.findMany({
      where: {
        channelId,
        parentId: null, // Top-level messages
      },
      include: {
        reactions: true,
        replies: {
          include: {
            reactions: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    // If any messages reference tasks, enrich them with issue details
    const taskIds = messages
      .map((m) => m.referencedTaskId)
      .filter((id): id is string => Boolean(id));

    let referencedIssues: Record<string, any> = {};
    if (taskIds.length > 0) {
      const issues = await db.issue.findMany({
        where: { id: { in: taskIds } },
        select: {
          id: true,
          title: true,
          number: true,
          priority: true,
          workflowState: { select: { name: true, color: true } },
          assignee: true,
        },
      });
      referencedIssues = Object.fromEntries(issues.map((i) => [i.id, i]));
    }

    const enrichedMessages = messages.map((m) => ({
      ...m,
      referencedTask: m.referencedTaskId ? referencedIssues[m.referencedTaskId] || null : null,
    }));

    // Update user's lastReadAt for this channel
    await db.teamChannelMember.upsert({
      where: {
        channelId_userId: { channelId, userId },
      },
      update: {
        lastReadAt: new Date(),
      },
      create: {
        channelId,
        userId,
        userEmail: session.user.email || "",
        userName: session.user.name || "Member",
        lastReadAt: new Date(),
      },
    });

    return NextResponse.json(enrichedMessages);
  } catch (error) {
    console.error("Error fetching channel messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; channelId: string }> }
) {
  try {
    const session = await getSessionOrNull();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId, channelId } = await params;
    const userId = session.user.id;
    const userEmail = session.user.email || "";
    const userName = session.user.name || "Member";
    const userAvatar = session.user.image || null;

    const isMember = await isTeamMember(teamId, userId);
    if (!isMember) {
      return NextResponse.json(
        { error: "Access denied. Only team members can post messages." },
        { status: 403 }
      );
    }

    const channel = await db.teamChannel.findFirst({
      where: { id: channelId, teamId },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found in this team" }, { status: 404 });
    }

    const body = await request.json();
    const {
      content,
      attachments = null,
      referencedTaskId = null,
      isHuddle = false,
      huddleUrl = null,
      parentId = null,
    } = body;

    if (!content && !isHuddle && !attachments) {
      return NextResponse.json({ error: "Message content cannot be empty" }, { status: 400 });
    }

    // Extract @mentions from text if any
    const mentionRegex = /@([a-zA-Z0-9._-]+)/g;
    const matchedUsernames: string[] = [];
    let match;
    while ((match = mentionRegex.exec(content || "")) !== null) {
      matchedUsernames.push(match[1]);
    }

    // Create the chat message
    const message = await db.teamChatMessage.create({
      data: {
        channelId,
        senderId: userId,
        senderName: userName,
        senderEmail: userEmail,
        senderAvatar: userAvatar,
        content: content || (isHuddle ? "Started a quick Google Meet huddle" : ""),
        attachments,
        referencedTaskId,
        isHuddle: Boolean(isHuddle),
        huddleUrl,
        parentId,
      },
      include: {
        reactions: true,
      },
    });

    // Notify mentioned members in their personal Inbox
    if (matchedUsernames.length > 0) {
      const teamMembers = await db.teamMember.findMany({
        where: { teamId },
      });

      const mentionedMembers = teamMembers.filter((m) =>
        matchedUsernames.some(
          (u) =>
            m.userName.toLowerCase().includes(u.toLowerCase()) ||
            m.userEmail.toLowerCase().includes(u.toLowerCase())
        )
      );

      for (const mentioned of mentionedMembers) {
        if (mentioned.userId !== userId) {
          await db.inboxMessage.create({
            data: {
              userId: mentioned.userId,
              senderId: userId,
              senderName: userName,
              senderEmail: userEmail,
              senderAvatar: userAvatar,
              subject: `@${userName} mentioned you in #${channel.name}`,
              snippet: content.slice(0, 120),
              content: content,
              category: "mention",
              entityType: "chat",
              entityId: message.id,
              entityUrl: `/dashboard/team?tab=chat&channel=${channel.id}`,
              teamId,
            },
          });
        }
      }
    }

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error("Error creating channel message:", error);
    return NextResponse.json(
      { error: "Failed to post message" },
      { status: 500 }
    );
  }
}
