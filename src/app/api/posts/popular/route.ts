import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "week";
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10") || 10));

    const now = new Date();
    let startDate: Date;

    if (period === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    } else {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
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
        score: post._count.likes * 3 + post._count.comments * 2 + post._count.readHistory,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return NextResponse.json(scored, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (e) {
    console.error("[PopularPosts] Failed to fetch popular posts:", e);
    return NextResponse.json({ error: "获取热门文章失败" }, { status: 500 });
  }
}
