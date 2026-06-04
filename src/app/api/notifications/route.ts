import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireId, invalidIdResponse } from "@/lib/api-utils";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";
import { CACHE_PRIVATE_MAX_AGE_SHORT, CACHE_PRIVATE_STALE_SHORT } from "@/lib/constants";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);

    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, type: true, message: true, link: true, isRead: true, createdAt: true },
      }),
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return NextResponse.json({ notifications, unreadCount }, { headers: { "Cache-Control": `private, max-age=${CACHE_PRIVATE_MAX_AGE_SHORT}, stale-while-revalidate=${CACHE_PRIVATE_STALE_SHORT}` } });
  } catch (e) {
    console.error("[Notifications] Failed to fetch notifications:", e);
    return NextResponse.json({ error: "获取通知列表失败" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);

    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const rl = checkRateLimit(`notification:${userId}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    let id: string | undefined;
    try {
      const body = await request.json();
      id = body.id;
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }

    if (id) {
      let idNum: number;
      try { idNum = requireId(id); } catch { return invalidIdResponse(); }
      await prisma.notification.updateMany({
        where: { id: idNum, userId },
        data: { isRead: true },
      });
    } else {
      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[Notifications] Failed to update notifications:", e);
    return NextResponse.json({ error: "更新通知状态失败" }, { status: 500 });
  }
}
