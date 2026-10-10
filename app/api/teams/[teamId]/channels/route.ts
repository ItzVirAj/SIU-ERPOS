import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError, HttpError } from "@/lib/authz";
import { db } from "@/lib/db";

const createChannelSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isPrivate: z.boolean().optional(),
  type: z.string().default("channel"),
}).strict();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const { user } = await requireTeamAccess(teamId, { module: AppModule.COLLAB, level: AccessLevel.VIEW });
    const userId = user.id;
    const userEmail = user.email || "";
    const userName = user.name || "Member";

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
              content: "Welcome to the team channel! Use this space for discussions, updates, and async work.",
              senderId: userId,
              senderName: userName,
              senderEmail: userEmail,
            },
          },
        },
      });

      // Also create announcement channel
      await db.teamChannel.create({
        data: {
          name: "announcements",
          description: "Important leadership broadcasts & updates",
          type: "announcements",
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

      // Also create channels for existing projects
      const projects = await db.project.findMany({
        where: { teamId },
        take: 3,
      });

      for (const proj of projects) {
        await db.teamChannel.create({
          data: {
            name: `proj-${proj.key.toLowerCase()}`,
            description: `Channel dedicated to project ${proj.name}`,
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
    return handleRouteError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const { user } = await requireTeamAccess(teamId, { module: AppModule.COLLAB, level: AccessLevel.WRITE });
    const userId = user.id;
    const userEmail = user.email || "";
    const userName = user.name || "Member";

    const rawBody = await request.json();
    const { name, description, isPrivate, type } = createChannelSchema.parse(rawBody);

    const sanitizedSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!sanitizedSlug) {
      throw new HttpError(400, "Invalid channel name");
    }

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
      throw new HttpError(409, "A channel with this name already exists in this team");
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
    return handleRouteError(error);
  }
}
