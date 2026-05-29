import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "admin") return NextResponse.json({ error: "无权限" }, { status: 403 });

  try {
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
      trend: recentStats.reverse(),
      popularPosts,
    }, { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } });
  } catch (e) {
    console.error("[Admin Stats] Failed to fetch stats:", e);
    return NextResponse.json({ error: "获取统计数据失败" }, { status: 500 });
  }
}
