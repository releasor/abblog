import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: parseInt(userId) },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.notification.count({
        where: { userId: parseInt(userId), isRead: false },
      }),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (e) {
    console.error("[Notifications] Failed to fetch notifications:", e);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const { id } = await request.json();

    if (id) {
      await prisma.notification.update({
        where: { id },
        data: { isRead: true },
      });
    } else {
      await prisma.notification.updateMany({
        where: { userId: parseInt(userId), isRead: false },
        data: { isRead: true },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[Notifications] Failed to update notifications:", e);
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
  }
}
