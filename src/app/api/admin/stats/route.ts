import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/api-utils";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";
import { CACHE_PRIVATE_MAX_AGE_MEDIUM, CACHE_PRIVATE_STALE_MEDIUM } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) return NextResponse.json({ error: "无权限" }, { status: 403 });

    const ip = getClientIp(request);
    const rl = checkRateLimit(`admin-stats:${ip}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }
    const [totalPosts, totalUsers, totalComments, totalViews, recentStats, popularPosts] = await Promise.all([
      prisma.post.count({ where: { status: "PUBLISHED" } }),
      prisma.user.count(),
      prisma.comment.count({ where: { status: "APPROVED" } }),
      prisma.readHistory.count(),
      prisma.siteStat.findMany({ orderBy: { date: "desc" }, take: 30 }),
      prisma.post.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { score: "desc" },
        take: 10,
        select: { id: true, title: true, slug: true, score: true, _count: { select: { likes: true, comments: true } } },
      }),
    ]);

    return NextResponse.json({
      summary: { totalPosts, totalUsers, totalComments, totalViews },
      trend: recentStats.toReversed(),
      popularPosts,
    }, { headers: { ...getRateLimitHeaders(rl), "Cache-Control": `private, max-age=${CACHE_PRIVATE_MAX_AGE_MEDIUM}, stale-while-revalidate=${CACHE_PRIVATE_STALE_MEDIUM}` } });
  } catch (e) {
    console.error("[Admin Stats] Failed to fetch stats:", e);
    return NextResponse.json({ error: "获取统计数据失败" }, { status: 500 });
  }
}
