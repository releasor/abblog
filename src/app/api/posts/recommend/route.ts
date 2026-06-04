import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CACHE_PUBLIC_S_MAXAGE_SHORT, CACHE_PUBLIC_STALE_SHORT, ADMIN_PAGE_SIZE } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawPostId = parseInt(searchParams.get("postId") || "", 10);
    const postId = Math.max(0, isNaN(rawPostId) ? 0 : rawPostId);
    const rawLimit = parseInt(searchParams.get("limit") || "", 10);
    const limit = Math.min(20, Math.max(1, isNaN(rawLimit) ? 4 : rawLimit));

    const session = await getServerSession(authOptions);
    const userId = getAuthUserId(session);

    let recommendedIds: number[] = [];

    if (userId) {
      const readHistory = await prisma.readHistory.findMany({
        where: { userId },
        orderBy: { readAt: "desc" },
        take: ADMIN_PAGE_SIZE,
        include: {
          post: {
            select: {
              categoryId: true,
              tags: { select: { tagId: true } },
            },
          },
        },
      });

      const categoryIds = readHistory
        .map((r) => r.post.categoryId)
        .filter(Boolean) as number[];
      const tagIds = readHistory.flatMap((r) => r.post.tags.map((t) => t.tagId));

      const categoryFreq: Record<number, number> = {};
      const tagFreq: Record<number, number> = {};

      for (const cid of categoryIds) {
        categoryFreq[cid] = (categoryFreq[cid] || 0) + 1;
      }
      for (const tid of tagIds) {
        tagFreq[tid] = (tagFreq[tid] || 0) + 1;
      }

      const topCategories = Object.entries(categoryFreq)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([id]) => parseInt(id, 10));

      const topTags = Object.entries(tagFreq)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([id]) => parseInt(id, 10));

      if (topCategories.length > 0 || topTags.length > 0) {
        const posts = await prisma.post.findMany({
          where: {
            status: "PUBLISHED",
            id: { not: postId },
            OR: [
              ...(topCategories.length > 0 ? [{ categoryId: { in: topCategories } }] : []),
              ...(topTags.length > 0 ? [{ tags: { some: { tagId: { in: topTags } } } }] : []),
            ],
          },
          select: { id: true },
          take: limit * 2,
          orderBy: { publishedAt: "desc" },
        });

        recommendedIds = posts.map((p) => p.id).slice(0, limit);
      }
    }

    const postSelect = {
      id: true, title: true, slug: true, excerpt: true, coverImageUrl: true, publishedAt: true,
      author: { select: { name: true } },
      category: { select: { name: true, slug: true } },
    };

    if (recommendedIds.length < limit) {
      const [mainPosts, fallback] = await Promise.all([
        recommendedIds.length > 0
          ? prisma.post.findMany({ where: { id: { in: recommendedIds } }, select: postSelect })
          : Promise.resolve([]),
        prisma.post.findMany({
          where: { status: "PUBLISHED", id: { not: postId, notIn: recommendedIds } },
          select: postSelect,
          orderBy: { publishedAt: "desc" },
          take: limit - recommendedIds.length,
        }),
      ]);
      return NextResponse.json([...mainPosts, ...fallback], {
        headers: { "Cache-Control": `public, s-maxage=${CACHE_PUBLIC_S_MAXAGE_SHORT}, stale-while-revalidate=${CACHE_PUBLIC_STALE_SHORT}` },
      });
    }

    const posts = await prisma.post.findMany({
      where: { id: { in: recommendedIds } },
      select: postSelect,
    });

    return NextResponse.json(posts, {
      headers: { "Cache-Control": `public, s-maxage=${CACHE_PUBLIC_S_MAXAGE_SHORT}, stale-while-revalidate=${CACHE_PUBLIC_STALE_SHORT}` },
    });
  } catch (e) {
    console.error("[Recommend] Failed to fetch recommendations:", e);
    return NextResponse.json({ error: "获取推荐失败" }, { status: 500 });
  }
}
