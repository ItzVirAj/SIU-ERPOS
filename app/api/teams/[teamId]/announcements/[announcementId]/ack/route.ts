import { NextRequest, NextResponse } from "next/server";
import { getSessionOrNull, isTeamMember } from "@/lib/auth-server-helpers";
import { db } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; announcementId: string }> }
) {
  try {
    const session = await getSessionOrNull();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId, announcementId } = await params;
    const userId = session.user.id;
    const userName = session.user.name || "Member";

    const isMember = await isTeamMember(teamId, userId);
    if (!isMember) {
      return NextResponse.json(
        { error: "Access denied. Only team members can acknowledge." },
        { status: 403 }
      );
    }

    const ack = await db.teamAnnouncementAck.upsert({
      where: {
        announcementId_userId: {
          announcementId,
          userId,
        },
      },
      update: {
        acknowledgedAt: new Date(),
      },
      create: {
        announcementId,
        userId,
        userName,
        acknowledgedAt: new Date(),
      },
    });

    return NextResponse.json(ack);
  } catch (error) {
    console.error("Error acknowledging announcement:", error);
    return NextResponse.json(
      { error: "Failed to acknowledge announcement" },
      { status: 500 }
    );
  }
}
