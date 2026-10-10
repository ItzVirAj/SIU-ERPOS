import { NextRequest, NextResponse } from "next/server";
import { requireAccess, handleRouteError } from "@/lib/authz";
import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAccess(AppModule.COLLAB, AccessLevel.VIEW);
    const userId = actor.session.user.id;
    const count = await db.inboxMessage.count({
      where: {
        userId,
        read: false,
        archived: false,
      },
    });

    return NextResponse.json({ count });
  } catch (error) {
    return handleRouteError(error);
  }
}
