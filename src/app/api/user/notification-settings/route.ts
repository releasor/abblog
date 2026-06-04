import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";
import { CACHE_PRIVATE_MAX_AGE_MEDIUM, CACHE_PRIVATE_STALE_MEDIUM } from "@/lib/constants";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { emailNotifications: true },
    });

    if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

    return NextResponse.json({ emailNotifications: user.emailNotifications }, { headers: { "Cache-Control": `private, max-age=${CACHE_PRIVATE_MAX_AGE_MEDIUM}, stale-while-revalidate=${CACHE_PRIVATE_STALE_MEDIUM}` } });
  } catch (e) {
    console.error("[NotificationSettings] Failed to fetch:", e);
    return NextResponse.json({ error: "获取通知设置失败" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const rl = checkRateLimit(`notification-settings:${userId}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    const { emailNotifications } = body;

    await prisma.user.update({
      where: { id: userId },
      data: { emailNotifications: Boolean(emailNotifications) },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[NotificationSettings] Failed to update:", e);
    return NextResponse.json({ error: "更新通知设置失败" }, { status: 500 });
  }
}
