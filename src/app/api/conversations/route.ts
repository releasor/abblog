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

  const memberships = await prisma.conversationMember.findMany({
    where: { userId: parseInt(userId) },
    include: {
      conversation: {
        include: {
          members: {
            where: { userId: { not: parseInt(userId) } },
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

  return NextResponse.json(conversations);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { targetUserId } = await request.json();
  const uid = parseInt(userId);
  const tid = parseInt(targetUserId);

  if (uid === tid) {
    return NextResponse.json({ error: "不能给自己发私信" }, { status: 400 });
  }

  // Check if conversation already exists between these two users
  const existingMemberships = await prisma.conversationMember.findMany({
    where: { userId: { in: [uid, tid] } },
    include: { conversation: { include: { members: true } } },
  });

  const existingConv = existingMemberships.find((m) => {
    const memberIds = m.conversation.members.map((mem) => mem.userId);
    return memberIds.includes(uid) && memberIds.includes(tid) && memberIds.length === 2;
  });

  if (existingConv) {
    return NextResponse.json({ id: existingConv.conversation.id });
  }

  const conversation = await prisma.conversation.create({
    data: {
      members: {
        create: [{ userId: uid }, { userId: tid }],
      },
    },
  });

  return NextResponse.json({ id: conversation.id });
}
