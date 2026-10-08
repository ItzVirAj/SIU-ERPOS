import { NextRequest, NextResponse } from "next/server";
import { getSessionOrNull, isTeamMember } from "@/lib/auth-server-helpers";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getSessionOrNull();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;
    const userId = session.user.id;
    const userEmail = session.user.email || "";
    const userName = session.user.name || "Member";

    // Strictly enforce: ONLY assigned members of this team can access team chat
    const isMember = await isTeamMember(teamId, userId);
    if (!isMember) {
      return NextResponse.json(
        { error: "Access denied. You are not an assigned member of this team." },
        { status: 403 }
      );
    }

    // Check if team has default channels; if not, initialize them
    const existingChannels = await db.teamChannel.findMany({
      where: { teamId },
      include: {
        members: {
          where: { userId },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    if (existingChannels.length === 0) {
      // Auto-provision default general channel
      const general = await db.teamChannel.create({
        data: {
          name: "general",
          description: "Company-wide and general team discussion",
          type: "channel",
          teamId,
          createdBy: userId,
          members: {
            create: {
              userId,
              userEmail,
              userName,
            },
          },
          messages: {
            create: {
              senderId: userId,
              senderName: userName,
              senderEmail: userEmail,
              content: "👋 Welcome to the team chat! This space is reserved for active members of this team.",
            },
          },
        },
      });

      // Auto-provision announcements channel
      await db.teamChannel.create({
        data: {
          name: "announcements",
          description: "Important company and team updates",
          type: "channel",
          teamId,
          createdBy: userId,
          members: {
            create: {
              userId,
              userEmail,
              userName,
            },
          },
        },
      });

      // Fetch the newly created channels
      const newChannels = await db.teamChannel.findMany({
        where: { teamId },
        include: {
          members: {
            where: { userId },
          },
          _count: {
            select: { messages: true },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      return NextResponse.json(newChannels);
    }

    // Auto-sync project channels if any project doesn't have a channel
    const projects = await db.project.findMany({
      where: { teamId },
      select: { id: true, name: true, key: true },
    });

    for (const proj of projects) {
      const projChannelName = `proj-${proj.key.toLowerCase()}`;
      const channelExists = existingChannels.some((c) => c.name === projChannelName);
      if (!channelExists) {
        await db.teamChannel.create({
          data: {
            name: projChannelName,
            description: `Discussion for project ${proj.name}`,
            type: "project",
            teamId,
            projectId: proj.id,
            createdBy: userId,
            members: {
              create: {
                userId,
                userEmail,
                userName,
              },
            },
          },
        });
      }
    }

    // Fetch refreshed channels with unread count calculation
    const channels = await db.teamChannel.findMany({
      where: { teamId },
      include: {
        members: {
          where: { userId },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Ensure current user is in TeamChannelMember for each channel
    for (const channel of channels) {
      if (channel.members.length === 0) {
        await db.teamChannelMember.create({
          data: {
            channelId: channel.id,
            userId,
            userEmail,
            userName,
          },
        });
      }
    }

    return NextResponse.json(channels);
  } catch (error) {
    console.error("Error fetching team channels:", error);
    return NextResponse.json(
      { error: "Failed to fetch channels" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getSessionOrNull();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;
    const userId = session.user.id;
    const userEmail = session.user.email || "";
    const userName = session.user.name || "Member";

    const isMember = await isTeamMember(teamId, userId);
    if (!isMember) {
      return NextResponse.json(
        { error: "Access denied. Only team members can create channels." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, isPrivate, type = "channel" } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Channel name is required" }, { status: 400 });
    }

    const sanitizedSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/^-+|-+$/g, "");

    // Check if channel already exists in this team
    const existing = await db.teamChannel.findUnique({
      where: {
        teamId_name: {
          teamId,
          name: sanitizedSlug,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A channel with this name already exists in this team" },
        { status: 409 }
      );
    }

    const channel = await db.teamChannel.create({
      data: {
        name: sanitizedSlug,
        description,
        isPrivate: Boolean(isPrivate),
        type,
        teamId,
        createdBy: userId,
        members: {
          create: {
            userId,
            userEmail,
            userName,
          },
        },
      },
    });

    return NextResponse.json(channel, { status: 201 });
  } catch (error) {
    console.error("Error creating channel:", error);
    return NextResponse.json(
      { error: "Failed to create channel" },
      { status: 500 }
    );
  }
}
