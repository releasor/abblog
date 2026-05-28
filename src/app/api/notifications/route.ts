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

  const notifications = await prisma.notification.findMany({
    where: { userId: parseInt(userId) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = await prisma.notification.count({
    where: { userId: parseInt(userId), isRead: false },
  });

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

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
}
