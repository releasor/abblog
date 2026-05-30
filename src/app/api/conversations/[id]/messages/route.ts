import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";
import { requireId, invalidIdResponse } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let conversationId: number;
    try { conversationId = requireId(id); } catch { return invalidIdResponse(); }

    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);

    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    // Verify user is a member
    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });

    if (!membership) {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const before = searchParams.get("before");
    const beforeId = before ? parseInt(before) : undefined;
    if (before && isNaN(beforeId!)) return NextResponse.json({ error: "无效的分页参数" }, { status: 400 });
    const limit = 30;

    const messages = await prisma.directMessage.findMany({
      where: {
        conversationId,
        ...(beforeId ? { id: { lt: beforeId } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { sender: { select: { id: true, name: true, avatar: true } } },
    });

    // Update last read
    await prisma.conversationMember.update({
      where: { id: membership.id },
      data: { lastReadAt: new Date() },
    });

    return NextResponse.json(messages.reverse(), { headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=20" } });
  } catch (e) {
    console.error("[Messages] Failed to fetch messages:", e);
    return NextResponse.json({ error: "获取消息列表失败" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let conversationId: number;
    try { conversationId = requireId(id); } catch { return invalidIdResponse(); }

    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);

    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });

    if (!membership) {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const rl = checkRateLimit(`dm:${userId}`, RATE_LIMITS.comment);
    if (!rl.allowed) {
      return NextResponse.json({ error: "发送太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    const { content } = body;
    if (!content?.trim()) {
      return NextResponse.json({ error: "消息不能为空" }, { status: 400 });
    }

    const message = await prisma.directMessage.create({
      data: {
        conversationId,
        senderId: userId,
        content: content.trim(),
      },
      include: { sender: { select: { id: true, name: true, avatar: true } } },
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Notify other members
    const otherMembers = await prisma.conversationMember.findMany({
      where: { conversationId, userId: { not: userId } },
    });

    const senderName = session?.user?.name || "有人";

    await Promise.all(
      otherMembers.map((member) =>
        prisma.notification.create({
          data: {
            userId: member.userId,
            type: "DIRECT_MESSAGE",
            message: `${senderName}发来了一条消息`,
            link: `/messages/${conversationId}`,
          },
        })
      )
    );

    return NextResponse.json(message);
  } catch (e) {
    console.error("[Messages] Failed to send message:", e);
    return NextResponse.json({ error: "发送消息失败" }, { status: 500 });
  }
}
