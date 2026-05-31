import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireId, invalidIdResponse } from "@/lib/api-utils";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);

    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    const memberships = await prisma.conversationMember.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            members: {
              where: { userId: { not: userId } },
              include: {
                user: { select: { id: true, name: true, username: true, avatar: true } },
              },
            },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: { sender: { select: { id: true, name: true } } },
            },
          },
        },
      },
      orderBy: { conversation: { updatedAt: "desc" } },
    });

    const conversations = memberships.map((m) => ({
      id: m.conversation.id,
      otherUser: m.conversation.members[0]?.user || null,
      lastMessage: m.conversation.messages[0] || null,
      updatedAt: m.conversation.updatedAt,
      lastReadAt: m.lastReadAt,
    }));

    return NextResponse.json(conversations, { headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=10" } });
  } catch (e) {
    console.error("[Conversations] Failed to list conversations:", e);
    return NextResponse.json({ error: "获取会话列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let userId = 0;
  let tid: number = 0;
  try {
    const session = await getServerSession(authOptions);
    userId = getAuthUserId(session) ?? 0;

    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const rl = checkRateLimit(`conversation:${userId}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    let targetUserId: string;
    try {
      const body = await request.json();
      targetUserId = body.targetUserId;
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    try { tid = requireId(targetUserId); } catch { return invalidIdResponse(); }


    if (userId === tid) {
      return NextResponse.json({ error: "不能给自己发私信" }, { status: 400 });
    }

    // Check if conversation already exists between these two users
    const existingConv = await prisma.conversation.findFirst({
      where: {
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: tid } } },
          { members: { every: { userId: { in: [userId, tid] } } } },
        ],
      },
      select: { id: true },
    });

    if (existingConv) {
      return NextResponse.json({ id: existingConv.id });
    }

    const conversation = await prisma.conversation.create({
      data: {
        members: {
          create: [{ userId }, { userId: tid }],
        },
      },
    });

    return NextResponse.json({ id: conversation.id });
  } catch (e: unknown) {
    // Handle race condition: if another request created the same conversation concurrently
    if ((e as { code?: string }).code === "P2002" && userId) {
      const retryConv = await prisma.conversation.findFirst({
        where: {
          AND: [
            { members: { some: { userId } } },
            { members: { some: { userId: tid } } },
            { members: { every: { userId: { in: [userId, tid] } } } },
          ],
        },
        select: { id: true },
      });
      if (retryConv) return NextResponse.json({ id: retryConv.id });
    }
    console.error("[Conversations] Failed to create conversation:", e);
    return NextResponse.json({ error: "创建会话失败" }, { status: 500 });
  }
}
