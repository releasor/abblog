import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = getAuthUserId(session);

  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
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
  const session = await getServerSession(authOptions);
  const userId = getAuthUserId(session);

  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const { targetUserId } = await request.json();
    const tid = parseInt(targetUserId);
    if (isNaN(tid)) return NextResponse.json({ error: "无效的用户ID" }, { status: 400 });

    if (userId === tid) {
      return NextResponse.json({ error: "不能给自己发私信" }, { status: 400 });
    }

    // Check if conversation already exists between these two users
    const existingMemberships = await prisma.conversationMember.findMany({
      where: { userId: { in: [userId, tid] } },
      include: { conversation: { include: { members: true } } },
    });

    const existingConv = existingMemberships.find((m) => {
      const memberIds = m.conversation.members.map((mem) => mem.userId);
      return memberIds.includes(userId) && memberIds.includes(tid) && memberIds.length === 2;
    });

    if (existingConv) {
      return NextResponse.json({ id: existingConv.conversation.id });
    }

    const conversation = await prisma.conversation.create({
      data: {
        members: {
          create: [{ userId }, { userId: tid }],
        },
      },
    });

    return NextResponse.json({ id: conversation.id });
  } catch (e) {
    console.error("[Conversations] Failed to create conversation:", e);
    return NextResponse.json({ error: "创建会话失败" }, { status: 500 });
  }
}
