import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from "next/server";
import { handleRouteError, HttpError } from "@/lib/authz";
import { db } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; announcementId: string }> }
) {
  try {
    const { teamId, announcementId } = await params;
    const { user } = await requireTeamAccess(teamId, { module: AppModule.COLLAB, level: AccessLevel.WRITE });

    const announcement = await db.teamAnnouncement.findFirst({
      where: { id: announcementId, teamId },
    });
    if (!announcement) {
      throw new HttpError(404, "Announcement not found");
    }

    const ack = await db.teamAnnouncementAck.upsert({
      where: {
        announcementId_userId: {
          announcementId,
          userId: user.id,
        },
      },
      update: {
        acknowledgedAt: new Date(),
      },
      create: {
        announcementId,
        userId: user.id,
        userName: user.name || "Member",
        acknowledgedAt: new Date(),
      },
    });

    return NextResponse.json(ack);
  } catch (error) {
    return handleRouteError(error);
  }
}
