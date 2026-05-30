import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    return NextResponse.json({ emailNotifications: user.emailNotifications }, { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } });
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
