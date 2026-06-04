import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireId, invalidIdResponse } from "@/lib/api-utils";
import { CACHE_PRIVATE_MAX_AGE_MEDIUM, CACHE_PRIVATE_STALE_MEDIUM } from "@/lib/constants";

export async function GET(
  _request: NextRequest,
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
      select: { id: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        members: {
          where: { userId: { not: userId } },
          select: {
            user: { select: { id: true, name: true, username: true, avatar: true } },
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "会话不存在" }, { status: 404 });
    }

    return NextResponse.json(
      { otherUser: conversation.members[0]?.user || null },
      { headers: { "Cache-Control": `private, max-age=${CACHE_PRIVATE_MAX_AGE_MEDIUM}, stale-while-revalidate=${CACHE_PRIVATE_STALE_MEDIUM}` } }
    );
  } catch (e) {
    console.error("[Conversation] Failed to fetch conversation:", e);
    return NextResponse.json({ error: "获取会话信息失败" }, { status: 500 });
  }
}
