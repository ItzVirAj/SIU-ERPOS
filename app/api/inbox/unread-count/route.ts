import { NextRequest, NextResponse } from "next/server";
import { getSessionOrNull } from "@/lib/auth-server-helpers";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionOrNull();
    if (!session?.user?.id) {
      return NextResponse.json({ count: 0 });
    }

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
    console.error("Error fetching unread inbox count:", error);
    return NextResponse.json({ count: 0 });
  }
}
