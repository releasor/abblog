import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createActivity } from "@/lib/activity";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";
import { requireId, invalidIdResponse } from "@/lib/api-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let postId: number;
    try { postId = requireId(id); } catch { return invalidIdResponse(); }

    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);

    const likeCount = await prisma.like.count({ where: { postId } });
    let isLiked = false;

    if (userId) {
      const existing = await prisma.like.findUnique({
        where: { postId_userId: { postId, userId } },
      });
      isLiked = !!existing;
    }

    return NextResponse.json({ count: likeCount, isLiked }, { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } });
  } catch (e) {
    console.error("[Like] Failed to fetch like status:", e);
    return NextResponse.json({ error: "获取点赞状态失败" }, { status: 500 });
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let postId: number;
    try { postId = requireId(id); } catch { return invalidIdResponse(); }

    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);

    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const rl = checkRateLimit(`like:${userId}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }

    const existing = await prisma.like.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      await prisma.like.delete({ where: { id: existing.id } });
      const count = await prisma.like.count({ where: { postId } });
      return NextResponse.json({ isLiked: false, count });
    } else {
      try {
        await prisma.like.create({ data: { postId, userId } });
      } catch (e: unknown) {
        if ((e as { code?: string }).code !== "P2002") throw e;
      }
      const count = await prisma.like.count({ where: { postId } });
      await createActivity(userId, "LIKE_ADDED", postId);
      return NextResponse.json({ isLiked: true, count });
    }
  } catch (e) {
    console.error("[Like] Failed to toggle like:", e);
    return NextResponse.json({ error: "点赞操作失败" }, { status: 500 });
  }
}
