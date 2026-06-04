import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createActivity } from "@/lib/activity";
import { requireId, invalidIdResponse } from "@/lib/api-utils";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";
import { CACHE_PRIVATE_MAX_AGE_MEDIUM, CACHE_PRIVATE_STALE_MEDIUM } from "@/lib/constants";

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

    if (!userId) {
      return NextResponse.json({ isBookmarked: false });
    }

    const existing = await prisma.bookmarkItem.findFirst({
      where: {
        postId,
        collection: { userId },
      },
      select: { id: true },
    });

    return NextResponse.json({ isBookmarked: !!existing }, { headers: { "Cache-Control": `private, max-age=${CACHE_PRIVATE_MAX_AGE_MEDIUM}, stale-while-revalidate=${CACHE_PRIVATE_STALE_MEDIUM}` } });
  } catch (e) {
    console.error("[Bookmark] Failed to fetch bookmark status:", e);
    return NextResponse.json({ error: "获取收藏状态失败" }, { status: 500 });
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);

    if (!userId) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const rl = checkRateLimit(`bookmark:${userId}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "操作太频繁，请稍后再试" },
        { status: 429, headers: getRateLimitHeaders(rl) }
      );
    }

    const { id } = await params;
    let postId: number;
    try { postId = requireId(id); } catch { return invalidIdResponse(); }

    // Check if already bookmarked in any collection
    const existing = await prisma.bookmarkItem.findFirst({
      where: {
        postId,
        collection: { userId },
      },
      select: { id: true },
    });

    if (existing) {
      // Remove from all collections
      await prisma.bookmarkItem.deleteMany({
        where: {
          postId,
          collection: { userId },
        },
      });
      return NextResponse.json({ isBookmarked: false });
    } else {
      // Get or create default collection (upsert to avoid race condition)
      const defaultCollection = await prisma.bookmarkCollection.upsert({
        where: { userId_name: { userId, name: "默认收藏夹" } },
        update: {},
        create: { userId, name: "默认收藏夹", isDefault: true },
      });

      try {
        await prisma.bookmarkItem.create({
          data: { collectionId: defaultCollection.id, postId },
        });
      } catch (e: unknown) {
        if ((e as { code?: string }).code !== "P2002") throw e;
      }

      await createActivity(userId, "BOOKMARK_ADDED", postId);

      return NextResponse.json({ isBookmarked: true });
    }
  } catch (e) {
    console.error("[Bookmark] Failed to toggle bookmark:", e);
    return NextResponse.json({ error: "收藏操作失败" }, { status: 500 });
  }
}
