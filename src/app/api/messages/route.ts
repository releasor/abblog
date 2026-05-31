import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/api-utils";

export async function GET() {
  try {
    const messages = await prisma.message.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        content: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    });

    return NextResponse.json(
      messages.map((m) => ({
        id: m.id,
        name: m.user?.name || m.name,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch (e) {
    console.error("[Messages] Failed to list messages:", e);
    return NextResponse.json({ error: "获取留言列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);
    const ip = getClientIp(request);
    const rl = checkRateLimit(`message:${userId || ip}`, RATE_LIMITS.comment);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "留言太频繁，请稍后再试" },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    const { content } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "请输入留言内容" }, { status: 400 });
    }

    if (content.length > 500) {
      return NextResponse.json({ error: "留言不能超过500字" }, { status: 400 });
    }

    const rawName = session?.user?.name || (typeof body.name === "string" ? body.name.trim() : "") || "匿名用户";
    const name = rawName.slice(0, 50);

    const message = await prisma.message.create({
      data: {
        content: content.trim(),
        name: name,
        userId,
      },
    });

    return NextResponse.json(
      {
        id: message.id,
        name,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Messages] Failed to create message:", error);
    return NextResponse.json({ error: "发送失败，请稍后重试" }, { status: 500 });
  }
}
