import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const conversationId = parseInt(id);
  if (isNaN(conversationId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  // Verify user is a member
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: parseInt(userId) } },
  });

  if (!membership) {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const before = searchParams.get("before");
  const beforeId = before ? parseInt(before) : undefined;
  if (before && isNaN(beforeId!)) return NextResponse.json({ error: "Invalid before parameter" }, { status: 400 });
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

  return NextResponse.json(messages.reverse());
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const conversationId = parseInt(id);
  if (isNaN(conversationId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: parseInt(userId) } },
  });

  if (!membership) {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  const { content } = await request.json();
  if (!content?.trim()) {
    return NextResponse.json({ error: "消息不能为空" }, { status: 400 });
  }

  const message = await prisma.directMessage.create({
    data: {
      conversationId,
      senderId: parseInt(userId),
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
    where: { conversationId, userId: { not: parseInt(userId) } },
  });

  const senderName = session?.user?.name || "有人";

  for (const member of otherMembers) {
    await prisma.notification.create({
      data: {
        userId: member.userId,
        type: "DIRECT_MESSAGE",
        message: `${senderName}发来了一条消息`,
        link: `/messages/${conversationId}`,
      },
    });
  }

  return NextResponse.json(message);
}
