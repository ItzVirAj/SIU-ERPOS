import { NextRequest, NextResponse } from "next/server";
import { requireSession, handleRouteError } from "@/lib/authz";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const userId = session.user.id;
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
