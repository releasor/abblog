import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ONE_WEEK_MS, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE, LIKE_WEIGHT, COMMENT_WEIGHT, READ_WEIGHT, CACHE_PUBLIC_S_MAXAGE_SHORT, CACHE_PUBLIC_STALE_SHORT } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "week";
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get("limit") || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));

    const now = new Date();
    let startDate: Date;

    if (period === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    } else {
      startDate = new Date(now.getTime() - ONE_WEEK_MS);
    }

    const candidateLimit = limit * 3;

    const [topByLikes, topByComments, topByReads] = await Promise.all([
      prisma.post.findMany({
        where: { status: "PUBLISHED", publishedAt: { not: null }, likes: { some: { createdAt: { gte: startDate } } } },
        select: { id: true, title: true, slug: true, coverImageUrl: true, publishedAt: true, _count: { select: { likes: { where: { createdAt: { gte: startDate } } }, comments: { where: { createdAt: { gte: startDate } } }, readHistory: { where: { readAt: { gte: startDate } } } } } },
        orderBy: { likes: { _count: "desc" } },
        take: candidateLimit,
      }),
      prisma.post.findMany({
        where: { status: "PUBLISHED", publishedAt: { not: null }, comments: { some: { createdAt: { gte: startDate } } } },
        select: { id: true, title: true, slug: true, coverImageUrl: true, publishedAt: true, _count: { select: { likes: { where: { createdAt: { gte: startDate } } }, comments: { where: { createdAt: { gte: startDate } } }, readHistory: { where: { readAt: { gte: startDate } } } } } },
        orderBy: { comments: { _count: "desc" } },
        take: candidateLimit,
      }),
      prisma.post.findMany({
        where: { status: "PUBLISHED", publishedAt: { not: null }, readHistory: { some: { readAt: { gte: startDate } } } },
        select: { id: true, title: true, slug: true, coverImageUrl: true, publishedAt: true, _count: { select: { likes: { where: { createdAt: { gte: startDate } } }, comments: { where: { createdAt: { gte: startDate } } }, readHistory: { where: { readAt: { gte: startDate } } } } } },
        orderBy: { readHistory: { _count: "desc" } },
        take: candidateLimit,
      }),
    ]);

    const seen = new Set<number>();
    const allCandidates = [...topByLikes, ...topByComments, ...topByReads].filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    const scored = allCandidates
      .map((post) => ({
        ...post,
        score: post._count.likes * LIKE_WEIGHT + post._count.comments * COMMENT_WEIGHT + post._count.readHistory * READ_WEIGHT,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return NextResponse.json(scored, {
      headers: { "Cache-Control": `public, s-maxage=${CACHE_PUBLIC_S_MAXAGE_SHORT}, stale-while-revalidate=${CACHE_PUBLIC_STALE_SHORT}` },
    });
  } catch (e) {
    console.error("[PopularPosts] Failed to fetch popular posts:", e);
    return NextResponse.json({ error: "获取热门文章失败" }, { status: 500 });
  }
}
