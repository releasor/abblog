import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);

    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        aiApiKey: true,
        aiApiUrl: true,
        aiModel: true,
      },
    });

    return NextResponse.json({
      aiApiKey: user?.aiApiKey || "",
      aiApiUrl: user?.aiApiUrl || "",
      aiModel: user?.aiModel || "",
    }, { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } });
  } catch (e) {
    console.error("AI settings GET error:", e);
    return NextResponse.json({ error: "读取AI设置失败" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);

    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const rl = checkRateLimit(`ai-settings:${userId}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    const { aiApiKey, aiApiUrl, aiModel } = body;

    await prisma.user.update({
      where: { id: userId },
      data: {
        aiApiKey: aiApiKey || null,
        aiApiUrl: aiApiUrl || null,
        aiModel: aiModel || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("AI settings PATCH error:", e);
    return NextResponse.json({ error: "保存AI设置失败" }, { status: 500 });
  }
}
