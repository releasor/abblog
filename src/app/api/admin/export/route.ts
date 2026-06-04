import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/api-utils";
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from "@/lib/rate-limit";
import { CACHE_PRIVATE_MAX_AGE_LONG, CACHE_PRIVATE_STALE_LONG } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) return NextResponse.json({ error: "无权限" }, { status: 403 });

    const ip = getClientIp(request);
    const rl = checkRateLimit(`admin-export:${ip}`, RATE_LIMITS.api);
    if (!rl.allowed) {
      return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429, headers: getRateLimitHeaders(rl) });
    }
    const [posts, categories, tags, comments, users] = await Promise.all([
      prisma.post.findMany({
        include: { tags: { include: { tag: true } }, category: true },
      }),
      prisma.category.findMany(),
      prisma.tag.findMany(),
      prisma.comment.findMany(),
      prisma.user.findMany({
        select: { id: true, name: true, email: true, username: true, points: true, level: true, createdAt: true },
      }),
    ]);

    const data = {
      exportedAt: new Date().toISOString(),
      posts: posts.map((p) => ({
        ...p,
        tags: p.tags.map((pt) => pt.tag.name),
        categoryName: p.category?.name,
      })),
      categories,
      tags,
      comments,
      users,
    };

    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="billionaire-export-${Date.now()}.json"`,
        "Cache-Control": `private, max-age=${CACHE_PRIVATE_MAX_AGE_LONG}, stale-while-revalidate=${CACHE_PRIVATE_STALE_LONG}`,
      },
    });
  } catch (e) {
    console.error("[Admin Export] Failed to export data:", e);
    return NextResponse.json({ error: "导出数据失败" }, { status: 500 });
  }
}
